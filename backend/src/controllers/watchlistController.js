const Watchlist = require('../models/Watchlist');
const { getPrice, getPriceCache } = require('../services/priceService');
const getWatchlist = async (req, res, next) => {
  try { const items = await Watchlist.find({ user: req.user._id }).sort({ createdAt: -1 });
    const cache = getPriceCache();
    res.json({ success: true, count: items.length, watchlist: items.map(i => ({ ...i.toObject(), quote: cache[i.symbol] || null })) });
  } catch (e) { next(e); }
};
const addToWatchlist = async (req, res, next) => {
  try {
    const { symbol, companyName } = req.body;
    if (!symbol) return res.status(400).json({ success: false, message: 'Symbol required.' });
    const sym = symbol.toUpperCase();
    if (await Watchlist.findOne({ user: req.user._id, symbol: sym }))
      return res.status(400).json({ success: false, message: sym + ' already in watchlist.' });
    let name = companyName;
    if (!name) { const q = await getPrice(sym); name = q?.name || sym; }
    const item = await Watchlist.create({ user: req.user._id, symbol: sym, companyName: name });
    res.status(201).json({ success: true, item });
  } catch (e) { next(e); }
};
const removeFromWatchlist = async (req, res, next) => {
  try {
    const sym = req.params.symbol.toUpperCase();
    const d = await Watchlist.findOneAndDelete({ user: req.user._id, symbol: sym });
    if (!d) return res.status(404).json({ success: false, message: 'Not in watchlist.' });
    res.json({ success: true, message: sym + ' removed.' });
  } catch (e) { next(e); }
};
module.exports = { getWatchlist, addToWatchlist, removeFromWatchlist };