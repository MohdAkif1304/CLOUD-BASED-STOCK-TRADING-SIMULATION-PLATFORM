const mongoose = require('mongoose');
const TxSchema = new mongoose.Schema({
  user:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type:         { type: String, enum: ['CREDIT','DEBIT'], required: true },
  amount:       { type: Number, required: true },
  balanceAfter: { type: Number, required: true },
  description:  { type: String, required: true },
  relatedTrade: { type: mongoose.Schema.Types.ObjectId, ref: 'Trade', default: null },
  relatedOrder: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', default: null },
}, { timestamps: true });
TxSchema.index({ user: 1, createdAt: -1 });
module.exports = mongoose.model('Transaction', TxSchema);