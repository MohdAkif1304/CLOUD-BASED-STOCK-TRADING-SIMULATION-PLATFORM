const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const UserSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:      { type: String, required: true, minlength: 6, select: false },
  walletBalance: { type: Number, default: parseFloat(process.env.INITIAL_WALLET_BALANCE) || 100000 },
  role:          { type: String, enum: ['user','admin'], default: 'user' },
}, { timestamps: true });
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});
UserSchema.methods.matchPassword = async function(p) { return bcrypt.compare(p, this.password); };
module.exports = mongoose.model('User', UserSchema);