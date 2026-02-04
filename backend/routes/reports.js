const express = require('express');
const { parseLocalDate } = require('../utils/dateHelpers');

module.exports = ({ Order, Product, Payment, Expense, BulkSale, getReportCacheKey, getCachedReport, setCachedReport }) => {
    const router = express.Router();

    const getTopExpenseCategories = (expenses) => {
        const categories = {};
        expenses.forEach(e => {
            if (!categories[e.category]) {
                categories[e.category] = 0;
            }
            categories[e.category] += e.amount;
        });
        return Object.entries(categories)
            .map(([category, total]) => ({ category, total }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    };

    const getPaymentMethodBreakdown = (orders, payments) => {
        const breakdown = {
            'Nakit': 0,
            'Kart': 0,
            'IBAN': 0,
            'Borç': 0,
            'Tahsilat': 0
        };

        orders.forEach(o => {
            if (o.items.length > 0 && breakdown.hasOwnProperty(o.paymentMethod)) {
                breakdown[o.paymentMethod] += o.totalAmount;
            }
        });

        payments.forEach(p => {
            breakdown['Tahsilat'] += p.amount;
        });

        return breakdown;
    };

    router.get('/product-sales', async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            if (!startDate || !endDate) {
                return res.status(400).json({ error: 'Başlangıç ve bitiş tarihleri gerekli' });
            }

            const start = parseLocalDate(startDate);
            const end = parseLocalDate(endDate, true);

            const cacheKey = getReportCacheKey(req);
            const cached = getCachedReport(cacheKey);
            if (cached) return res.json(cached);

            const productSales = await Order.aggregate([
                {
                    $match: {
                        status: 'Teslim Edildi',
                        date: { $gte: start, $lte: end },
                        'items.0': { $exists: true }
                    }
                },
                { $unwind: '$items' },
                {
                    $group: {
                        _id: {
                            productId: '$items.productId',
                            productName: '$items.productName'
                        },
                        totalQuantity: { $sum: '$items.quantity' },
                        totalRevenue: { $sum: '$items.total' },
                        orderCount: { $sum: 1 },
                        avgPrice: { $avg: '$items.price' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        productId: '$_id.productId',
                        productName: '$_id.productName',
                        totalQuantity: 1,
                        totalRevenue: 1,
                        orderCount: 1,
                        avgPrice: { $round: ['$avgPrice', 2] }
                    }
                },
                { $sort: { totalRevenue: -1 } }
            ]);

            const products = await Product.find().lean();
            const productCostMap = {};
            products.forEach(p => productCostMap[p._id.toString()] = p.unitPrice);

            const enrichedSales = productSales.map(sale => {
                const cost = productCostMap[sale.productId] || 0;
                const totalCost = cost * sale.totalQuantity;
                const profit = sale.totalRevenue - totalCost;
                const profitMargin = sale.totalRevenue > 0 ? ((profit / sale.totalRevenue) * 100).toFixed(2) : 0;

                return {
                    ...sale,
                    unitCost: cost,
                    totalCost: totalCost,
                    profit: profit,
                    profitMargin: parseFloat(profitMargin)
                };
            });

            const response = {
                startDate: start,
                endDate: end,
                totalProducts: enrichedSales.length,
                sales: enrichedSales
            };

            setCachedReport(cacheKey, response);
            res.json(response);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/summary', async (req, res) => {
        try {
            const { period } = req.query;
            if (!period || !['daily', 'weekly', 'monthly'].includes(period)) {
                return res.status(400).json({ error: 'Geçersiz periyot. Kullanım: daily, weekly, monthly' });
            }

            const cacheKey = getReportCacheKey(req);
            const cached = getCachedReport(cacheKey);
            if (cached) return res.json(cached);

            let startDate = new Date();
            let endDate = new Date();
            endDate.setHours(23, 59, 59, 999);

            if (period === 'daily') {
                startDate.setHours(0, 0, 0, 0);
            } else if (period === 'weekly') {
                startDate.setDate(startDate.getDate() - 7);
                startDate.setHours(0, 0, 0, 0);
            } else if (period === 'monthly') {
                startDate.setDate(1);
                startDate.setHours(0, 0, 0, 0);
            }

            const dateFilter = { date: { $gte: startDate, $lte: endDate } };

            const orders = await Order.find({ status: 'Teslim Edildi', ...dateFilter }).lean();

            const directSales = orders.reduce((acc, o) => {
                if (o.paymentMethod !== 'Borç' && o.items.length > 0) {
                    return acc + o.totalAmount;
                }
                return acc;
            }, 0);

            const debtSales = orders.reduce((acc, o) => {
                if (o.paymentMethod === 'Borç' && o.items.length > 0) {
                    return acc + o.totalAmount;
                }
                return acc;
            }, 0);

            const payments = await Payment.find(dateFilter).lean();
            const totalCollections = payments.reduce((acc, p) => acc + p.amount, 0);

            const bulkSales = await BulkSale.find({ createdAt: dateFilter.date }).lean();
            const bulkSalesIncome = bulkSales.reduce((acc, bs) => acc + (bs.totalAmount || 0), 0);

            const expenses = await Expense.find(dateFilter).lean();
            const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

            const totalRevenue = directSales + totalCollections + bulkSalesIncome;
            const netProfit = totalRevenue - totalExpenses;

            const orderCount = orders.filter(o => o.items.length > 0).length;
            const debtOrderCount = orders.filter(o => o.paymentMethod === 'Borç' && o.items.length > 0).length;

            let totalProductsSold = 0;
            orders.forEach(o => {
                if (o.items.length > 0) {
                    o.items.forEach(item => {
                        totalProductsSold += item.quantity;
                    });
                }
            });

            const response = {
                period,
                startDate,
                endDate,
                summary: {
                    totalRevenue,
                    directSales,
                    debtSales,
                    totalCollections,
                    bulkSalesIncome,
                    totalExpenses,
                    netProfit,
                    orderCount,
                    debtOrderCount,
                    totalProductsSold,
                    paymentCount: payments.length,
                    expenseCount: expenses.length
                },
                breakdown: {
                    topExpenseCategories: getTopExpenseCategories(expenses),
                    paymentMethods: getPaymentMethodBreakdown(orders, payments)
                }
            };

            setCachedReport(cacheKey, response);
            res.json(response);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/profit-loss', async (req, res) => {
        try {
            const { startDate, endDate } = req.query;
            if (!startDate || !endDate) {
                return res.status(400).json({ error: 'Başlangıç ve bitiş tarihleri gerekli' });
            }

            const start = parseLocalDate(startDate);
            const end = parseLocalDate(endDate, true);
            const dateFilter = { date: { $gte: start, $lte: end } };

            const cacheKey = getReportCacheKey(req);
            const cached = getCachedReport(cacheKey);
            if (cached) return res.json(cached);

            const orders = await Order.find({ status: 'Teslim Edildi', ...dateFilter }).lean();
            const payments = await Payment.find(dateFilter).lean();
            const bulkSales = await BulkSale.find({ createdAt: dateFilter.date }).lean();

            const directSales = orders.reduce((acc, o) => {
                if (o.paymentMethod !== 'Borç' && o.items.length > 0) {
                    return acc + o.totalAmount;
                }
                return acc;
            }, 0);

            const collections = payments.reduce((acc, p) => acc + p.amount, 0);
            const bulkSalesIncome = bulkSales.reduce((acc, bs) => acc + (bs.totalAmount || 0), 0);

            const totalIncome = directSales + collections + bulkSalesIncome;

            const products = await Product.find().lean();
            const productCostMap = {};
            products.forEach(p => productCostMap[p._id.toString()] = p.unitPrice);

            let totalCost = 0;
            let costByProduct = [];
            const productCosts = {};

            orders.forEach(o => {
                if (o.items.length > 0) {
                    o.items.forEach(item => {
                        const cost = (productCostMap[item.productId] || 0) * item.quantity;
                        totalCost += cost;

                        if (!productCosts[item.productName]) {
                            productCosts[item.productName] = {
                                productName: item.productName,
                                quantity: 0,
                                cost: 0,
                                revenue: 0
                            };
                        }
                        productCosts[item.productName].quantity += item.quantity;
                        productCosts[item.productName].cost += cost;
                        productCosts[item.productName].revenue += item.total || (item.quantity * item.price);
                    });
                }
            });

            costByProduct = Object.values(productCosts).map(p => ({
                ...p,
                profit: p.revenue - p.cost,
                margin: p.revenue > 0 ? ((p.revenue - p.cost) / p.revenue * 100).toFixed(2) : 0
            }));

            const expenses = await Expense.find(dateFilter).lean();
            const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

            const expensesByCategory = {};
            expenses.forEach(e => {
                if (!expensesByCategory[e.category]) {
                    expensesByCategory[e.category] = { category: e.category, total: 0, count: 0 };
                }
                expensesByCategory[e.category].total += e.amount;
                expensesByCategory[e.category].count += 1;
            });

            const expenseBreakdown = Object.values(expensesByCategory).sort((a, b) => b.total - a.total);

            const grossProfit = totalIncome - totalCost;
            const netProfit = grossProfit - totalExpenses;
            const profitMargin = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(2) : 0;
            const grossMargin = totalIncome > 0 ? ((grossProfit / totalIncome) * 100).toFixed(2) : 0;

            const response = {
                period: { startDate: start, endDate: end },
                income: {
                    directSales,
                    collections,
                    bulkSalesIncome,
                    total: totalIncome
                },
                costs: {
                    totalCost,
                    byProduct: costByProduct.sort((a, b) => b.cost - a.cost)
                },
                expenses: {
                    total: totalExpenses,
                    byCategory: expenseBreakdown
                },
                profitLoss: {
                    grossProfit,
                    netProfit,
                    profitMargin: parseFloat(profitMargin),
                    grossMargin: parseFloat(grossMargin)
                },
                summary: {
                    totalIncome,
                    totalCost,
                    totalExpenses,
                    netProfit
                }
            };

            setCachedReport(cacheKey, response);
            res.json(response);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
