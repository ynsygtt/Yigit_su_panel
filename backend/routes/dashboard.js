const express = require('express');
const { parseLocalDate } = require('../utils/dateHelpers');

module.exports = ({ Order, Payment, Expense, BulkSale, getReportCacheKey, getCachedReport, setCachedReport }) => {
    const router = express.Router();

    router.get('/dashboard/analysis', async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            if (!startDate || !endDate) return res.status(400).json({ error: 'Tarih aralığı gerekli' });

            const cacheKey = getReportCacheKey(req);
            const cached = getCachedReport(cacheKey);
            if (cached) return res.json(cached);

            const start = parseLocalDate(startDate);
            const end = parseLocalDate(endDate, true);

            const matchStage = {
                status: 'Teslim Edildi',
                date: { $gte: start, $lte: end }
            };

            const summaryStats = await Order.aggregate([
                { $match: matchStage },
                { $unwind: "$items" },
                { $group: {
                    _id: null,
                    totalSales: { $sum: { $multiply: ["$items.quantity", "$items.price"] } },
                    totalItems: { $sum: "$items.quantity" }
                }}
            ]);

            const productStats = await Order.aggregate([
                { $match: matchStage },
                { $unwind: "$items" },
                { $group: {
                    _id: "$items.productName",
                    totalQty: { $sum: "$items.quantity" }
                }},
                { $sort: { totalQty: -1 } }
            ]);

            const customerStats = await Order.aggregate([
                { $match: matchStage },
                { $group: {
                    _id: "$customerId",
                    name: { $first: "$customerName" },
                    totalAmount: { $sum: "$totalAmount" },
                    debtAmount: {
                        $sum: {
                            $cond: [
                                { $and: [{ $eq: ["$paymentMethod", "Borç"] }, { $gt: [{ $size: "$items" }, 0] }] },
                                "$totalAmount",
                                0
                            ]
                        }
                    },
                    paidAmount: {
                        $sum: {
                            $cond: [
                                { $ne: ["$paymentMethod", "Borç"] },
                                "$totalAmount",
                                0
                            ]
                        }
                    }
                }},
                { $sort: { totalAmount: -1 } }
            ]);

            const paymentStats = await Payment.aggregate([
                { $match: { date: { $gte: start, $lte: end } } },
                { $group: {
                    _id: "$method",
                    totalAmount: { $sum: "$amount" }
                }},
                { $sort: { totalAmount: -1 } }
            ]);

            const expenseStats = await Expense.aggregate([
                { $match: { date: { $gte: start, $lte: end } } },
                { $group: {
                    _id: null,
                    totalExpense: { $sum: "$amount" }
                }}
            ]);

            const allOrders = await Order.find(matchStage).lean();

            const bulkSalesDateFilter = {
                $or: [
                    { createdAt: { $gte: start, $lte: end } },
                    { updatedAt: { $gte: start, $lte: end } }
                ]
            };
            const bulkSales = await BulkSale.find(bulkSalesDateFilter).lean();
            const bulkSalesTotal = bulkSales.reduce((sum, bs) => sum + (bs.totalAmount || 0), 0);
            const bulkSalesDeliveredItems = bulkSales.reduce((sum, bs) => {
                const itemsTotal = (bs.items || []).reduce((acc, item) => acc + (item.delivered || 0), 0);
                return sum + itemsTotal;
            }, 0);

            const bulkSalesProductTotals = bulkSales.reduce((acc, bs) => {
                (bs.items || []).forEach((item) => {
                    const deliveredQty = item.delivered || 0;
                    if (deliveredQty <= 0) return;
                    const name = item.product?.name || item.productName || item.name || 'Ürün';
                    acc[name] = (acc[name] || 0) + deliveredQty;
                });
                return acc;
            }, {});

            const productTotals = {};
            productStats.forEach((p) => {
                productTotals[p._id] = (productTotals[p._id] || 0) + (p.totalQty || 0);
            });
            Object.entries(bulkSalesProductTotals).forEach(([name, qty]) => {
                productTotals[name] = (productTotals[name] || 0) + qty;
            });

            const mergedProductStats = Object.entries(productTotals)
                .map(([name, totalQty]) => ({ _id: name, totalQty }))
                .sort((a, b) => b.totalQty - a.totalQty);

            const bulkCustomerTotals = bulkSales.reduce((acc, bs) => {
                const customerId = bs.customer?._id?.toString() || `bulk-${bs._id}`;
                const customerName = bs.customer?.name || 'Müşteri';
                const deliveredAmount = (bs.items || []).reduce(
                    (sum, item) => sum + (item.delivered || 0) * (item.unitPrice || 0),
                    0
                );
                if (deliveredAmount <= 0) return acc;
                if (!acc[customerId]) {
                    acc[customerId] = { name: customerName, totalAmount: 0 };
                }
                acc[customerId].totalAmount += deliveredAmount;
                return acc;
            }, {});

            const customerTotals = {};
            customerStats.forEach((c) => {
                const id = c._id?.toString() || c.name || 'Müşteri';
                customerTotals[id] = {
                    _id: c._id,
                    name: c.name,
                    totalAmount: (customerTotals[id]?.totalAmount || 0) + (c.totalAmount || 0),
                    paidAmount: (customerTotals[id]?.paidAmount || 0) + (c.paidAmount || 0),
                    debtAmount: (customerTotals[id]?.debtAmount || 0) + (c.debtAmount || 0),
                    isBulkSaleOnly: false
                };
            });
            Object.entries(bulkCustomerTotals).forEach(([id, data]) => {
                if (!customerTotals[id]) {
                    customerTotals[id] = {
                        _id: id,
                        name: data.name,
                        totalAmount: 0,
                        paidAmount: 0,
                        debtAmount: 0,
                        isBulkSaleOnly: true
                    };
                }
                if (customerTotals[id].isBulkSaleOnly === undefined) {
                    customerTotals[id].isBulkSaleOnly = true;
                }
                customerTotals[id].totalAmount += data.totalAmount;
                customerTotals[id].paidAmount += data.totalAmount;
            });

            const mergedCustomerStats = Object.values(customerTotals)
                .sort((a, b) => b.totalAmount - a.totalAmount);

            const summary = summaryStats[0] || { totalSales: 0, totalItems: 0 };
            summary.totalSales = (summary.totalSales || 0) + bulkSalesTotal;
            summary.totalItems = (summary.totalItems || 0) + bulkSalesDeliveredItems;

            const response = {
                summary,
                products: mergedProductStats,
                customers: mergedCustomerStats,
                payments: paymentStats || [],
                allOrders: allOrders || [],
                bulkSales: bulkSales || [],
                totalExpense: expenseStats[0]?.totalExpense || 0
            };

            setCachedReport(cacheKey, response);
            res.json(response);

        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    router.get('/customer/history/:id', async (req, res) => {
        try {
            const customerId = req.params.id;
            const orders = await Order.find({ customerId, status: 'Teslim Edildi' }).lean();
            const formattedOrders = orders.map(o => ({
                type: o.items.length === 0 ? 'Manuel Borç' : 'Sipariş',
                date: o.date,
                description: o.items.length === 0 ? (o.note || 'Borç Girişi') : o.items.map(i => `${i.quantity}x ${i.productName}`).join(', '),
                amount: o.totalAmount,
                method: o.paymentMethod,
                paymentMethod: o.paymentMethod,
                isIncome: false
            }));
            const bulkSales = await BulkSale.find({ 'customer._id': customerId, status: { $ne: 'İptal' } }).lean();
            const formattedBulkSales = bulkSales.map(bs => {
                const totalQty = (bs.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
                const deliveredQty = (bs.items || []).reduce((sum, item) => sum + (item.delivered || 0), 0);
                const remainingQty = Math.max(totalQty - deliveredQty, 0);
                const itemsText = (bs.items || []).map(i => `${i.quantity || 0}x ${i.product?.name || i.productName || i.name || 'Ürün'}`).join(', ');
                return {
                    type: 'Toplu Satış',
                    date: bs.createdAt || bs.updatedAt,
                    description: itemsText || 'Toplu Satış',
                    amount: bs.totalAmount || 0,
                    method: bs.paymentMethod || '-',
                    paymentMethod: bs.paymentMethod || '-',
                    isIncome: false,
                    bulkTotalQty: totalQty,
                    bulkDeliveredQty: deliveredQty,
                    bulkRemainingQty: remainingQty
                };
            });
            const payments = await Payment.find({ customerId }).lean();
            const formattedPayments = payments.map(p => ({
                type: 'Tahsilat',
                date: p.date,
                description: `Ödeme Alındı (${p.method})`,
                amount: p.amount,
                method: p.method,
                paymentMethod: 'Tahsilat',
                isIncome: true
            }));
            const fullHistory = [...formattedOrders, ...formattedBulkSales, ...formattedPayments].sort((a, b) => new Date(b.date) - new Date(a.date));
            res.json(fullHistory);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    return router;
};
