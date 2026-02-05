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
    enum: ['Bekleme', 'Kısmi Teslim', 'Tamamlandı', 'İptal'],
    default: 'Bekleme'
  },
  isCancelled: {
    type: Boolean,
    default: false
  },
  cancelledAt: {
    type: Date
  },
  cancelledRemainingQty: {
    type: Number,
    default: 0
  },
  cancelledRemainingValue: {
    type: Number,
    default: 0
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
