const Order       = require('../models/Order');
const User        = require('../models/User');
const Portfolio   = require('../models/Portfolio');
const { matchOrder }   = require('../services/matchingEngine');
const socketSvc        = require('../services/socketService');
const { getPrice }     = require('../services/priceService');

const placeOrder = async (req, res, next) => {
  try {
    const { symbol, type, quantity, price, companyName } = req.body;
    if (!symbol || !type || !quantity || !price)
      return res.status(400).json({ success: false, message: 'symbol, type, quantity, price are required.' });
    const t  = type.toUpperCase();
    const q  = parseInt(quantity);
    const p  = parseFloat(price);
    if (!['BUY','SELL'].includes(t))  return res.status(400).json({ success: false, message: 'type must be BUY or SELL.' });
    if (isNaN(q) || q < 1)            return res.status(400).json({ success: false, message: 'Quantity must be >= 1.' });
    if (isNaN(p) || p <= 0)           return res.status(400).json({ success: false, message: 'Price must be > 0.' });

    const user = await User.findById(req.user._id);
    if (t === 'BUY' && user.walletBalance < q * p)
      return res.status(400).json({ success: false, message: `Insufficient balance. Need ₹${(q*p).toFixed(2)}, have ₹${user.walletBalance.toFixed(2)}` });

    if (t === 'SELL') {
      const h = await Portfolio.findOne({ user: req.user._id, symbol: symbol.toUpperCase() });
      if (!h || h.quantity < q)
        return res.status(400).json({ success: false, message: h ? `Only ${h.quantity} shares available to sell.` : 'You have no shares of ' + symbol.toUpperCase() + '. Buy first!' });
    }

    const live = await getPrice(symbol.toUpperCase());
    const order = await Order.create({
      user: req.user._id, symbol: symbol.toUpperCase(),
      companyName: companyName || live?.name || '', type: t,
      quantity: q, remainingQuantity: q, price: p,
      marketPrice: live?.price || p, status: 'OPEN',
    });

    socketSvc.broadcastNewOrder(order.toObject());
    const trades = await matchOrder(order);
    socketSvc.broadcastOrderUpdate(order.toObject());

    const fresh = await User.findById(req.user._id);
    res.status(201).json({ success: true, message: `Order placed. ${trades.length} trade(s) executed.`,
      order: order.toObject(), tradesExecuted: trades.length, walletBalance: fresh.walletBalance });
  } catch (e) { next(e); }
};

const getMyOrders = async (req, res, next) => {
  try {
    const { symbol, status, type, page = 1, limit = 20 } = req.query;
    const filter = { user: req.user._id };
    if (symbol) filter.symbol = symbol.toUpperCase();
    if (status) filter.status = status.toUpperCase();
    if (type)   filter.type   = type.toUpperCase();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
      Order.countDocuments(filter),
    ]);
    res.json({ success: true, count: orders.length, total, page: parseInt(page), pages: Math.ceil(total / parseInt(limit)), orders });
  } catch (e) { next(e); }
};

const getAllOrders = async (req, res, next) => {
  try {
    const { symbol, limit = 50 } = req.query;
    const filter = { status: { $in: ['OPEN','PARTIAL'] } };
    if (symbol) filter.symbol = symbol.toUpperCase();
    const orders = await Order.find(filter).populate('user', 'name').sort({ createdAt: -1 }).limit(parseInt(limit));
    res.json({ success: true, count: orders.length, orders });
  } catch (e) { next(e); }
};

const getOrderById = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    res.json({ success: true, order });
  } catch (e) { next(e); }
};

const cancelOrder = async (req, res, next) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
    if (!['OPEN','PARTIAL'].includes(order.status))
      return res.status(400).json({ success: false, message: `Cannot cancel ${order.status} order.` });
    order.status = 'CANCELLED'; await order.save();
    socketSvc.broadcastOrderUpdate(order.toObject());
    res.json({ success: true, message: 'Order cancelled.', order });
  } catch (e) { next(e); }
};
module.exports = { placeOrder, getMyOrders, getAllOrders, getOrderById, cancelOrder };