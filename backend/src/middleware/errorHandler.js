const errorHandler = (err, req, res, next) => {
  if (process.env.NODE_ENV === 'development') console.error(err);
  if (err.name === 'CastError')
    return res.status(404).json({ success: false, message: `Not found: ${err.value}` });
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({ success: false, message: `${field} already exists.` });
  }
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message).join('. ');
    return res.status(400).json({ success: false, message: messages });
  }
  res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Server Error' });
};
module.exports = errorHandler;