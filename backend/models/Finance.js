const mongoose = require('mongoose');

const FinanceSchema = new mongoose.Schema({
    category: String,
    amount: Number,
    description: String,
    date: {
        type: Date,
        default: Date.now
    },
    isIncome: Boolean,
    paymentMethod: String,
    relatedOrder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    }
});

// Deprecated: Finance model kaldırıldı. Bu dosya geriye dönük temizlik için boş bırakıldı.
module.exports = null;
