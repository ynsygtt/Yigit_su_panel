const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  amount: Number,
  method: { type: String, default: 'Nakit' },
  date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', PaymentSchema);
