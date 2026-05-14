const mongoose = require('mongoose');
const OrderSchema = new mongoose.Schema({
  user:              { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbol:            { type: String, required: true, uppercase: true, trim: true },
  companyName:       { type: String, default: '' },
  type:              { type: String, enum: ['BUY','SELL'], required: true },
  quantity:          { type: Number, required: true, min: 1 },
  remainingQuantity: { type: Number, required: true },
  price:             { type: Number, required: true, min: 0.01 },
  marketPrice:       { type: Number, default: null },
  status:            { type: String, enum: ['OPEN','PARTIAL','FILLED','CANCELLED'], default: 'OPEN' },
}, { timestamps: true });
OrderSchema.index({ symbol: 1, type: 1, status: 1, price: 1, createdAt: 1 });
module.exports = mongoose.model('Order', OrderSchema);