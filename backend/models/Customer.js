const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, default: '' },
  note: { type: String, default: '' }
});

CustomerSchema.index({ name: 1 });

module.exports = mongoose.model('Customer', CustomerSchema);
