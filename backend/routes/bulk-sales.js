const express = require('express');

module.exports = ({ BulkSale, Product, Expense }) => {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const bulkSales = await BulkSale.find().sort({ isCancelled: 1, createdAt: -1 });
      res.json(bulkSales);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const bulkSale = await BulkSale.findById(req.params.id);
      if (!bulkSale) return res.status(404).json({ error: 'Toplu satış bulunamadı' });
      res.json(bulkSale);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { customer, items, totalAmount, paymentMethod, notes } = req.body;

      const bulkSale = new BulkSale({
        customer,
        items,
        totalAmount,
        paymentMethod,
        notes,
        status: 'Bekleme'
      });
      await bulkSale.save();

      res.json({ msg: 'Toplu satış oluşturuldu', bulkSale });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.patch('/:id/deliver', async (req, res) => {
    try {
      const { itemIndex, deliveredQuantity } = req.body;
      const bulkSale = await BulkSale.findById(req.params.id);
      if (!bulkSale) throw new Error('Toplu satış bulunamadı');
      if (bulkSale.status === 'İptal') throw new Error('İptal edilen satışa teslimat yapılamaz');
      if (bulkSale.status === 'İptal') throw new Error('Toplu satış zaten iptal edilmiş');

      const index = parseInt(itemIndex);
      if (Number.isNaN(index) || index < 0 || index >= bulkSale.items.length) {
        throw new Error('Geçersiz ürün satırı');
      }

      const deliveredQty = parseInt(deliveredQuantity);
      if (Number.isNaN(deliveredQty) || deliveredQty < 0) {
        throw new Error('Teslim miktarı geçersiz');
      }

      const item = bulkSale.items[index];
      if (deliveredQty > item.quantity) {
        throw new Error('Teslim miktarı sipariş miktarını aşamaz');
      }

      const prevDelivered = item.delivered || 0;
      const delta = deliveredQty - prevDelivered;

      if (delta !== 0) {
        const productId = item.product?._id || item.productId || item._id;
        const product = productId ? await Product.findById(productId) : null;
        if (!product) throw new Error('Ürün bulunamadı');

        if (delta > 0) {
          if (product.stock < delta) {
            throw new Error('Stok yetersiz');
          }
          product.stock -= delta;
        } else {
          product.stock += Math.abs(delta);
        }
        await product.save();
      }

      bulkSale.items[index].delivered = deliveredQty;

      const allDelivered = bulkSale.items.every(item => item.delivered >= item.quantity);
      const someDelivered = bulkSale.items.some(item => item.delivered > 0);

      if (allDelivered) {
        bulkSale.status = 'Tamamlandı';
      } else if (someDelivered) {
        bulkSale.status = 'Kısmi Teslim';
      }

      bulkSale.updatedAt = Date.now();
      await bulkSale.save();

      res.json({ msg: 'Teslim güncellendi', bulkSale });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      let undeliveredValue = 0;
      let undeliveredItems = [];

      const bulkSale = await BulkSale.findById(req.params.id);
      if (!bulkSale) throw new Error('Toplu satış bulunamadı');

      undeliveredValue = 0;
      undeliveredItems = [];

      bulkSale.items.forEach(item => {
        const delivered = item.delivered || 0;
        const quantity = item.quantity || 0;
        const remaining = quantity - delivered;

        if (remaining > 0) {
          const unitPrice = item.unitPrice || 0;
          const itemValue = remaining * unitPrice;
          undeliveredValue += itemValue;
          undeliveredItems.push({
            name: item.product?.name || item.name || 'Bilinmeyen Ürün',
            remaining,
            unitPrice,
            value: itemValue
          });
        }
      });

      if (undeliveredValue > 0) {
        const customerName = bulkSale.customer?.name || 'Bilinmeyen Müşteri';
        const expenseDescription = `Toplu Satış İptali (${customerName}) - Teslim Edilmeyen: ${undeliveredItems.map(i => `${i.remaining}x ${i.name}`).join(', ')}`;

        await Expense.create({
          title: expenseDescription,
          amount: undeliveredValue,
          category: 'Zayi/Fire',
          date: Date.now()
        });
      }

      const cancelledRemainingQty = undeliveredItems.reduce((sum, item) => sum + (item.remaining || 0), 0);
      bulkSale.status = 'İptal';
      bulkSale.isCancelled = true;
      bulkSale.cancelledAt = new Date();
      bulkSale.cancelledRemainingQty = cancelledRemainingQty;
      bulkSale.cancelledRemainingValue = undeliveredValue;
      bulkSale.updatedAt = Date.now();
      await bulkSale.save();

      res.json({
        msg: 'Toplu satış silindi',
        undeliveredValue,
        undeliveredItems
      });
    } catch (err) {
      res.status(500).json({ error: err.message || 'Toplu satış silinemedi' });
    }
  });

  return router;
};
