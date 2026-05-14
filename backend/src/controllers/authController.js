const jwt  = require('jsonwebtoken');
const User = require('../models/User');
const token = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
const send  = (user, code, res) => res.status(code).json({ success: true, token: token(user._id),
  user: { _id: user._id, name: user.name, email: user.email, walletBalance: user.walletBalance, role: user.role, createdAt: user.createdAt } });
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ success: false, message: 'All fields required.' });
    if (await User.findOne({ email })) return res.status(400).json({ success: false, message: 'Email already registered.' });
    const user = await User.create({ name, email, password });
    send(user, 201, res);
  } catch (e) { next(e); }
};
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, message: 'Email and password required.' });
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.matchPassword(password))) return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    send(user, 200, res);
  } catch (e) { next(e); }
};
const getMe = async (req, res, next) => {
  try { const user = await User.findById(req.user._id); res.json({ success: true, user }); } catch (e) { next(e); }
};
module.exports = { register, login, getMe };