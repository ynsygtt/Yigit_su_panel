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
            if (items && items.length > 0) {
                for (const item of items) {
                    const product = await Product.findById(item.productId);
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
                        { $inc: { stock: -item.quantity } }
                    );
                }
            }

            const createdOrder = await new Order({
                customerName,
                customerId,
                items,
                totalAmount,
                paymentMethod,
                date: Date.now()
            }).save();

            res.json(createdOrder);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.put('/:id', async (req, res) => {
        const applyUpdate = async (session) => {
            const { date, ...safeBody } = req.body;
            const findOptions = session ? { session } : {};
            const updateOptions = session ? { new: true, session } : { new: true };

            const existingOrder = await Order.findById(req.params.id, null, findOptions);
            if (!existingOrder) {
                const notFoundError = new Error('Sipariş bulunamadı');
                notFoundError.status = 404;
                throw notFoundError;
            }

            const oldItems = Array.isArray(existingOrder.items) ? existingOrder.items : [];
            const newItems = Array.isArray(safeBody.items) ? safeBody.items : oldItems;

            const buildQtyMap = (items) => items.reduce((acc, item) => {
                const productId = item?.productId;
                if (!productId) return acc;
                const qty = Number(item.quantity) || 0;
                acc[productId] = (acc[productId] || 0) + qty;
                return acc;
            }, {});

            const oldQtyMap = buildQtyMap(oldItems);
            const newQtyMap = buildQtyMap(newItems);
            const allProductIds = new Set([
                ...Object.keys(oldQtyMap),
                ...Object.keys(newQtyMap)
            ]);

            for (const productId of allProductIds) {
                const delta = (newQtyMap[productId] || 0) - (oldQtyMap[productId] || 0);
                if (delta <= 0) continue;
                const product = await Product.findById(productId, null, findOptions);
                if (!product) {
                    throw new Error(`Ürün bulunamadı: ${productId}`);
                }
                if (product.stock < delta) {
                    throw new Error(`${product.name} için stok yetersiz. Mevcut: ${product.stock}, İstenen: ${delta}`);
                }
            }

            for (const productId of allProductIds) {
                const delta = (newQtyMap[productId] || 0) - (oldQtyMap[productId] || 0);
                if (delta === 0) continue;
                await Product.findByIdAndUpdate(
                    productId,
                    { $inc: { stock: -delta } },
                    findOptions
                );
            }

            return Order.findByIdAndUpdate(
                req.params.id,
                { ...safeBody, items: newItems },
                updateOptions
            );
        };

        let session = null;
        try {
            session = await Order.startSession();
            let updatedOrder = null;
            try {
                await session.withTransaction(async () => {
                    updatedOrder = await applyUpdate(session);
                });
            } catch (err) {
                const message = err?.message || '';
                if (message.includes('Transaction numbers are only allowed')) {
                    updatedOrder = await applyUpdate(null);
                } else {
                    throw err;
                }
            }

            if (!updatedOrder) {
                return res.status(404).json({ error: 'Sipariş bulunamadı' });
            }
            res.json(updatedOrder);
        } catch (err) {
            res.status(err.status || 400).json({ error: err.message });
        } finally {
            if (session) session.endSession();
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
        const applyDelete = async (session) => {
            const findOptions = session ? { session } : {};
            const updateOptions = session ? { session } : {};

            const order = await Order.findById(req.params.id, null, findOptions);
            if (!order) {
                const notFoundError = new Error('Sipariş bulunamadı');
                notFoundError.status = 404;
                throw notFoundError;
            }

            if (order.status !== 'Teslim Edildi' && Array.isArray(order.items) && order.items.length > 0) {
                for (const item of order.items) {
                    await Product.findByIdAndUpdate(
                        item.productId,
                        { $inc: { stock: +item.quantity } },
                        updateOptions
                    );
                }
            }

            await Order.findByIdAndDelete(req.params.id, updateOptions);
        };

        let session = null;
        try {
            session = await Order.startSession();
            try {
                await session.withTransaction(async () => {
                    await applyDelete(session);
                });
            } catch (err) {
                const message = err?.message || '';
                if (message.includes('Transaction numbers are only allowed')) {
                    await applyDelete(null);
                } else {
                    throw err;
                }
            }
            res.json({ msg: 'Silindi' });
        } catch (err) {
            res.status(err.status || 500).json({ error: err.message });
        } finally {
            if (session) session.endSession();
        }
    });

    return router;
};
