// src/server.js
require('dotenv').config();
const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const connectDB  = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const socketSvc  = require('./services/socketService');
const { startPriceService } = require('./services/priceService');

connectDB();
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization'], credentials: true }));
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth',      require('./routes/auth'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/wallet',    require('./routes/wallet'));
app.use('/api/portfolio', require('./routes/portfolio'));
app.use('/api/stocks',    require('./routes/stocks'));
app.use('/api/watchlist', require('./routes/watchlist'));
app.get('/api/health', (_, res) => res.json({ success: true, message: 'TradeSimX v3 API 🚀', time: new Date().toISOString() }));
app.use((req, res) => res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found.` }));
app.use(errorHandler);

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_URL || 'http://localhost:5173', methods: ['GET','POST'], credentials: true },
  pingTimeout: 60000,
});
socketSvc.init(io);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║   TradeSimX v3 — Running on port ${PORT}    ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
  startPriceService();
});
process.on('unhandledRejection', (err) => { console.error('Unhandled:', err.message); httpServer.close(() => process.exit(1)); });
