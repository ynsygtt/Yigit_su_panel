const express = require('express');
const { parseLocalDate } = require('../utils/dateHelpers');
const { calculateFinanceStats } = require('../utils/financeHelpers');

module.exports = ({ Order, Payment, Expense, Product, BulkSale, getReportCacheKey, getCachedReport, setCachedReport }) => {
    const router = express.Router();

    router.get('/stats', async (req, res) => {
        try {
            const { startDate, endDate, category } = req.query;

            const cacheKey = getReportCacheKey(req);
            const cached = getCachedReport(cacheKey);
            if (cached) return res.json(cached);

            let dateFilter = {};
            if (startDate && endDate) {
                const start = parseLocalDate(startDate);
                const end = parseLocalDate(endDate, true);
                dateFilter = { date: { $gte: start, $lte: end } };
            }

            const orders = await Order.find({ status: 'Teslim Edildi', ...dateFilter }).lean();
            const payments = await Payment.find(dateFilter).lean();
            const expenses = await Expense.find(dateFilter).lean();
            const products = await Product.find().lean();

            let bulkSalesDateFilter = {};
            if (startDate && endDate) {
                const start = parseLocalDate(startDate);
                const end = parseLocalDate(endDate, true);
                bulkSalesDateFilter = { createdAt: { $gte: start, $lte: end } };
            }
            const bulkSales = await BulkSale.find(bulkSalesDateFilter).lean();

            const {
                totalSales,
                totalExpense,
                totalOutstandingDebt,
                netProfit,
                currentCash,
                totalCost,
                unitCost,
                totalQuantity
            } = calculateFinanceStats({ orders, payments, expenses, bulkSales, products });

            let transactions = [
                ...orders.map(o => ({
                    type: o.paymentMethod === 'Borç' ? 'Borç Kaydı' : 'Gelir',
                    category: o.items.length === 0 ? 'Manuel Borç Ekleme' : (o.paymentMethod === 'Borç' ? 'Borçlar' : 'Sipariş Gelirleri'),
                    date: o.date,
                    amount: o.totalAmount,
                    desc: o.items.length === 0 ? `Manuel Borç (${o.customerName})` : (o.paymentMethod === 'Borç' ? `Borç Kaydı - Sipariş (${o.customerName})` : `Sipariş (${o.customerName})`),
                    method: o.paymentMethod,
                    sourceType: o.items.length === 0 ? 'manual-debt' : 'order',
                    sourceId: o._id,
                    note: o.note || ''
                })),
                ...expenses.map(e => ({
                    type: 'Gider',
                    category: e.category,
                    date: e.date,
                    amount: e.amount,
                    desc: e.title,
                    method: '-',
                    sourceType: 'expense',
                    sourceId: e._id
                })),
                ...payments.map(p => ({
                    type: 'Tahsilat',
                    category: 'Borç Tahsilatları',
                    date: p.date,
                    amount: p.amount,
                    desc: `Borç Tahsilatı (${p.method})`,
                    method: p.method,
                    sourceType: 'payment',
                    sourceId: p._id
                })),
                ...bulkSales.map(bs => ({
                    type: 'Gelir',
                    category: 'Toplu Satış Geliri',
                    date: bs.createdAt,
                    amount: bs.totalAmount || 0,
                    desc: `Toplu Satış (${bs.customer?.name || 'Müşteri'})`,
                    method: bs.paymentMethod || '-',
                    sourceType: 'bulk-sale',
                    sourceId: bs._id
                }))
            ];

            let filteredTotal = 0;
            if (category && category !== 'all') {
                transactions = transactions.filter(t => t.category === category);
                filteredTotal = transactions.reduce((acc, t) => {
                    if (t.type === 'Gider') return acc - t.amount;
                    return acc + t.amount;
                }, 0);
            }
            transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

            const response = {
                totalSales,
                totalExpense,
                totalOutstandingDebt,
                netProfit,
                currentCash,
                transactions,
                filteredTotal,
                totalCost,
                unitCost,
                totalQuantity
            };
            setCachedReport(cacheKey, response);
            res.json(response);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
