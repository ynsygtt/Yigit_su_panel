const express = require('express');

module.exports = ({ Expense }) => {
    const router = express.Router();

    router.get('/', async (req, res) => {
        try {
            const expenses = await Expense.find().sort({ date: -1 });
            res.json(expenses);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    router.post('/', async (req, res) => {
        try {
            const { title, amount, category } = req.body;
            const newExpense = new Expense({
                title,
                amount,
                category,
                date: Date.now()
            });
            await newExpense.save();
            res.status(201).json(newExpense);
        } catch (err) {
            res.status(400).json(err);
        }
    });

    router.put('/:id', async (req, res) => {
        try {
            const { date, ...safeBody } = req.body;
            const updatedExpense = await Expense.findByIdAndUpdate(req.params.id, safeBody, { new: true });
            if (!updatedExpense) return res.status(404).json({ error: 'Gider kaydı bulunamadı' });
            res.json(updatedExpense);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    });

    router.delete('/:id', async (req, res) => {
        try {
            const deletedExpense = await Expense.findByIdAndDelete(req.params.id);
            if (!deletedExpense) return res.status(404).json({ error: 'Gider kaydı bulunamadı' });
            res.json({ msg: 'Gider kaydı silindi', expense: deletedExpense });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    return router;
};
