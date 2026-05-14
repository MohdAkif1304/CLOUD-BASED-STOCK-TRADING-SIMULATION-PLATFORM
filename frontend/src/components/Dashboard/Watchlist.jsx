// src/components/Dashboard/Watchlist.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import socket from '../../socket/socket';
import { fmtCurrency } from '../../utils/format';
import toast from 'react-hot-toast';

export default function Watchlist() {
  const navigate = useNavigate();
  const [watchlist, setWatchlist] = useState([]);
  const [prices,    setPrices]    = useState({});
  const [loading,   setLoading]   = useState(true);
  const [searchQ,   setSearchQ]   = useState('');
  const [searchRes, setSearchRes] = useState([]);
  const [adding,    setAdding]    = useState(null);

  const load = useCallback(async () => {
    try { const { data } = await api.get('/watchlist'); setWatchlist(data.watchlist); }
    catch(e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    api.get('/stocks/prices').then(({ data }) => setPrices(data.prices || {})).catch(() => {});
    socket.on('prices:update', setPrices);
    return () => socket.off('prices:update', setPrices);
  }, [load]);

  useEffect(() => {
    if (!searchQ.trim()) { setSearchRes([]); return; }
    const t = setTimeout(async () => {
      try { const { data } = await api.get(`/stocks/search?q=${encodeURIComponent(searchQ)}`); setSearchRes(data.results || []); }
      catch {}
    }, 350);
    return () => clearTimeout(t);
  }, [searchQ]);

  const handleAdd = async (symbol, name) => {
    setAdding(symbol);
    try {
      await api.post('/watchlist', { symbol, companyName: name });
      toast.success(`${symbol} added to watchlist ⭐`);
      setSearchQ(''); setSearchRes([]);
      load();
    } catch(err) { toast.error(err.response?.data?.message || 'Error'); }
    finally { setAdding(null); }
  };

  const handleRemove = async (symbol) => {
    try {
      await api.delete(`/watchlist/${symbol}`);
      toast.success(`${symbol} removed`);
      setWatchlist(p => p.filter(w => w.symbol !== symbol));
    } catch(err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  return (
    <div className="page fade-up">
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22, flexWrap:'wrap', gap:14 }}>
        <h1 className="page-title" style={{ marginBottom:0 }}>Watchlist ⭐</h1>
        <span style={{ fontSize:12, color:'var(--text-3)', fontFamily:'var(--font-mono)' }}>{watchlist.length} stocks tracked</span>
      </div>

      {/* Search */}
      <div className="card" style={{ marginBottom:18 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:10 }}>Add Stock to Watchlist</div>
        <div style={{ position:'relative' }}>
          <input className="form-input" placeholder="🔍 Search symbol or company name…"
            value={searchQ} onChange={e => setSearchQ(e.target.value)} />
          {searchRes.length > 0 && (
            <div style={{ position:'absolute', top:'calc(100% + 4px)', left:0, right:0, background:'var(--bg-3)', border:'1px solid var(--border)', borderRadius:'var(--r-md)', zIndex:200, overflow:'hidden', boxShadow:'var(--shadow)' }}>
              {searchRes.map(r => (
                <div key={r.symbol} style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div>
                    <span style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:13 }}>{r.symbol}</span>
                    <span style={{ fontSize:11, color:'var(--text-2)', marginLeft:8 }}>{r.name}</span>
                    <span style={{ fontSize:10, color:'var(--text-3)', marginLeft:6 }}>{r.exchange}</span>
                  </div>
                  <button className="btn btn-primary" style={{ fontSize:11, padding:'5px 12px' }}
                    disabled={adding === r.symbol || watchlist.some(w => w.symbol === r.symbol)}
                    onClick={() => handleAdd(r.symbol, r.name)}>
                    {adding === r.symbol ? '…' : watchlist.some(w => w.symbol === r.symbol) ? '✓ Added' : '+ Add'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
          <div className="spinner" style={{ width:36, height:36, borderWidth:3 }} />
        </div>
      ) : watchlist.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="icon">🌟</div>
            <p>Your watchlist is empty.</p>
            <p style={{ marginTop:6, fontSize:11 }}>Search above to add stocks you want to track.</p>
          </div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
          {watchlist.map(item => {
            const q  = prices[item.symbol] || item.quote;
            const up = (q?.changePercent || 0) >= 0;
            return (
              <div key={item.symbol} className="card" style={{ cursor:'pointer', transition:'border-color .2s, transform .15s' }}
                onMouseOver={e => { e.currentTarget.style.borderColor='var(--blue)'; e.currentTarget.style.transform='translateY(-2px)'; }}
                onMouseOut={e  => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.transform='translateY(0)'; }}
                onClick={() => navigate(`/stock/${item.symbol}`)}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                  <div>
                    <div style={{ fontFamily:'var(--font-mono)', fontWeight:700, fontSize:16 }}>{item.symbol}</div>
                    <div style={{ fontSize:11, color:'var(--text-2)', marginTop:2, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {item.companyName || q?.name || '—'}
                    </div>
                  </div>
                  <button className="btn-icon" style={{ fontSize:16 }}
                    onClick={e => { e.stopPropagation(); handleRemove(item.symbol); }}
                    title="Remove from watchlist">⭐</button>
                </div>

                {q ? (
                  <>
                    <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:8 }}>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:22, fontWeight:700 }}>{fmtCurrency(q.price)}</span>
                      <span style={{ fontFamily:'var(--font-mono)', fontSize:12, color:up?'var(--green)':'var(--red)', fontWeight:600 }}>
                        {up ? '▲' : '▼'} {Math.abs(q.changePercent || 0).toFixed(2)}%
                      </span>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text-3)', borderTop:'1px solid var(--border)', paddingTop:10 }}>
                      <span>H: {fmtCurrency(q.high)}</span>
                      <span>L: {fmtCurrency(q.low)}</span>
                      <span>Vol: {q.volume ? (q.volume/1e6).toFixed(1)+'M' : '—'}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize:12, color:'var(--text-3)', padding:'8px 0' }}>Loading price…</div>
                )}

                <div style={{ display:'flex', gap:8, marginTop:12 }} onClick={e => e.stopPropagation()}>
                  <button className="btn btn-primary" style={{ flex:1, fontSize:11, padding:'7px 0' }}
                    onClick={() => navigate(`/trade?symbol=${item.symbol}`)}>⚡ Trade</button>
                  <button className="btn btn-ghost" style={{ flex:1, fontSize:11, padding:'7px 0' }}
                    onClick={() => navigate(`/stock/${item.symbol}`)}>📊 Chart</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
