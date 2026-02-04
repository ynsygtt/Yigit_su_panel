const mongoose = require('mongoose');

const BulkSaleSchema = new mongoose.Schema({
  customer: {
    _id: mongoose.Schema.Types.ObjectId,
    name: String,
    contact: String
  },
  items: [{
    product: {
      _id: mongoose.Schema.Types.ObjectId,
      name: String,
      category: String,
      salePrice: Number
    },
    quantity: Number,
    unitPrice: Number,
    totalPrice: Number,
    delivered: {
      type: Number,
      default: 0
    }
  }],
  totalAmount: Number,
  paymentMethod: String,
  remainingDelivery: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Bekleme', 'Kısmi Teslim', 'Tamamlandı'],
    default: 'Bekleme'
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('BulkSale', BulkSaleSchema);
