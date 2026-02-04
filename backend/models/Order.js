const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  customerName: { type: String, required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
  items: [{
      productName: String,
      productId: String,
      quantity: Number,
      price: Number,
      total: Number 
  }],
  totalAmount: Number,
  status: { type: String, default: 'Hazırlanıyor' },
  paymentMethod: { type: String, default: '-' },
  note: { type: String, default: '' }, // Manuel borç açıklaması için eklendi
  date: { type: Date, default: Date.now }
});

OrderSchema.index({ date: -1 });

module.exports = mongoose.model('Order', OrderSchema);
