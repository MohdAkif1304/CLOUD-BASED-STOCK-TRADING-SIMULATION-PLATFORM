# TradeSimX v3 — Stock Trading Simulation Platform

## Quick Start (3 steps)

### Step 1 — Start MongoDB
```bash
# macOS:   brew services start mongodb-community
# Ubuntu:  sudo systemctl start mongod
# Windows: run mongod.exe
```

### Step 2 — Backend
```bash
cd backend
npm install
npm run dev
```
You'll see: `TradeSimX v3 — Running on port 5000`

### Step 3 — Frontend (new terminal)
```bash
cd frontend
npm install
npm run dev
```
Open: http://localhost:5173

## Live Stock Prices (Optional)
Get a FREE Finnhub API key at https://finnhub.io/register (no credit card needed).
Add it to `backend/.env`:
```
FINNHUB_API_KEY=your_key_here
```
Without the key, the app uses realistic simulated prices that update every 15s.

## Features
- Live price charts (1W / 1M / 3M / 6M / 1Y)
- Market Watch with real/simulated prices
- Portfolio doughnut + bar charts
- Order matching engine (auto-fills for single user)
- Real-time Socket.io updates
- Watchlist with live prices
- Wallet ledger with activity chart

## Stack
React 18 · Node.js · Express · MongoDB · Socket.io · JWT · Chart.js · Finnhub API
