const express = require('express');

module.exports = ({ Product, Expense }) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const page = parseInt(req.query.page, 10);
            const limit = parseInt(req.query.limit, 10);
            const usePagination = Number.isInteger(page) && Number.isInteger(limit) && page > 0 && limit > 0;

            if (usePagination) {
                const skip = (page - 1) * limit;
                const [products, total] = await Promise.all([
                    Product.find().skip(skip).limit(limit),
                    Product.countDocuments()
                ]);
                return res.json({
                    data: products,
                    pagination: {
                        page,
                        limit,
                        total,
                        totalPages: Math.ceil(total / limit)
                    }
                });
            }

            const products = await Product.find();
            res.json(products);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const newProduct = await new Product(req.body).save();
            res.json(newProduct);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (!updatedProduct) return res.status(404).json({ error: 'Ürün bulunamadı' });
            res.json(updatedProduct);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const product = await Product.findById(req.params.id);
            if (!product) return res.status(404).json({ error: 'Ürün bulunamadı' });

            if (product.stock > 0) {
                return res.status(400).json({ error: `Bu ürünün stokta ${product.stock} adedi var. Stokta ürün varken silinemez.` });
            }

            await Product.findByIdAndDelete(req.params.id);
            res.json({ msg: 'Ürün silindi' });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/waste', async (req, res) => {
        try {
            const { productId, quantity, reason } = req.body;
            const session = await Product.startSession();
            let updatedProduct;
            let newExpense;

            try {
                await session.withTransaction(async () => {
                    const product = await Product.findById(productId).session(session);

                    if (!product) throw new Error('Ürün bulunamadı');
                    if (product.stock < quantity) throw new Error('Stok yetersiz');

                    product.stock -= quantity;
                    updatedProduct = await product.save({ session });

                    const cost = (product.unitPrice || 0) * quantity;
                    newExpense = await Expense.create([{
                        title: `Zayi: ${product.name} (${reason})`,
                        amount: cost,
                        category: 'Zayi/Fire',
                        date: Date.now()
                    }], { session });
                });
            } finally {
                session.endSession();
            }

            res.json({ message: 'Zayi işlendi', product: updatedProduct, expense: newExpense?.[0] });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
