const express = require('express');
const { parseLocalDate } = require('../utils/dateHelpers');

module.exports = ({ Order, Payment, Expense, getReportCacheKey, getCachedReport, setCachedReport }) => {
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

            const response = {
                summary: summaryStats[0] || { totalSales: 0, totalItems: 0 },
                products: productStats,
                customers: customerStats,
                payments: paymentStats || [],
                allOrders: allOrders || [],
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
            const fullHistory = [...formattedOrders, ...formattedPayments].sort((a, b) => new Date(b.date) - new Date(a.date));
            res.json(fullHistory);
        } catch (err) { res.status(500).json({ error: err.message }); }
    });

    return router;
};
