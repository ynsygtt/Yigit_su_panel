const express = require('express');
const { parseLocalDate } = require('../utils/dateHelpers');

module.exports = ({ Order, Payment, Customer }) => {
    const router = express.Router();

    router.post('/manual', async (req, res) => {
        try {
            const { customerId, customerName, amount, date, description } = req.body;

            const newDebtRecord = new Order({
                customerName,
                customerId,
                items: [],
                totalAmount: amount,
                status: 'Teslim Edildi',
                paymentMethod: 'Borç',
                note: description,
                date: date ? parseLocalDate(date) : Date.now()
            });

            await newDebtRecord.save();
            res.status(201).json(newDebtRecord);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.put('/manual/:id', async (req, res) => {
        try {
            const order = await Order.findById(req.params.id);
            if (!order) return res.status(404).json({ error: 'Borç kaydı bulunamadı' });

            if (order.items.length > 0) {
                return res.status(400).json({ error: 'Sadece manuel borç kayıtları güncellenebilir. Bu bir sipariş kaydıdır.' });
            }

            const { amount, description, date } = req.body;
            if (amount) order.totalAmount = amount;
            if (description !== undefined) order.note = description;
            if (date) order.date = parseLocalDate(date);

            await order.save();
            res.json(order);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.delete('/manual/:id', async (req, res) => {
        try {
            const order = await Order.findById(req.params.id);
            if (!order) return res.status(404).json({ error: 'Borç kaydı bulunamadı' });

            if (order.items.length > 0) {
                return res.status(400).json({ error: 'Sadece manuel borç kayıtları silinebilir. Bu bir sipariş kaydıdır.' });
            }

            await Order.findByIdAndDelete(req.params.id);
            res.json({ msg: 'Manuel borç kaydı silindi' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/', async (req, res) => {
        try {
            const debts = await Order.aggregate([
                { $match: { status: 'Teslim Edildi', paymentMethod: 'Borç' } },
                { $group: { _id: '$customerId', totalDebt: { $sum: '$totalAmount' } } }
            ]);
            const payments = await Payment.aggregate([
                { $group: { _id: '$customerId', totalPaid: { $sum: '$amount' } } }
            ]);
            const customers = await Customer.find({});
            const debtList = customers.map(cust => {
                const customerDebt = debts.find(d => d._id.toString() === cust._id.toString())?.totalDebt || 0;
                const customerPaid = payments.find(p => p._id.toString() === cust._id.toString())?.totalPaid || 0;
                const remaining = customerDebt - customerPaid;
                if (remaining > 0) return { _id: cust._id, name: cust.name, phone: cust.phone, totalDebt: remaining };
                return null;
            }).filter(item => item !== null);
            res.json(debtList);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/detail/:customerId', async (req, res) => {
        try {
            const customerId = req.params.customerId;
            const orders = await Order.find({ customerId, status: 'Teslim Edildi', paymentMethod: 'Borç' }).lean();

            const formattedOrders = orders.map(o => ({
                type: o.items.length === 0 ? 'Devir/Manuel Borç' : 'Sipariş',
                date: o.date,
                amount: o.totalAmount,
                description: o.items.length === 0 ? (o.note || 'Manuel Borç Girişi') : o.items.map(i => `${i.quantity}x ${i.productName}`).join(', '),
                isDebt: true
            }));

            const payments = await Payment.find({ customerId }).lean();
            const formattedPayments = payments.map(p => ({
                _id: p._id,
                type: 'Ödeme',
                date: p.date,
                amount: p.amount,
                description: `Tahsilat (${p.method})`,
                isDebt: false
            }));
            const history = [...formattedOrders, ...formattedPayments].sort((a, b) => new Date(a.date) - new Date(b.date));
            res.json(history);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.delete('/:customerId', async (req, res) => {
        try {
            const customerId = req.params.customerId;

            await Order.deleteMany({ customerId, status: 'Teslim Edildi', paymentMethod: 'Borç' });
            await Payment.deleteMany({ customerId });

            res.json({ msg: 'Müşterinin tüm borç kayıtları silindi (stok iade edilmedi)' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
