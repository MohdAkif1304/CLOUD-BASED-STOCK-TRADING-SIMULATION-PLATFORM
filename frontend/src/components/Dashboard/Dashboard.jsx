// src/components/Dashboard/Dashboard.jsx
// NOTE: Chart.js is registered globally in main.jsx — do NOT re-register here
import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Doughnut } from 'react-chartjs-2';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import socket from '../../socket/socket';
import { fmtCurrency } from '../../utils/format';

const PALETTE = ['#3b82f6','#00d084','#ff4560','#fbbf24','#a855f7','#22d3ee','#f97316','#ec4899'];

const Stat = ({ icon, label, value, sub, color='var(--text-1)', trend }) => (
  <div className="card" style={{ flex:1, minWidth:160 }}>
    <div style={{ fontSize:22, marginBottom:10 }}>{icon}</div>
    <div style={{ fontSize:10, color:'var(--text-2)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>{label}</div>
    <div style={{ fontFamily:'var(--font-mono)', fontSize:20, fontWeight:700, color, lineHeight:1.2 }}>{value}</div>
    {sub && <div style={{ fontSize:11, color:'var(--text-3)', marginTop:4 }}>{sub}</div>}
    {trend !== undefined && (
      <div style={{ fontSize:11, color:trend>=0?'var(--green)':'var(--red)', marginTop:4, fontFamily:'var(--font-mono)' }}>
        {trend>=0?'▲':'▼'} {Math.abs(trend).toFixed(2)}%
      </div>
    )}
  </div>
);

export default function Dashboard() {
  const { user, updateWallet } = useAuth();
  const navigate = useNavigate();
  const [portfolio, setPortfolio] = useState(null);
  const [orders,    setOrders]    = useState([]);
  const [trades,    setTrades]    = useState([]);
  const [feed,      setFeed]      = useState([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    try {
      const [p, o, t] = await Promise.all([api.get('/portfolio'), api.get('/orders?limit=5'), api.get('/portfolio/trades?limit=5')]);
      setPortfolio(p.data); setOrders(o.data.orders); setTrades(t.data.trades);
    } catch(e){ console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const onTrade = async (t) => {
      setFeed(p => [t, ...p].slice(0, 6));
      try { const { data } = await api.get('/wallet'); updateWallet(data.walletBalance); } catch {}
      load();
    };
    const onPrices = () => api.get('/portfolio').then(({ data }) => setPortfolio(data)).catch(()=>{});
    socket.on('trade:executed', onTrade);
    socket.on('order:updated', load);
    socket.on('prices:update', onPrices);
    return () => { socket.off('trade:executed', onTrade); socket.off('order:updated', load); socket.off('prices:update', onPrices); };
  }, [load, updateWallet]);

  const holdings = portfolio?.holdings || [];
  const s = portfolio?.summary || {};
  const pnl = s.totalUnrealizedPnL || 0;
  const totalAssets = (user?.walletBalance || 0) + (s.totalCurrentValue || 0);

  const donutData = holdings.length > 0 ? {
    labels: holdings.map(h => h.symbol),
    datasets: [{ data: holdings.map(h => h.currentValue || 0), backgroundColor: holdings.map((_,i)=>PALETTE[i%PALETTE.length]), borderColor:'#0f1829', borderWidth:2, hoverOffset:6 }],
  } : null;

  const donutOpts = {
    responsive:true, maintainAspectRatio:false, cutout:'68%', animation:{ duration:600 },
    plugins: {
      legend:{ display:false },
      tooltip:{ backgroundColor:'#141f34', borderColor:'#1e2d45', borderWidth:1, titleColor:'#8a9bba', bodyColor:'#e2eaf6',
        callbacks:{ label: ctx => ` ${ctx.label}: ${fmtCurrency(ctx.parsed)}` } },
    },
  };

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:80}}><div className="spinner" style={{width:40,height:40,borderWidth:3}}/></div>;

  return (
    <div className="page fade-up">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:14}}>
        <div>
          <h1 style={{fontSize:24,fontWeight:700,letterSpacing:'-.02em',marginBottom:4}}>Welcome back, {user?.name?.split(' ')[0]} 👋</h1>
          <p style={{fontSize:13,color:'var(--text-2)'}}>Portfolio updating live · Prices refresh every 15s</p>
        </div>
        <div style={{display:'flex',gap:10}}>
          <button className="btn btn-ghost" style={{fontSize:12}} onClick={()=>navigate('/market')}>📊 Market</button>
          <button className="btn btn-primary" onClick={()=>navigate('/trade')}>⚡ Trade Now</button>
        </div>
      </div>

      <div style={{display:'flex',gap:14,marginBottom:22,flexWrap:'wrap'}}>
        <Stat icon="💰" label="Cash Balance"    value={fmtCurrency(user?.walletBalance)} color="var(--green)"/>
        <Stat icon="📊" label="Portfolio Value" value={fmtCurrency(s.totalCurrentValue||0)} sub={`Invested: ${fmtCurrency(s.totalInvested||0)}`}/>
        <Stat icon={pnl>=0?'📈':'📉'} label="Unrealized P&L" value={`${pnl>=0?'+':''}${fmtCurrency(pnl)}`} color={pnl>=0?'var(--green)':'var(--red)'} trend={s.totalUnrealizedPnLPercent||0}/>
        <Stat icon="🏦" label="Total Assets" value={fmtCurrency(totalAssets)} sub={`${holdings.length} holdings`}/>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:18,marginBottom:18}}>
        <div style={{display:'flex',flexDirection:'column',gap:18}}>
          {/* Recent orders */}
          <div className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <span style={{fontWeight:700,fontSize:14}}>Recent Orders</span>
              <Link to="/orders" style={{fontSize:11,color:'var(--blue)',textDecoration:'none'}}>View all →</Link>
            </div>
            {orders.length===0 ? <div className="empty" style={{padding:'24px 0'}}><div className="icon">📋</div><p>No orders yet</p></div> : (
              <div className="table-wrap">
                <table><thead><tr><th>Symbol</th><th>Type</th><th>Qty</th><th>Price</th><th>Status</th><th>Time</th></tr></thead>
                <tbody>{orders.map(o=>(
                  <tr key={o._id} style={{cursor:'pointer'}} onClick={()=>navigate(`/stock/${o.symbol}`)}>
                    <td><strong>{o.symbol}</strong></td>
                    <td><span className={`badge badge-${o.type.toLowerCase()}`}>{o.type}</span></td>
                    <td>{o.quantity}</td><td>{fmtCurrency(o.price)}</td>
                    <td><span className={`badge badge-${o.status.toLowerCase()}`}>{o.status}</span></td>
                    <td style={{color:'var(--text-3)',fontSize:11}}>{new Date(o.createdAt).toLocaleTimeString('en-IN')}</td>
                  </tr>
                ))}</tbody></table>
              </div>
            )}
          </div>

          {/* Live feed */}
          <div className="card">
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
              <span style={{width:8,height:8,borderRadius:'50%',background:'var(--red)',display:'inline-block'}}/>
              <span style={{fontWeight:700,fontSize:14}}>Live Trade Feed</span>
            </div>
            {feed.length===0 ? <div style={{color:'var(--text-3)',fontSize:13}}>Waiting for trades…</div> : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {feed.map((t,i)=>(
                  <div key={i} className="flash-new" style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'9px 12px',background:'var(--bg-3)',borderRadius:8,border:'1px solid var(--green-dim)'}}>
                    <div>
                      <span style={{fontFamily:'var(--font-mono)',fontWeight:700,color:'var(--green)'}}>{t.symbol}</span>
                      <span style={{fontSize:11,color:'var(--text-2)',marginLeft:10}}>{t.quantity} shares @ {fmtCurrency(t.price)}</span>
                    </div>
                    <span style={{fontFamily:'var(--font-mono)',fontSize:12,fontWeight:700,color:'var(--green)'}}>{fmtCurrency(t.totalValue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: doughnut + trades */}
        <div style={{display:'flex',flexDirection:'column',gap:18}}>
          <div className="card">
            <span style={{fontWeight:700,fontSize:14,display:'block',marginBottom:14}}>Portfolio Allocation</span>
            {donutData ? (
              <>
                <div style={{height:200,position:'relative',marginBottom:16}}>
                  <Doughnut data={donutData} options={donutOpts}/>
                  <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                    <div style={{fontSize:10,color:'var(--text-3)',textTransform:'uppercase'}}>Total</div>
                    <div style={{fontFamily:'var(--font-mono)',fontSize:14,fontWeight:700}}>{fmtCurrency(s.totalCurrentValue||0)}</div>
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {holdings.slice(0,6).map((h,i)=>(
                    <div key={h.symbol} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer'}} onClick={()=>navigate(`/stock/${h.symbol}`)}>
                      <div style={{display:'flex',alignItems:'center',gap:7}}>
                        <span style={{width:8,height:8,borderRadius:2,background:PALETTE[i%PALETTE.length],display:'inline-block'}}/>
                        <span style={{fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600}}>{h.symbol}</span>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontFamily:'var(--font-mono)',fontSize:11}}>{((h.currentValue/(s.totalCurrentValue||1))*100).toFixed(1)}%</div>
                        <div style={{fontSize:10,color:h.unrealizedPnL>=0?'var(--green)':'var(--red)'}}>{h.unrealizedPnL>=0?'+':''}{fmtCurrency(h.unrealizedPnL)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : <div className="empty" style={{padding:'24px 0'}}><div className="icon">📊</div><p>Buy stocks to see chart</p></div>}
          </div>

          <div className="card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <span style={{fontWeight:700,fontSize:14}}>My Trades</span>
              <Link to="/portfolio" style={{fontSize:11,color:'var(--blue)',textDecoration:'none'}}>View all →</Link>
            </div>
            {trades.length===0 ? <div style={{color:'var(--text-3)',fontSize:13}}>No trades yet</div> : (
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {trades.slice(0,4).map(t=>(
                  <div key={t._id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:12,padding:'6px 0',borderBottom:'1px solid var(--border)'}}>
                    <div style={{display:'flex',alignItems:'center',gap:7}}>
                      <span className={`badge badge-${t.userSide.toLowerCase()}`}>{t.userSide}</span>
                      <span style={{fontFamily:'var(--font-mono)',fontWeight:600}}>{t.symbol}</span>
                      <span style={{color:'var(--text-3)'}}>×{t.quantity}</span>
                    </div>
                    <span style={{fontFamily:'var(--font-mono)'}}>{fmtCurrency(t.price)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
