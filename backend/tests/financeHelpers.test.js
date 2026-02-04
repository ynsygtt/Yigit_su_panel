const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateFinanceStats } = require('../utils/financeHelpers');

test('calculateFinanceStats computes debt, cash, and profit', () => {
  const orders = [
    {
      paymentMethod: 'Nakit',
      totalAmount: 200,
      items: [{ productId: 'p1', quantity: 2 }]
    },
    {
      paymentMethod: 'Borç',
      totalAmount: 100,
      items: [{ productId: 'p1', quantity: 1 }]
    }
  ];

  const payments = [{ amount: 40 }];
  const expenses = [{ amount: 50 }];
  const bulkSales = [{ totalAmount: 60 }];
  const products = [{ _id: 'p1', unitPrice: 30 }];

  const stats = calculateFinanceStats({ orders, payments, expenses, bulkSales, products });

  assert.equal(stats.totalSales, 300);
  assert.equal(stats.totalExpense, 50);
  assert.equal(stats.totalOutstandingDebt, 60);
  assert.equal(stats.totalCost, 90);
  assert.equal(stats.totalQuantity, 3);
  assert.equal(stats.currentCash, 250);
  assert.equal(stats.netProfit, 160);
});
