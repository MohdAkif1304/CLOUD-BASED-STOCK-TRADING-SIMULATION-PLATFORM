// src/components/common/Navbar.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import socket from '../../socket/socket';
import api from '../../services/api';
import { fmtCurrency } from '../../utils/format';
import toast from 'react-hot-toast';

const TICKER_SYMS = ['AAPL','TSLA','GOOGL','MSFT','AMZN','META','NVDA','NFLX','AMD','INTC','RELIANCE','TCS','INFY'];

export default function Navbar() {
  const { user, logout, updateWallet } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const [prices, setPrices]   = useState({});
  const [live,   setLive]     = useState(false);

  useEffect(() => {
    // Load initial prices
    api.get('/stocks/prices').then(({ data }) => { if (data.prices) setPrices(data.prices); }).catch(() => {});

    const onPrices = (p) => { setPrices(p); setLive(true); };
    const onTrade  = async () => {
      try { const { data } = await api.get('/wallet'); updateWallet(data.walletBalance); } catch {}
    };
    socket.on('prices:update', onPrices);
    socket.on('trade:executed', onTrade);
    socket.on('connect',    () => setLive(true));
    socket.on('disconnect', () => setLive(false));
    return () => { socket.off('prices:update', onPrices); socket.off('trade:executed', onTrade); };
  }, [updateWallet]);

  const handleLogout = () => { logout(); toast.success('Signed out'); navigate('/login'); };

  const navLinks = [
    { path:'/dashboard', label:'Dashboard' },
    { path:'/market',    label:'Market'    },
    { path:'/trade',     label:'Trade'     },
    { path:'/orders',    label:'Orders'    },
    { path:'/portfolio', label:'Portfolio' },
    { path:'/wallet',    label:'Wallet'    },
    { path:'/watchlist', label:'Watchlist' },
  ];

  const tickerItems = [...TICKER_SYMS, ...TICKER_SYMS];

  return (
    <>
      <nav style={S.nav}>
        <div style={S.inner}>
          <Link to="/dashboard" style={S.logo}>
            <span style={{fontSize:18}}>📈</span>
            <span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:15,color:'var(--text-1)',letterSpacing:'-.03em'}}>TradeSimX</span>
          </Link>
          <div style={S.links}>
            {navLinks.map(({ path, label }) => (
              <Link key={path} to={path} style={{ ...S.link, ...(location.pathname === path ? S.linkActive : {}) }}>
                {label}
              </Link>
            ))}
          </div>
          <div style={S.right}>
            <span title={live?'Live':'Connecting…'} style={{width:7,height:7,borderRadius:'50%',background:live?'var(--green)':'var(--yellow)',display:'inline-block',boxShadow:live?'0 0 8px var(--green)':'none'}}/>
            <div style={S.wallet}>
              <span style={{fontSize:9,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.1em'}}>Balance</span>
              <span style={{fontFamily:'var(--font-mono)',fontSize:13,fontWeight:700,color:'var(--green)'}}>{fmtCurrency(user?.walletBalance)}</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:7}}>
              <div style={{width:28,height:28,borderRadius:'50%',background:'var(--blue)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff',flexShrink:0}}>
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <span style={{fontSize:12.5,fontWeight:500,color:'var(--text-1)'}}>{user?.name?.split(' ')[0]}</span>
            </div>
            <button onClick={handleLogout} className="btn btn-ghost" style={{fontSize:12,padding:'6px 13px'}}>Sign Out</button>
          </div>
        </div>
      </nav>
      {/* Live ticker */}
      <div className="ticker-bar">
        <div className="ticker-track">
          {tickerItems.map((sym, i) => {
            const q = prices[sym];
            const up = (q?.changePercent || 0) >= 0;
            return (
              <span key={`${sym}-${i}`} className="ticker-item" style={{color: q ? (up?'var(--green)':'var(--red)') : 'var(--text-3)'}}>
                <strong style={{color:'var(--text-1)'}}>{sym}</strong>
                {q ? <><span>{fmtCurrency(q.price)}</span><span style={{fontSize:10}}>{up?'▲':'▼'}{Math.abs(q.changePercent||0).toFixed(2)}%</span></> : <span>—</span>}
              </span>
            );
          })}
        </div>
      </div>
    </>
  );
}

const S = {
  nav:      {background:'var(--bg-1)',borderBottom:'1px solid var(--border)',position:'sticky',top:0,zIndex:100},
  inner:    {maxWidth:1400,margin:'0 auto',padding:'0 24px',height:56,display:'flex',alignItems:'center',gap:28},
  logo:     {display:'flex',alignItems:'center',gap:8,textDecoration:'none',flexShrink:0},
  links:    {display:'flex',alignItems:'center',gap:2,flex:1},
  link:     {textDecoration:'none',color:'var(--text-2)',fontSize:12.5,fontWeight:500,padding:'5px 10px',borderRadius:'var(--r-sm)',transition:'all .15s',whiteSpace:'nowrap'},
  linkActive:{color:'var(--text-1)',background:'var(--bg-3)'},
  right:    {display:'flex',alignItems:'center',gap:14,flexShrink:0},
  wallet:   {display:'flex',flexDirection:'column',alignItems:'flex-end',padding:'4px 10px',background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:'var(--r-md)'},
};
