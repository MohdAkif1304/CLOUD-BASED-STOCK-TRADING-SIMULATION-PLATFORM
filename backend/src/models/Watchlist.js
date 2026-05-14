const mongoose = require('mongoose');
const WatchlistSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  symbol:      { type: String, required: true, uppercase: true },
  companyName: { type: String, default: '' },
}, { timestamps: true });
WatchlistSchema.index({ user: 1, symbol: 1 }, { unique: true });
module.exports = mongoose.model('Watchlist', WatchlistSchema);