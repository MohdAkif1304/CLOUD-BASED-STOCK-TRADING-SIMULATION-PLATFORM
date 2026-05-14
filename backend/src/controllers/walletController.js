const User        = require('../models/User');
const Transaction = require('../models/Transaction');
const getWallet = async (req, res, next) => {
  try { const user = await User.findById(req.user._id).select('walletBalance name email');
    res.json({ success: true, walletBalance: user.walletBalance, user: { name: user.name, email: user.email } });
  } catch (e) { next(e); }
};
const addFunds = async (req, res, next) => {
  try {
    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) return res.status(400).json({ success: false, message: 'Enter a valid amount.' });
    if (amount > 1000000)       return res.status(400).json({ success: false, message: 'Max ₹10,00,000 per deposit.' });
    const user = await User.findById(req.user._id);
    user.walletBalance += amount; await user.save();
    const tx = await Transaction.create({ user: req.user._id, type: 'CREDIT', amount, balanceAfter: user.walletBalance,
      description: `Deposited ₹${amount.toLocaleString('en-IN')}` });
    res.json({ success: true, walletBalance: user.walletBalance, transaction: tx });
  } catch (e) { next(e); }
};
const getTransactions = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, type } = req.query;
    const filter = { user: req.user._id };
    if (type) filter.type = type.toUpperCase();
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [transactions, total, ca, da] = await Promise.all([
      Transaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit))
        .populate('relatedTrade','symbol quantity price').populate('relatedOrder','symbol type quantity price'),
      Transaction.countDocuments(filter),
      Transaction.aggregate([{ $match: { user: req.user._id, type: 'CREDIT' } }, { $group: { _id: null, t: { $sum: '$amount' } } }]),
      Transaction.aggregate([{ $match: { user: req.user._id, type: 'DEBIT'  } }, { $group: { _id: null, t: { $sum: '$amount' } } }]),
    ]);
    res.json({ success: true, count: transactions.length, total,
      page: parseInt(page), pages: Math.ceil(total / parseInt(limit)),
      summary: { totalCredits: ca[0]?.t || 0, totalDebits: da[0]?.t || 0 },
      transactions });
  } catch (e) { next(e); }
};
module.exports = { getWallet, addFunds, getTransactions };