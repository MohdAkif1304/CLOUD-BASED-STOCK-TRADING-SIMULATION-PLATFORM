const mongoose = require('mongoose');
const PortfolioSchema = new mongoose.Schema({
  user:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbol:          { type: String, required: true, uppercase: true },
  companyName:     { type: String, default: '' },
  quantity:        { type: Number, required: true, min: 0 },
  averageBuyPrice: { type: Number, required: true },
  totalInvested:   { type: Number, required: true },
}, { timestamps: true });
PortfolioSchema.index({ user: 1, symbol: 1 }, { unique: true });
module.exports = mongoose.model('Portfolio', PortfolioSchema);