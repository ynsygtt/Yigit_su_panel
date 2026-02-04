const mongoose = require('mongoose');

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  category: { type: String, default: 'Su' },
  unitPrice: { type: Number, default: 0 }, // Birim Fiyat (Maliyet)
  salePrice: { type: Number, default: 0 }, // Satış Fiyatı
  stock: { type: Number, default: 0 },
  unit: { type: String, default: 'Adet' }
});

ProductSchema.index({ name: 1 });

module.exports = mongoose.model('Product', ProductSchema);