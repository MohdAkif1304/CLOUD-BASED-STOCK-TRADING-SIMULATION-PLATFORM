// src/services/matchingEngine.js
// SIMULATION FILL: auto-fills unmatched orders so single user can buy then sell
const Order       = require('../models/Order');
const Trade       = require('../models/Trade');
const Transaction = require('../models/Transaction');
const Portfolio   = require('../models/Portfolio');
const User        = require('../models/User');
const socketSvc   = require('./socketService');

const updatePortfolio = async (userId, symbol, companyName, qty, price, side) => {
  if (!userId) return;
  let p = await Portfolio.findOne({ user: userId, symbol });
  if (side === 'BUY') {
    if (!p) {
      await Portfolio.create({ user: userId, symbol, companyName: companyName || '', quantity: qty, averageBuyPrice: price, totalInvested: qty * price });
    } else {
      const newTotal = p.totalInvested + qty * price;
      const newQty   = p.quantity + qty;
      p.quantity = newQty; p.totalInvested = newTotal; p.averageBuyPrice = newTotal / newQty;
      if (companyName) p.companyName = companyName;
      await p.save();
    }
  } else if (p) {
    p.quantity    -= qty;
    p.totalInvested = p.averageBuyPrice * p.quantity;
    if (p.quantity <= 0) await Portfolio.deleteOne({ _id: p._id });
    else await p.save();
  }
};

const simulationFill = async (order) => {
  try {
    const qty = order.remainingQuantity, price = order.price, total = qty * price;
    const user = await User.findById(order.user);
    if (!user) return null;

    if (order.type === 'BUY') {
      // Reload fresh balance in case other operations changed it
      const freshUser = await User.findById(order.user);
      if (freshUser.walletBalance < total) return null; // not enough funds
    }

    if (order.type === 'SELL') {
      const holding = await Portfolio.findOne({ user: order.user, symbol: order.symbol });
      if (!holding || holding.quantity < qty) {
        order.status = 'CANCELLED';
        return null;
      }
    }

    const trade = await Trade.create({
      buyOrder: order._id, sellOrder: order._id,
      buyer:  order.type === 'BUY'  ? order.user : null,
      seller: order.type === 'SELL' ? order.user : null,
      symbol: order.symbol, companyName: order.companyName || '',
      quantity: qty, price, totalValue: total,
    });

    order.remainingQuantity = 0;
    order.status = 'FILLED';

    const freshUser = await User.findById(order.user);
    if (order.type === 'BUY') {
      freshUser.walletBalance -= total;
      await freshUser.save();
      await Transaction.create({ user: freshUser._id, type: 'DEBIT', amount: total, balanceAfter: freshUser.walletBalance,
        description: `Bought ${qty} × ${order.symbol} @ ₹${price}`, relatedTrade: trade._id, relatedOrder: order._id });
      await updatePortfolio(freshUser._id, order.symbol, order.companyName, qty, price, 'BUY');
    } else {
      freshUser.walletBalance += total;
      await freshUser.save();
      await Transaction.create({ user: freshUser._id, type: 'CREDIT', amount: total, balanceAfter: freshUser.walletBalance,
        description: `Sold ${qty} × ${order.symbol} @ ₹${price}`, relatedTrade: trade._id, relatedOrder: order._id });
      await updatePortfolio(freshUser._id, order.symbol, order.companyName, qty, price, 'SELL');
    }

    socketSvc.broadcastTradeExecution(trade.toObject());
    return trade;
  } catch (e) { console.error('simulationFill error:', e.message); return null; }
};

const matchOrder = async (incomingOrder) => {
  const trades = [];
  const oppositeType = incomingOrder.type === 'BUY' ? 'SELL' : 'BUY';
  const query = {
    symbol: incomingOrder.symbol, type: oppositeType,
    status: { $in: ['OPEN','PARTIAL'] }, user: { $ne: incomingOrder.user },
  };
  if (incomingOrder.type === 'BUY')  query.price = { $lte: incomingOrder.price };
  else                                query.price = { $gte: incomingOrder.price };

  const candidates = await Order.find(query).sort({ price: incomingOrder.type === 'BUY' ? 1 : -1, createdAt: 1 });

  for (const candidate of candidates) {
    if (incomingOrder.remainingQuantity <= 0) break;
    const matchedQty = Math.min(incomingOrder.remainingQuantity, candidate.remainingQuantity);
    const execPrice  = candidate.price;
    const tradeVal   = matchedQty * execPrice;
    const isBuy      = incomingOrder.type === 'BUY';
    const buyOrder   = isBuy ? incomingOrder : candidate;
    const sellOrder  = isBuy ? candidate     : incomingOrder;

    const trade = await Trade.create({
      buyOrder: buyOrder._id, sellOrder: sellOrder._id,
      buyer: buyOrder.user, seller: sellOrder.user,
      symbol: incomingOrder.symbol, companyName: incomingOrder.companyName || '',
      quantity: matchedQty, price: execPrice, totalValue: tradeVal,
    });
    trades.push(trade);

    incomingOrder.remainingQuantity -= matchedQty;
    incomingOrder.status = incomingOrder.remainingQuantity === 0 ? 'FILLED' : 'PARTIAL';
    candidate.remainingQuantity  -= matchedQty;
    candidate.status = candidate.remainingQuantity === 0 ? 'FILLED' : 'PARTIAL';
    await candidate.save();

    const [buyer, seller] = await Promise.all([User.findById(buyOrder.user), User.findById(sellOrder.user)]);
    buyer.walletBalance  -= tradeVal; await buyer.save();
    seller.walletBalance += tradeVal; await seller.save();

    await Promise.all([
      Transaction.create({ user: buyer._id, type: 'DEBIT', amount: tradeVal, balanceAfter: buyer.walletBalance,
        description: `Bought ${matchedQty} × ${incomingOrder.symbol} @ ₹${execPrice}`, relatedTrade: trade._id, relatedOrder: buyOrder._id }),
      Transaction.create({ user: seller._id, type: 'CREDIT', amount: tradeVal, balanceAfter: seller.walletBalance,
        description: `Sold ${matchedQty} × ${incomingOrder.symbol} @ ₹${execPrice}`, relatedTrade: trade._id, relatedOrder: sellOrder._id }),
    ]);

    await updatePortfolio(buyOrder.user,  incomingOrder.symbol, incomingOrder.companyName, matchedQty, execPrice, 'BUY');
    await updatePortfolio(sellOrder.user, incomingOrder.symbol, incomingOrder.companyName, matchedQty, execPrice, 'SELL');
    socketSvc.broadcastTradeExecution({ ...trade.toObject() });
    socketSvc.broadcastOrderUpdate(candidate.toObject());
  }

  // Auto-fill remaining quantity if no counterparty (simulation mode)
  if (incomingOrder.remainingQuantity > 0 && ['OPEN','PARTIAL'].includes(incomingOrder.status)) {
    const simTrade = await simulationFill(incomingOrder);
    if (simTrade) trades.push(simTrade);
  }

  await incomingOrder.save();
  return trades;
};

module.exports = { matchOrder };
