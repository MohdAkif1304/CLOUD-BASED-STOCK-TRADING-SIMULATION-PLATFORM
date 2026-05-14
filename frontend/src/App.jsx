// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

import { AuthProvider }    from './context/AuthContext';
import ProtectedRoute      from './components/common/ProtectedRoute';
import Navbar              from './components/common/Navbar';

import Login               from './components/Auth/Login';
import Register            from './components/Auth/Register';
import Dashboard           from './components/Dashboard/Dashboard';
import TradingPanel        from './components/Dashboard/TradingPanel';
import OrdersList          from './components/Dashboard/OrdersList';
import Portfolio           from './components/Dashboard/Portfolio';
import WalletSection       from './components/Dashboard/WalletSection';
import Watchlist           from './components/Dashboard/Watchlist';
import MarketPage          from './components/Market/MarketPage';
import StockDetail         from './components/Market/StockDetail';

const Layout = ({ children }) => (
  <>
    <Navbar />
    <main style={{ minHeight:'calc(100vh - 92px)', background:'var(--bg-0)' }}>
      {children}
    </main>
    <footer style={{ textAlign:'center', padding:'14px 24px', fontSize:11, color:'var(--text-3)', borderTop:'1px solid var(--border)', fontFamily:'var(--font-mono)' }}>
      TradeSimX v3 · Academic Simulation · No real money · Finnhub API
    </footer>
  </>
);

const P = ({ children }) => (
  <ProtectedRoute>
    <Layout>{children}</Layout>
  </ProtectedRoute>
);

export default function App() {
  return (
    <AuthProvider>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#141f34',
            color: '#e2eaf6',
            border: '1px solid #1e2d45',
            borderRadius: '10px',
            fontFamily: "'Outfit', sans-serif",
            fontSize: '13px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          },
          success: { iconTheme: { primary:'#00d084', secondary:'#141f34' } },
          error:   { iconTheme: { primary:'#ff4560', secondary:'#141f34' } },
        }}
      />
      <Routes>
        {/* Public */}
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected */}
        <Route path="/dashboard"     element={<P><Dashboard /></P>} />
        <Route path="/market"        element={<P><MarketPage /></P>} />
        <Route path="/stock/:symbol" element={<P><StockDetail /></P>} />
        <Route path="/trade"         element={<P><TradingPanel /></P>} />
        <Route path="/orders"        element={<P><OrdersList /></P>} />
        <Route path="/portfolio"     element={<P><Portfolio /></P>} />
        <Route path="/wallet"        element={<P><WalletSection /></P>} />
        <Route path="/watchlist"     element={<P><Watchlist /></P>} />

        {/* Redirects */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16, background:'var(--bg-0)' }}>
            <div style={{ fontSize:56 }}>🚫</div>
            <h1 style={{ fontFamily:'var(--font-mono)', fontSize:24 }}>404 — Not Found</h1>
            <a href="/dashboard" style={{ color:'var(--blue)', fontSize:13 }}>← Back to Dashboard</a>
          </div>
        } />
      </Routes>
    </AuthProvider>
  );
}
