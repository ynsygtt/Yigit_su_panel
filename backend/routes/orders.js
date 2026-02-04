const express = require('express');

module.exports = ({ Order, Product }) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const page = parseInt(req.query.page, 10);
            const limit = parseInt(req.query.limit, 10);
            const usePagination = Number.isInteger(page) && Number.isInteger(limit) && page > 0 && limit > 0;

            if (usePagination) {
                const skip = (page - 1) * limit;
                const [orders, total] = await Promise.all([
                    Order.find().sort({ date: -1 }).skip(skip).limit(limit),
                    Order.countDocuments()
                ]);
                return res.json({
                    data: orders,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit)
                    }
                });
            }

            const orders = await Order.find().sort({ date: -1 });
            res.json(orders);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.get('/last/:customerId', async (req, res) => {
        try {
            const last = await Order.findOne({ customerId: req.params.customerId }).sort({ date: -1 });
            res.json(last);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const { customerName, customerId, items, totalAmount, paymentMethod } = req.body;

            const session = await Order.startSession();
            let createdOrder;

            try {
                await session.withTransaction(async () => {
                    if (items && items.length > 0) {
                        for (const item of items) {
                            const product = await Product.findById(item.productId).session(session);
                            if (!product) {
                                throw new Error(`Ürün bulunamadı: ${item.productName || item.productId}`);
                            }
                            if (product.stock < item.quantity) {
                                throw new Error(`${product.name} için stok yetersiz. Mevcut: ${product.stock}, İstenen: ${item.quantity}`);
                            }
                        }

                        for (const item of items) {
                            await Product.findByIdAndUpdate(
                                item.productId,
                                { $inc: { stock: -item.quantity } },
                                { session }
                            );
                        }
                    }

                    createdOrder = await new Order({
                        customerName,
                        customerId,
                        items,
                        totalAmount,
                        paymentMethod,
                        date: Date.now()
                    }).save({ session });
                });
            } finally {
                session.endSession();
            }

            res.json(createdOrder);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const { date, ...safeBody } = req.body;
            const updatedOrder = await Order.findByIdAndUpdate(req.params.id, safeBody, { new: true });
            if (!updatedOrder) return res.status(404).json({ error: 'Sipariş bulunamadı' });
            res.json(updatedOrder);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.put('/:id/status', async (req, res) => {
        try {
            const { date, ...safeBody } = req.body;
            const updatedOrder = await Order.findByIdAndUpdate(req.params.id, safeBody, { new: true });
            if (!updatedOrder) return res.status(404).json({ error: 'Sipariş bulunamadı' });
            res.json(updatedOrder);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const session = await Order.startSession();
            try {
                await session.withTransaction(async () => {
                    const order = await Order.findById(req.params.id).session(session);
                    if (order && order.status !== 'Teslim Edildi' && order.items.length > 0) {
                        for (const item of order.items) {
                            await Product.findByIdAndUpdate(
                                item.productId,
                                { $inc: { stock: +item.quantity } },
                                { session }
                            );
                        }
                    }
                    await Order.findByIdAndDelete(req.params.id, { session });
                });
            } finally {
                session.endSession();
            }
            res.json({ msg: 'Silindi' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
