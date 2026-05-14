// src/components/Dashboard/Portfolio.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import api from '../../services/api';
import socket from '../../socket/socket';
import { fmtCurrency, fmtDate } from '../../utils/format';

export default function Portfolio() {
  const nav = useNavigate();
  const [portfolio, setPortfolio] = useState(null);
  const [trades, setTrades]       = useState([]);
  const [tab, setTab]             = useState('holdings');
  const [loading, setLoading]     = useState(true);
  const [tPage, setTPage]         = useState(1);
  const [tPag, setTPag]           = useState({ pages:1, total:0 });

  const loadPortfolio = useCallback(async () => {
    try { const { data } = await api.get('/portfolio'); setPortfolio(data); }
    catch(e){ console.error(e); } finally { setLoading(false); }
  }, []);

  const loadTrades = useCallback(async (pg=1) => {
    try {
      const { data } = await api.get(`/portfolio/trades?page=${pg}&limit=15`);
      setTrades(data.trades); setTPag({ pages:data.pages, total:data.total }); setTPage(data.page);
    } catch(e){ console.error(e); }
  }, []);

  useEffect(() => {
    loadPortfolio(); loadTrades(1);
    socket.on('trade:executed', () => { loadPortfolio(); loadTrades(1); });
    socket.on('prices:update', loadPortfolio);
    return () => { socket.off('trade:executed'); socket.off('prices:update'); };
  }, [loadPortfolio, loadTrades]);

  const holdings = portfolio?.holdings || [];
  const s = portfolio?.summary || {};
  const pnl = s.totalUnrealizedPnL || 0;

  const barData = {
    labels: holdings.map(h => h.symbol),
    datasets: [
      { label:'Invested',      data: holdings.map(h => parseFloat((h.totalInvested||0).toFixed(2))), backgroundColor:'rgba(59,130,246,0.6)', borderColor:'rgba(59,130,246,1)', borderWidth:1, borderRadius:4 },
      { label:'Current Value', data: holdings.map(h => parseFloat((h.currentValue||0).toFixed(2))),  backgroundColor: holdings.map(h => h.unrealizedPnL>=0?'rgba(0,208,132,0.6)':'rgba(255,69,96,0.6)'), borderColor: holdings.map(h => h.unrealizedPnL>=0?'rgba(0,208,132,1)':'rgba(255,69,96,1)'), borderWidth:1, borderRadius:4 },
    ],
  };

  const barOpts = {
    responsive:true, maintainAspectRatio:false,
    plugins: {
      legend:{ labels:{ color:'#8a9bba', font:{ size:11 } } },
      tooltip:{ backgroundColor:'#141f34', borderColor:'#1e2d45', borderWidth:1, titleColor:'#8a9bba', bodyColor:'#e2eaf6',
        callbacks:{ label: ctx => ` ₹${ctx.parsed.y.toLocaleString('en-IN',{minimumFractionDigits:2})}` } },
    },
    scales: {
      x:{ grid:{ color:'rgba(30,45,69,0.5)' }, ticks:{ color:'#4a5d7a', font:{ size:10 } } },
      y:{ grid:{ color:'rgba(30,45,69,0.5)' }, ticks:{ color:'#4a5d7a', font:{ size:10 }, callback: v => `₹${(v/1000).toFixed(0)}k` } },
    },
  };

  if (loading) return <div style={{display:'flex',justifyContent:'center',padding:80}}><div className="spinner" style={{width:40,height:40,borderWidth:3}}/></div>;

  return (
    <div className="page fade-up">
      <h1 className="page-title">Portfolio</h1>

      {/* Summary */}
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-around',background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:'var(--r-lg)',padding:'18px 28px',marginBottom:18,flexWrap:'wrap',gap:14}}>
        {[
          ['Total Invested',   fmtCurrency(s.totalInvested||0),                 'var(--text-1)'],
          ['Current Value',    fmtCurrency(s.totalCurrentValue||0),             'var(--text-1)'],
          ['Unrealized P&L',   `${pnl>=0?'+':''}${fmtCurrency(pnl)}`,           pnl>=0?'var(--green)':'var(--red)'],
          ['Return %',         `${(s.totalUnrealizedPnLPercent||0)>=0?'+':''}${(s.totalUnrealizedPnLPercent||0).toFixed(2)}%`, pnl>=0?'var(--green)':'var(--red)'],
          ['Holdings',         `${portfolio?.count||0} stocks`,                 'var(--text-1)'],
        ].map(([l,v,c])=>(
          <div key={l} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
            <div style={{fontSize:10,color:'var(--text-3)',textTransform:'uppercase',letterSpacing:'.1em'}}>{l}</div>
            <div style={{fontFamily:'var(--font-mono)',fontSize:19,fontWeight:700,color:c}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      {holdings.length > 0 && (
        <div className="card" style={{marginBottom:18}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <span style={{fontSize:14,fontWeight:700}}>Invested vs Current Value</span>
            <span style={{fontSize:11,color:'var(--text-3)'}}>Live prices updating every 15s</span>
          </div>
          <div style={{height:220}}><Bar data={barData} options={barOpts}/></div>
        </div>
      )}

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:14}}>
        {[['holdings','📊 Holdings'],['trades','🤝 Trade History']].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)}
            style={{padding:'8px 18px',borderRadius:'var(--r-md)',border:tab===k?'1px solid var(--border)':'1px solid transparent',background:tab===k?'var(--bg-2)':'transparent',color:tab===k?'var(--text-1)':'var(--text-2)',cursor:'pointer',fontSize:13,fontWeight:600,fontFamily:'var(--font-ui)',transition:'all .15s'}}>
            {l}
          </button>
        ))}
      </div>

      {/* Holdings */}
      {tab==='holdings' && (
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          {holdings.length===0 ? <div className="empty"><div className="icon">📦</div><p>No holdings yet — go trade!</p></div> : (
            <div className="table-wrap" style={{border:'none',borderRadius:0}}>
              <table><thead><tr><th>Symbol</th><th>Qty</th><th>Avg Buy</th><th>Invested</th><th>Live Price</th><th>Current Value</th><th>P&L (₹)</th><th>P&L (%)</th><th>Action</th></tr></thead>
              <tbody>{holdings.map(h=>{
                const pos=h.unrealizedPnL>=0;
                return(<tr key={h._id} style={{cursor:'pointer'}} onClick={()=>nav(`/stock/${h.symbol}`)}>
                  <td><div style={{fontFamily:'var(--font-mono)',fontWeight:700}}>{h.symbol}</div><div style={{fontSize:10,color:'var(--text-3)',fontFamily:'var(--font-ui)'}}>{h.companyName}</div></td>
                  <td>{h.quantity}</td>
                  <td>{fmtCurrency(h.averageBuyPrice)}</td>
                  <td>{fmtCurrency(h.totalInvested)}</td>
                  <td style={{color:pos?'var(--green)':'var(--red)',fontWeight:600}}>{fmtCurrency(h.currentPrice)}</td>
                  <td style={{fontWeight:600}}>{fmtCurrency(h.currentValue)}</td>
                  <td style={{color:pos?'var(--green)':'var(--red)',fontWeight:700}}>{pos?'+':''}{fmtCurrency(h.unrealizedPnL)}</td>
                  <td><span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:700,fontFamily:'var(--font-mono)',background:pos?'var(--green-dim)':'var(--red-dim)',color:pos?'var(--green)':'var(--red)'}}>{pos?'▲':'▼'}{Math.abs(h.unrealizedPnLPercent)}%</span></td>
                  <td onClick={e=>e.stopPropagation()}><button className="btn btn-primary" style={{fontSize:11,padding:'4px 10px'}} onClick={()=>nav(`/trade?symbol=${h.symbol}`)}>Trade</button></td>
                </tr>);
              })}</tbody></table>
            </div>
          )}
        </div>
      )}

      {/* Trades */}
      {tab==='trades' && (
        <div className="card" style={{padding:0,overflow:'hidden'}}>
          {trades.length===0 ? <div className="empty"><div className="icon">🤝</div><p>No trades yet</p></div> : (
            <>
              <div className="table-wrap" style={{border:'none',borderRadius:0}}>
                <table><thead><tr><th>Symbol</th><th>Side</th><th>Qty</th><th>Price</th><th>Total</th><th>Counterparty</th><th>Executed At</th></tr></thead>
                <tbody>{trades.map(t=>(
                  <tr key={t._id} style={{cursor:'pointer'}} onClick={()=>nav(`/stock/${t.symbol}`)}>
                    <td><strong>{t.symbol}</strong></td>
                    <td><span className={`badge badge-${t.userSide.toLowerCase()}`}>{t.userSide}</span></td>
                    <td>{t.quantity}</td><td>{fmtCurrency(t.price)}</td>
                    <td style={{fontWeight:600}}>{fmtCurrency(t.totalValue)}</td>
                    <td style={{color:'var(--text-2)',fontFamily:'var(--font-ui)',fontSize:12}}>{t.userSide==='BUY'?t.seller?.name:t.buyer?.name||'Market'}</td>
                    <td style={{color:'var(--text-3)',fontFamily:'var(--font-ui)',fontSize:11}}>{fmtDate(t.createdAt)}</td>
                  </tr>
                ))}</tbody></table>
              </div>
              {tPag.pages>1&&<div className="pagination" style={{padding:'14px 0'}}>
                <button className="btn btn-ghost" style={{fontSize:12,padding:'6px 14px'}} disabled={tPage<=1} onClick={()=>loadTrades(tPage-1)}>← Prev</button>
                <span>Page {tPage} of {tPag.pages}</span>
                <button className="btn btn-ghost" style={{fontSize:12,padding:'6px 14px'}} disabled={tPage>=tPag.pages} onClick={()=>loadTrades(tPage+1)}>Next →</button>
              </div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
