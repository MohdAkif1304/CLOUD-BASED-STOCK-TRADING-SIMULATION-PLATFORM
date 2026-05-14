// src/components/Market/StockDetail.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Line } from 'react-chartjs-2';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import socket from '../../socket/socket';
import { fmtCurrency } from '../../utils/format';
import toast from 'react-hot-toast';

const RANGES = [
  { label:'1W', days:7,   interval:'1d'  },
  { label:'1M', days:30,  interval:'1d'  },
  { label:'3M', days:90,  interval:'1d'  },
  { label:'6M', days:180, interval:'1wk' },
  { label:'1Y', days:365, interval:'1wk' },
];

export default function StockDetail() {
  const { symbol }             = useParams();
  const navigate               = useNavigate();
  const { user, updateWallet } = useAuth();
  const [quote,     setQuote]     = useState(null);
  const [history,   setHistory]   = useState([]);
  const [range,     setRange]     = useState(RANGES[1]);
  const [loading,   setLoading]   = useState(true);
  const [chartLoad, setChartLoad] = useState(false);
  const [form,      setForm]      = useState({ type:'BUY', quantity:'', price:'' });
  const [placing,   setPlacing]   = useState(false);
  const [inWL,      setInWL]      = useState(false);
  const [holding,   setHolding]   = useState(null);

  const loadAll = useCallback(async () => {
    if (!symbol) return;
    try {
      const [qr, hr, wlr, pr] = await Promise.all([
        api.get(`/stocks/${symbol}`),
        api.get(`/stocks/history/${symbol}?range=${range.days}&interval=${range.interval}`),
        api.get('/watchlist'),
        api.get('/portfolio'),
      ]);
      setQuote(qr.data.quote);
      setHistory(hr.data.data || []);
      setInWL(wlr.data.watchlist.some(w => w.symbol === symbol));
      const h = pr.data.holdings.find(h => h.symbol === symbol);
      setHolding(h || null);
      if (qr.data.quote?.price) setForm(p => ({ ...p, price: qr.data.quote.price.toFixed(2) }));
    } catch (err) {
      if (err.response?.status === 404) toast.error(`Symbol "${symbol}" not found`);
    } finally { setLoading(false); }
  }, [symbol, range.days, range.interval]);

  useEffect(() => {
    loadAll();
    socket.emit('subscribe:symbol', symbol);
    const onPrices = (prices) => { if (prices[symbol]) setQuote(p => p ? { ...p, ...prices[symbol] } : prices[symbol]); };
    const onTrade  = loadAll;
    socket.on('prices:update', onPrices);
    socket.on('trade:executed', onTrade);
    return () => { socket.off('prices:update', onPrices); socket.off('trade:executed', onTrade); socket.emit('unsubscribe:symbol', symbol); };
  }, [symbol, loadAll]);

  const fetchHistory = async (r) => {
    setChartLoad(true);
    try { const { data } = await api.get(`/stocks/history/${symbol}?range=${r.days}&interval=${r.interval}`); setHistory(data.data || []); }
    catch { toast.error('Could not load chart data'); }
    finally { setChartLoad(false); }
  };

  const handleOrder = async (e) => {
    e.preventDefault();
    const qty = parseInt(form.quantity), price = parseFloat(form.price);
    if (!qty || qty < 1) { toast.error('Enter a valid quantity'); return; }
    if (!price || price <= 0) { toast.error('Enter a valid price'); return; }
    setPlacing(true);
    try {
      const { data } = await api.post('/orders', { symbol, type: form.type, quantity: qty, price, companyName: quote?.name || symbol });
      toast.success(`${form.type} order placed! ${data.tradesExecuted} trade(s) executed.`, { duration: 5000 });
      if (data.walletBalance !== undefined) updateWallet(data.walletBalance);
      setForm(p => ({ ...p, quantity: '', price: quote?.price?.toFixed(2) || p.price }));
      loadAll();
    } catch (err) { toast.error(err.response?.data?.message || 'Order failed'); }
    finally { setPlacing(false); }
  };

  const toggleWL = async () => {
    try {
      if (inWL) { await api.delete(`/watchlist/${symbol}`); setInWL(false); toast.success('Removed from watchlist'); }
      else { await api.post('/watchlist', { symbol, companyName: quote?.name }); setInWL(true); toast.success('Added to watchlist ⭐'); }
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const closes = history.map(d => d.close);
  const isUp   = closes.length >= 2 ? closes[closes.length - 1] >= closes[0] : true;
  const lc     = isUp ? '#00d084' : '#ff4560';
  const fc     = isUp ? 'rgba(0,208,132,0.1)' : 'rgba(255,69,96,0.1)';

  const chartData = {
    labels: history.map(d => {
      const dt = new Date(d.time);
      return range.days <= 30 ? dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}) : dt.toLocaleDateString('en-IN',{month:'short',year:'2-digit'});
    }),
    datasets: [{ label: symbol, data: closes, borderColor: lc, backgroundColor: fc, borderWidth: 2, pointRadius: 0, pointHoverRadius: 5, fill: true, tension: 0.3 }],
  };

  const chartOpts = {
    responsive: true, maintainAspectRatio: false, animation: { duration: 400 },
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor:'#141f34', borderColor:'#1e2d45', borderWidth:1, titleColor:'#8a9bba', bodyColor:'#e2eaf6',
        callbacks: { label: ctx => ` ₹${ctx.parsed.y?.toFixed(2) ?? '—'}` } },
    },
    scales: {
      x: { grid:{ color:'rgba(30,45,69,0.6)' }, ticks:{ color:'#4a5d7a', font:{ size:10 }, maxTicksLimit:8 } },
      y: { position:'right', grid:{ color:'rgba(30,45,69,0.6)' }, ticks:{ color:'#4a5d7a', font:{ size:10 }, callback: v => `${v.toFixed(0)}` } },
    },
  };

  const up = (quote?.changePercent || 0) >= 0;
  const orderValue = (parseFloat(form.quantity) || 0) * (parseFloat(form.price) || 0);

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:80}}><div className="spinner" style={{width:40,height:40,borderWidth:3}}/></div>;
  if (!quote) return <div className="page"><button className="btn btn-ghost" onClick={()=>navigate(-1)} style={{marginBottom:16}}>← Back</button><div className="card"><div className="empty"><div className="icon">❌</div><p>Symbol "{symbol}" not found.</p></div></div></div>;

  return (
    <div className="page fade-up">
      <button className="btn btn-ghost" onClick={()=>navigate(-1)} style={{marginBottom:16,fontSize:12}}>← Back</button>

      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:22,flexWrap:'wrap',gap:16}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
            <h1 style={{fontFamily:'var(--font-mono)',fontSize:26,fontWeight:700}}>{symbol}</h1>
            <span style={{fontSize:13,color:'var(--text-2)'}}>{quote.name}</span>
            {quote.exchange && <span style={{fontSize:10,color:'var(--text-3)',background:'var(--bg-3)',padding:'2px 8px',borderRadius:4}}>{quote.exchange}</span>}
            {quote.source==='simulation' && <span style={{fontSize:10,color:'var(--yellow)',background:'var(--yellow-dim)',padding:'2px 8px',borderRadius:4}}>Simulated</span>}
          </div>
          <div style={{display:'flex',alignItems:'baseline',gap:14}}>
            <span style={{fontFamily:'var(--font-mono)',fontSize:36,fontWeight:700}}>{fmtCurrency(quote.price)}</span>
            <span style={{fontFamily:'var(--font-mono)',fontSize:16,color:up?'var(--green)':'var(--red)',fontWeight:600}}>
              {up?'+':''}{(quote.change||0).toFixed(2)} ({up?'+':''}{(quote.changePercent||0).toFixed(2)}%)
            </span>
          </div>
          <div style={{display:'flex',flexWrap:'wrap',gap:20,marginTop:12,paddingTop:12,borderTop:'1px solid var(--border)'}}>
            {[['Open',fmtCurrency(quote.open)],['High',fmtCurrency(quote.high)],['Low',fmtCurrency(quote.low)],['Volume',quote.volume?(quote.volume/1e6).toFixed(2)+'M':'—']].map(([l,v])=>(
              <div key={l} style={{display:'flex',flexDirection:'column',gap:2}}>
                <span style={{fontSize:10,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.08em'}}>{l}</span>
                <span style={{fontFamily:'var(--font-mono)',fontSize:13,fontWeight:600}}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10,alignItems:'flex-end'}}>
          <button onClick={toggleWL} className="btn btn-ghost" style={{fontSize:12}}>{inWL?'⭐ Watching':'☆ Watchlist'}</button>
          {holding && (
            <div style={{display:'flex',flexDirection:'column',gap:3,background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',padding:'10px 14px',alignItems:'flex-end'}}>
              <span style={{fontSize:10,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.08em'}}>Your Position</span>
              <span style={{fontFamily:'var(--font-mono)',fontSize:16,fontWeight:700}}>{holding.quantity} shares</span>
              <span style={{fontSize:12,color:holding.unrealizedPnL>=0?'var(--green)':'var(--red)'}}>P&L: {holding.unrealizedPnL>=0?'+':''}{fmtCurrency(holding.unrealizedPnL)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart + Order */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:18,alignItems:'start'}}>
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 18px',borderBottom:'1px solid var(--border)'}}>
            <span style={{fontSize:13,fontWeight:600}}>Price History</span>
            <div style={{display:'flex',gap:4}}>
              {RANGES.map(r=>(
                <button key={r.label} onClick={()=>{setRange(r);fetchHistory(r);}}
                  style={{padding:'4px 10px',borderRadius:'var(--r-sm)',border:'1px solid',fontSize:11,fontWeight:600,fontFamily:'var(--font-mono)',cursor:'pointer',transition:'all .15s',
                    ...(range.label===r.label?{background:'var(--blue)',borderColor:'var(--blue)',color:'#fff'}:{background:'transparent',borderColor:'var(--border)',color:'var(--text-2)'})}}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{height:360,padding:'16px 8px 8px',position:'relative'}}>
            {chartLoad && <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(10,14,26,.8)',zIndex:10,borderRadius:8}}><span className="spinner" style={{width:28,height:28}}/></div>}
            {history.length > 0 ? <Line data={chartData} options={chartOpts}/> : <div className="empty"><div className="icon">📉</div><p>No data available</p></div>}
          </div>
        </div>

        <div className="card">
          <h3 style={{fontSize:15,fontWeight:700,marginBottom:16}}>Place Order</h3>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,background:'var(--bg-1)',padding:4,borderRadius:'var(--r-md)',marginBottom:16}}>
            {['BUY','SELL'].map(t=>(
              <button key={t} onClick={()=>setForm(p=>({...p,type:t}))}
                style={{padding:10,border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13,fontFamily:'var(--font-mono)',transition:'all .15s',
                  ...(form.type===t ? (t==='BUY'?{background:'var(--green)',color:'#000'}:{background:'var(--red)',color:'#fff'}) : {background:'transparent',color:'var(--text-3)'})}}>
                {t==='BUY'?'▲ BUY':'▼ SELL'}
              </button>
            ))}
          </div>
          <form onSubmit={handleOrder} style={{display:'flex',flexDirection:'column',gap:12}}>
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input className="form-input" type="number" min="1" step="1" placeholder="0" value={form.quantity} onChange={e=>setForm(p=>({...p,quantity:e.target.value}))}/>
              {form.type==='SELL' && holding && <span style={{fontSize:11,color:'var(--text-3)'}}>You hold: {holding.quantity} shares</span>}
              {form.type==='SELL' && !holding && <span style={{fontSize:11,color:'var(--red)'}}>⚠ You have no {symbol} shares — buy first!</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Price (₹)</label>
              <input className="form-input" type="number" min="0.01" step="0.01" placeholder="0.00" value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))}/>
              <span style={{fontSize:11,color:'var(--text-3)',display:'flex',justifyContent:'space-between'}}>
                <span>Market: {fmtCurrency(quote.price)}</span>
                <button type="button" onClick={()=>setForm(p=>({...p,price:quote.price.toFixed(2)}))} style={{background:'none',border:'none',color:'var(--blue)',fontSize:11,cursor:'pointer',textDecoration:'underline'}}>Use market</button>
              </span>
            </div>
            {orderValue > 0 && (
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 13px',background:'var(--bg-1)',borderRadius:'var(--r-md)',border:'1px solid var(--border)'}}>
                <span style={{fontSize:12,color:'var(--text-2)'}}>Order Total</span>
                <span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:16,color:form.type==='BUY'?'var(--red)':'var(--green)'}}>{form.type==='BUY'?'−':'+'}{fmtCurrency(orderValue)}</span>
              </div>
            )}
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-3)'}}>
              <span>Cash Available</span>
              <span style={{color:'var(--green)',fontFamily:'var(--font-mono)'}}>{fmtCurrency(user?.walletBalance)}</span>
            </div>
            <button type="submit" className={`btn btn-${form.type==='BUY'?'buy':'sell'}`} disabled={placing} style={{marginTop:4}}>
              {placing?<><span className="spinner"/>Processing…</>:`${form.type==='BUY'?'▲ BUY':'▼ SELL'} ${form.quantity||''} Shares`}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
