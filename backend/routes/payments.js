const express = require('express');

module.exports = ({ Payment, Order }) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const payments = await Payment.find().populate('customerId', 'name phone').sort({ date: -1 });
            res.json(payments);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const { customerId, amount, method, orderId } = req.body;

            const debts = await Order.aggregate([
                { $match: { status: 'Teslim Edildi', paymentMethod: 'Borç' } },
                { $group: { _id: '$customerId', totalDebt: { $sum: '$totalAmount' } } }
            ]);
            const payments = await Payment.aggregate([
                { $group: { _id: '$customerId', totalPaid: { $sum: '$amount' } } }
            ]);

            const customerDebt = debts.find(d => d._id.toString() === customerId)?.totalDebt || 0;
            const customerPaid = payments.find(p => p._id.toString() === customerId)?.totalPaid || 0;
            const remaining = customerDebt - customerPaid;

            if (remaining <= 0) {
                return res.status(400).json({ error: `Bu müşterinin borcu bulunmamaktadır. (Kalan: ₺${remaining})` });
            }

            if (amount > remaining) {
                return res.status(400).json({ error: `Tahsilat tutarı (₺${amount}) kalan borçtan (₺${remaining}) fazla olamaz.` });
            }

            const newPayment = new Payment({
                customerId,
                amount,
                method,
                orderId,
                date: Date.now()
            });
            await newPayment.save();
            res.status(201).json(newPayment);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const { date, ...safeBody } = req.body;
            const updatedPayment = await Payment.findByIdAndUpdate(req.params.id, safeBody, { new: true });
            if (!updatedPayment) return res.status(404).json({ error: 'Tahsilat kaydı bulunamadı' });
            res.json(updatedPayment);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const payment = await Payment.findByIdAndDelete(req.params.id);
            if (!payment) return res.status(404).json({ error: 'Tahsilat kaydı bulunamadı' });
            res.json({ msg: 'Tahsilat kaydı silindi', payment });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
