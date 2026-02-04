const buildProductCostMap = (products = []) => {
    const map = {};
    products.forEach(p => { map[p._id] = p.unitPrice; });
    return map;
};

const calculateFinanceStats = ({ orders = [], payments = [], expenses = [], bulkSales = [], products = [] }) => {
    let totalOutstandingDebt = 0;
    orders.forEach(o => {
        if (o.paymentMethod === 'Borç') totalOutstandingDebt += o.totalAmount;
    });

    payments.forEach(p => {
        totalOutstandingDebt -= p.amount;
    });
    totalOutstandingDebt = Math.max(0, totalOutstandingDebt);

    const directSales = orders.reduce((acc, o) => {
        if (o.paymentMethod !== 'Borç' && o.items.length > 0) {
            return acc + o.totalAmount;
        }
        return acc;
    }, 0);

    const collectedDebtPayments = payments.reduce((acc, p) => acc + p.amount, 0);
    const bulkSalesIncome = bulkSales.reduce((acc, bs) => acc + (bs.totalAmount || 0), 0);
    const totalSales = directSales + collectedDebtPayments + bulkSalesIncome;

    const totalExpense = expenses.reduce((acc, e) => acc + e.amount, 0);

    const productCostMap = buildProductCostMap(products);

    let totalCost = 0;
    let totalQuantity = 0;

    orders.forEach(o => {
        o.items.forEach(item => {
            const itemUnitCost = productCostMap[item.productId] || 0;
            const itemQuantity = item.quantity;
            totalCost += itemUnitCost * itemQuantity;
            totalQuantity += itemQuantity;
        });
    });

    const unitCost = totalQuantity > 0 ? (totalCost / totalQuantity) : 0;
    const netProfit = totalSales - (totalCost + totalExpense);

    const directCash = orders.reduce((acc, o) => {
        if (o.paymentMethod !== 'Borç') return acc + o.totalAmount;
        return acc;
    }, 0);
    const currentCash = directCash + collectedDebtPayments + bulkSalesIncome - totalExpense;

    return {
        totalSales,
        totalExpense,
        totalOutstandingDebt,
        netProfit,
        currentCash,
        totalCost,
        unitCost,
        totalQuantity
    };
};

module.exports = { calculateFinanceStats };
