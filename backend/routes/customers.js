const express = require('express');

module.exports = ({ Customer, Order, Payment, mongoose }) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const { search } = req.query;
            const page = parseInt(req.query.page, 10);
            const limit = parseInt(req.query.limit, 10);
            const usePagination = Number.isInteger(page) && Number.isInteger(limit) && page > 0 && limit > 0;
            let query = {};
            if (search) {
                query = {
                    $or: [
                        { name: { $regex: search, $options: 'i' } },
                        { phone: { $regex: search, $options: 'i' } }
                    ]
                };
            }
            if (usePagination) {
                const skip = (page - 1) * limit;
                const [customers, total] = await Promise.all([
                    Customer.find(query).sort({ name: 1 }).skip(skip).limit(limit),
                    Customer.countDocuments(query)
                ]);
                return res.json({
                    data: customers,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit)
                    }
                });
            }

            const customers = await Customer.find(query).sort({ name: 1 });
            res.json(customers);
        } catch (err) {
            console.error('❌ Müşteri fetch hatası:', err);
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const newCustomer = await new Customer(req.body).save();
            res.json(newCustomer);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const updatedCustomer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (!updatedCustomer) return res.status(404).json({ error: 'Müşteri bulunamadı' });
            res.json(updatedCustomer);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const customerId = req.params.id;

            const debts = await Order.aggregate([
                { $match: { customerId: new mongoose.Types.ObjectId(customerId), status: 'Teslim Edildi', paymentMethod: 'Borç' } },
                { $group: { _id: '$customerId', totalDebt: { $sum: '$totalAmount' } } }
            ]);
            const payments = await Payment.aggregate([
                { $match: { customerId: new mongoose.Types.ObjectId(customerId) } },
                { $group: { _id: '$customerId', totalPaid: { $sum: '$amount' } } }
            ]);

            const customerDebt = debts[0]?.totalDebt || 0;
            const customerPaid = payments[0]?.totalPaid || 0;
            const remaining = customerDebt - customerPaid;

            if (remaining > 0) {
                return res.status(400).json({ error: `Bu müşterinin ${remaining} ₺ borcu var. Borçlu müşteri silinemez.` });
            }

            await Customer.findByIdAndDelete(customerId);
            res.json({ msg: 'Müşteri silindi' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
