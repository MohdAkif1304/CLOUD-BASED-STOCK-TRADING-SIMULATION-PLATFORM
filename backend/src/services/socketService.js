let io;
const init = (instance) => {
  io = instance;
  io.on('connection', socket => {
    console.log('🔌 Connected:', socket.id);
    socket.on('subscribe:symbol',   sym => socket.join('sym:' + sym.toUpperCase()));
    socket.on('unsubscribe:symbol', sym => socket.leave('sym:' + sym.toUpperCase()));
    socket.on('disconnect', () => console.log('🔌 Disconnected:', socket.id));
  });
};
const emit             = (ev, data) => io && io.emit(ev, data);
const broadcastPriceUpdate    = data  => emit('prices:update', data);
const broadcastNewOrder       = order => emit('order:new', order);
const broadcastOrderUpdate    = order => emit('order:updated', order);
const broadcastTradeExecution = trade => emit('trade:executed', trade);
module.exports = { init, broadcastPriceUpdate, broadcastNewOrder, broadcastOrderUpdate, broadcastTradeExecution };