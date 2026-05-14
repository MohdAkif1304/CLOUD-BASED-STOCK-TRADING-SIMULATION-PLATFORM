const mongoose = require('mongoose');
const TradeSchema = new mongoose.Schema({
  buyOrder:    { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  sellOrder:   { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  buyer:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  seller:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  symbol:      { type: String, required: true, uppercase: true },
  companyName: { type: String, default: '' },
  quantity:    { type: Number, required: true },
  price:       { type: Number, required: true },
  totalValue:  { type: Number, required: true },
}, { timestamps: true });
module.exports = mongoose.model('Trade', TradeSchema);