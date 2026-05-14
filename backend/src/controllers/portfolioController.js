const Portfolio = require('../models/Portfolio');
const Trade     = require('../models/Trade');
const { getPrice, getPriceCache } = require('../services/priceService');
const getPortfolio = async (req, res, next) => {
  try {
    const holdings = await Portfolio.find({ user: req.user._id });
    const cache    = getPriceCache();
    const enriched = await Promise.all(holdings.map(async (h) => {
      let cp = cache[h.symbol]?.price;
      if (!cp) { const f = await getPrice(h.symbol); cp = f?.price || h.averageBuyPrice; }
      const cv  = h.quantity * cp;
      const pnl = cv - h.totalInvested;
      return { _id: h._id, symbol: h.symbol, companyName: h.companyName, quantity: h.quantity,
        averageBuyPrice: h.averageBuyPrice, totalInvested: h.totalInvested, currentPrice: cp,
        currentValue: cv, unrealizedPnL: pnl,
        unrealizedPnLPercent: h.totalInvested > 0 ? parseFloat(((pnl/h.totalInvested)*100).toFixed(2)) : 0,
        liveData: cache[h.symbol] || null };
    }));
    const ti = enriched.reduce((s, h) => s + h.totalInvested, 0);
    const cv = enriched.reduce((s, h) => s + h.currentValue, 0);
    const pnl = cv - ti;
    res.json({ success: true, count: enriched.length,
      summary: { totalInvested: ti, totalCurrentValue: cv, totalUnrealizedPnL: pnl,
        totalUnrealizedPnLPercent: ti > 0 ? parseFloat(((pnl/ti)*100).toFixed(2)) : 0 },
      holdings: enriched });
  } catch (e) { next(e); }
};
const getTradeHistory = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, symbol } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const filter = { $or: [{ buyer: req.user._id }, { seller: req.user._id }] };
    if (symbol) filter.symbol = symbol.toUpperCase();
    const [trades, total] = await Promise.all([
      Trade.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))
        .populate('buyer','name').populate('seller','name'),
      Trade.countDocuments(filter),
    ]);
    const annotated = trades.map(t => ({ ...t.toObject(),
      userSide: t.buyer?._id?.toString() === req.user._id.toString() ? 'BUY' : 'SELL' }));
    res.json({ success: true, count: trades.length, total, page: parseInt(page), pages: Math.ceil(total/parseInt(limit)), trades: annotated });
  } catch (e) { next(e); }
};
module.exports = { getPortfolio, getTradeHistory };