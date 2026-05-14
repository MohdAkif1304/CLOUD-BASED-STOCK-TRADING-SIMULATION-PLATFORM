// src/services/priceService.js
// Uses Finnhub (free API) with full simulation fallback
// Get free key: https://finnhub.io/register — instant, no card needed
const axios = require('axios');
const socketService = require('./socketService');
const Portfolio = require('../models/Portfolio');
const Watchlist  = require('../models/Watchlist');

const FINNHUB_KEY = process.env.FINNHUB_API_KEY || '';
const BASE = 'https://finnhub.io/api/v1';

let priceCache = {};

const STOCKS = {
  'AAPL':      { name: 'Apple Inc.',           price: 189.30, currency: 'USD', exchange: 'NASDAQ' },
  'TSLA':      { name: 'Tesla Inc.',            price: 177.80, currency: 'USD', exchange: 'NASDAQ' },
  'GOOGL':     { name: 'Alphabet Inc.',         price: 175.50, currency: 'USD', exchange: 'NASDAQ' },
  'MSFT':      { name: 'Microsoft Corp.',       price: 415.20, currency: 'USD', exchange: 'NASDAQ' },
  'AMZN':      { name: 'Amazon.com Inc.',       price: 197.90, currency: 'USD', exchange: 'NASDAQ' },
  'META':      { name: 'Meta Platforms',        price: 510.60, currency: 'USD', exchange: 'NASDAQ' },
  'NVDA':      { name: 'NVIDIA Corporation',    price: 875.40, currency: 'USD', exchange: 'NASDAQ' },
  'NFLX':      { name: 'Netflix Inc.',          price: 628.00, currency: 'USD', exchange: 'NASDAQ' },
  'AMD':       { name: 'Advanced Micro Dev.',   price: 160.20, currency: 'USD', exchange: 'NASDAQ' },
  'INTC':      { name: 'Intel Corporation',     price: 31.40,  currency: 'USD', exchange: 'NASDAQ' },
  'RELIANCE':  { name: 'Reliance Industries',   price: 2891.00,currency: 'INR', exchange: 'NSE'   },
  'TCS':       { name: 'Tata Consultancy Svcs', price: 3742.00,currency: 'INR', exchange: 'NSE'   },
  'INFY':      { name: 'Infosys Ltd.',          price: 1498.00,currency: 'INR', exchange: 'NSE'   },
  'HDFCBANK':  { name: 'HDFC Bank Ltd.',        price: 1620.00,currency: 'INR', exchange: 'NSE'   },
  'WIPRO':     { name: 'Wipro Ltd.',            price: 467.00, currency: 'INR', exchange: 'NSE'   },
};

const DEFAULT_SYMBOLS = Object.keys(STOCKS);

// Realistic random-walk simulation
const simulatePrice = (sym) => {
  const ex  = priceCache[sym];
  const seed = STOCKS[sym];
  const base = ex ? ex.price : (seed?.price || 100);
  const prev = ex?.previousClose || base;
  const pct  = (Math.random() * 0.016) - 0.008;
  const price = parseFloat(Math.max(0.01, base * (1 + pct)).toFixed(2));
  const change = parseFloat((price - prev).toFixed(2));
  const changePct = parseFloat(((change / prev) * 100).toFixed(2));
  return {
    symbol: sym, name: seed?.name || sym, price,
    previousClose: prev, change, changePercent: changePct,
    high:   parseFloat((Math.max(ex?.high || price, price)).toFixed(2)),
    low:    parseFloat((Math.min(ex?.low  || price, price)).toFixed(2)),
    open:   ex?.open || price,
    volume: Math.floor(Math.random() * 8000000) + 200000,
    marketCap: 0,
    fiftyTwoWeekHigh: parseFloat((price * 1.35).toFixed(2)),
    fiftyTwoWeekLow:  parseFloat((price * 0.65).toFixed(2)),
    currency: seed?.currency || 'USD',
    exchange: seed?.exchange || '',
    timestamp: Date.now(), source: 'simulation',
  };
};

// Fetch single quote from Finnhub
const finnhubQuote = async (symbol) => {
  try {
    const { data: d } = await axios.get(`${BASE}/quote`, { params: { symbol, token: FINNHUB_KEY }, timeout: 5000 });
    if (!d || !d.c || d.c === 0) return null;
    const seed = STOCKS[symbol] || {};
    return {
      symbol, name: seed.name || symbol,
      price:         parseFloat(d.c.toFixed(2)),
      previousClose: parseFloat((d.pc || d.c).toFixed(2)),
      change:        parseFloat((d.d  || 0).toFixed(2)),
      changePercent: parseFloat((d.dp || 0).toFixed(2)),
      high:          parseFloat((d.h  || d.c).toFixed(2)),
      low:           parseFloat((d.l  || d.c).toFixed(2)),
      open:          parseFloat((d.o  || d.c).toFixed(2)),
      volume: 0, marketCap: 0,
      fiftyTwoWeekHigh: parseFloat((d.c * 1.3).toFixed(2)),
      fiftyTwoWeekLow:  parseFloat((d.c * 0.7).toFixed(2)),
      currency: seed.currency || 'USD', exchange: seed.exchange || '',
      timestamp: Date.now(), source: 'finnhub',
    };
  } catch { return null; }
};

// Generate simulated OHLCV history
const generateHistory = (symbol, days = 30) => {
  const base  = priceCache[symbol]?.price || STOCKS[symbol]?.price || 100;
  const data  = [];
  let   price = base * (1 - days * 0.002);
  const now   = Date.now();
  for (let i = days; i >= 0; i--) {
    const t     = now - i * 86400000;
    const open  = price;
    const close = parseFloat(Math.max(0.01, open * (1 + (Math.random() * 0.05 - 0.022))).toFixed(2));
    const high  = parseFloat((Math.max(open, close) * (1 + Math.random() * 0.015)).toFixed(2));
    const low   = parseFloat((Math.min(open, close) * (1 - Math.random() * 0.015)).toFixed(2));
    data.push({ time: t, open: parseFloat(open.toFixed(2)), high, low, close, volume: Math.floor(Math.random() * 5000000) + 100000 });
    price = close;
  }
  return data;
};

// Fetch Finnhub candles
const finnhubCandles = async (symbol, range, interval) => {
  try {
    const to   = Math.floor(Date.now() / 1000);
    const from = to - range * 86400;
    const res  = interval === '1wk' ? 'W' : 'D';
    const { data: d } = await axios.get(`${BASE}/stock/candle`, {
      params: { symbol, from, to, resolution: res, token: FINNHUB_KEY }, timeout: 8000,
    });
    if (!d || d.s !== 'ok' || !d.t?.length) return null;
    return d.t.map((t, i) => ({
      time:   t * 1000,
      open:   parseFloat((d.o[i] || 0).toFixed(2)),
      high:   parseFloat((d.h[i] || 0).toFixed(2)),
      low:    parseFloat((d.l[i] || 0).toFixed(2)),
      close:  parseFloat((d.c[i] || 0).toFixed(2)),
      volume: d.v[i] || 0,
    }));
  } catch { return null; }
};

const getPrice = async (symbol) => {
  if (priceCache[symbol]) return priceCache[symbol];
  if (FINNHUB_KEY) { const r = await finnhubQuote(symbol); if (r) { priceCache[symbol] = r; return r; } }
  const sim = simulatePrice(symbol);
  priceCache[symbol] = sim;
  return sim;
};

const getPriceCache = () => priceCache;

const getHistoricalData = async (symbol, range = 30, interval = '1d') => {
  if (FINNHUB_KEY) { const r = await finnhubCandles(symbol, range, interval); if (r) return r; }
  return generateHistory(symbol, range);
};

const searchSymbols = async (query) => {
  if (FINNHUB_KEY) {
    try {
      const { data } = await axios.get(`${BASE}/search`, { params: { q: query, token: FINNHUB_KEY }, timeout: 5000 });
      const res = (data?.result || []).filter(r => r.type === 'Common Stock').slice(0, 8)
        .map(r => ({ symbol: r.symbol, name: r.description || r.symbol, exchange: r.primaryExchange || '', type: 'EQUITY' }));
      if (res.length > 0) return res;
    } catch {}
  }
  const q = query.toUpperCase();
  return Object.entries(STOCKS).filter(([s, i]) => s.includes(q) || i.name.toUpperCase().includes(q))
    .slice(0, 8).map(([symbol, info]) => ({ symbol, name: info.name, exchange: info.exchange, type: 'EQUITY' }));
};

const fetchQuotes = async (symbols) => {
  const out = {};
  for (const s of (symbols || [])) out[s] = await getPrice(s);
  return out;
};

const updatePrices = async () => {
  try {
    const ps = await Portfolio.distinct('symbol').catch(() => []);
    const ws = await Watchlist.distinct('symbol').catch(() => []);
    const symbols = [...new Set([...DEFAULT_SYMBOLS, ...ps, ...ws])];
    const results = {};
    if (FINNHUB_KEY) {
      for (const sym of symbols) {
        const r = await finnhubQuote(sym);
        results[sym] = r || simulatePrice(sym);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } else {
      symbols.forEach(sym => { results[sym] = simulatePrice(sym); });
    }
    priceCache = { ...priceCache, ...results };
    socketService.broadcastPriceUpdate(priceCache);
  } catch (e) { console.error('Price update error:', e.message); }
};

const startPriceService = () => {
  const interval = parseInt(process.env.PRICE_UPDATE_INTERVAL) || 15;
  const mode = FINNHUB_KEY ? '🟢 LIVE via Finnhub' : '🟡 SIMULATION (add FINNHUB_API_KEY for live data)';
  console.log(`📡 Price service: ${mode} — every ${interval}s`);
  setTimeout(updatePrices, 800);
  setInterval(updatePrices, interval * 1000);
};

module.exports = { startPriceService, getPrice, getPriceCache, getHistoricalData, searchSymbols, fetchQuotes, generateHistory };
