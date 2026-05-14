// src/components/Dashboard/WalletSection.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Bar } from 'react-chartjs-2';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { fmtCurrency, fmtDate } from '../../utils/format';
import toast from 'react-hot-toast';

const QUICK = [5000, 10000, 25000, 50000, 100000];

export default function WalletSection() {
  const { user, updateWallet } = useAuth();
  const [transactions, setTx]   = useState([]);
  const [summary, setSummary]   = useState({ totalCredits:0, totalDebits:0 });
  const [loading, setLoading]   = useState(true);
  const [addLoading, setAddL]   = useState(false);
  const [amount, setAmount]     = useState('');
  const [filterType, setFilter] = useState('');
  const [page, setPage]         = useState(1);
  const [pagination, setPag]    = useState({ pages:1, total:0 });
  const [chartData, setChartData] = useState({ labels:[], credits:[], debits:[] });

  const load = useCallback(async (pg=1) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ page: pg, limit: 15 });
      if (filterType) p.append('type', filterType);
      const { data } = await api.get(`/wallet/transactions?${p}`);
      setTx(data.transactions);
      setSummary(data.summary);
      setPag({ pages: data.pages, total: data.total });
      setPage(data.page);
      // Build chart from last transactions
      buildChart(data.transactions);
    } catch(e) { console.error(e); }
    finally { setLoading(false); }
  }, [filterType]);

  const buildChart = (txns) => {
    const months = {};
    txns.forEach(t => {
      const key = new Date(t.createdAt).toLocaleDateString('en-IN', { month:'short', year:'2-digit' });
      if (!months[key]) months[key] = { credit:0, debit:0 };
      if (t.type === 'CREDIT') months[key].credit += t.amount;
      else months[key].debit += t.amount;
    });
    const labels  = Object.keys(months).slice(-6);
    setChartData({ labels, credits: labels.map(k => months[k].credit), debits: labels.map(k => months[k].debit) });
  };

  useEffect(() => { load(1); }, [load]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0)  { toast.error('Enter a valid amount'); return; }
    if (amt > 1000000)     { toast.error('Max ₹10,00,000 per deposit'); return; }
    setAddL(true);
    try {
      const { data } = await api.post('/wallet/add', { amount: amt });
      toast.success(`₹${amt.toLocaleString('en-IN')} added! 💰`);
      updateWallet(data.walletBalance);
      setAmount('');
      load(1);
    } catch(err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setAddL(false); }
  };

  const barData = {
    labels: chartData.labels,
    datasets: [
      { label:'Credits', data: chartData.credits, backgroundColor:'rgba(0,208,132,0.6)', borderColor:'rgba(0,208,132,1)', borderWidth:1, borderRadius:4 },
      { label:'Debits',  data: chartData.debits,  backgroundColor:'rgba(255,69,96,0.6)',  borderColor:'rgba(255,69,96,1)',  borderWidth:1, borderRadius:4 },
    ],
  };

  const barOpts = {
    responsive:true, maintainAspectRatio:false,
    plugins: {
      legend: { labels: { color:'#8a9bba', font:{ size:11 } } },
      tooltip: { backgroundColor:'#141f34', borderColor:'#1e2d45', borderWidth:1, titleColor:'#8a9bba', bodyColor:'#e2eaf6',
        callbacks: { label: ctx => ` ₹${ctx.parsed.y.toLocaleString('en-IN', { minimumFractionDigits:2 })}` } },
    },
    scales: {
      x: { grid:{ display:false }, ticks:{ color:'#4a5d7a', font:{ size:10 } } },
      y: { grid:{ color:'rgba(30,45,69,0.5)' }, ticks:{ color:'#4a5d7a', font:{ size:10 }, callback: v => `₹${(v/1000).toFixed(0)}k` } },
    },
  };

  return (
    <div className="page fade-up">
      <h1 className="page-title">Wallet</h1>
      <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:18, alignItems:'start' }}>

        {/* Left column */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Balance */}
          <div className="card" style={{ textAlign:'center', padding:'32px 24px', background:'linear-gradient(135deg,var(--bg-2) 0%,var(--bg-3) 100%)', borderColor:'rgba(0,208,132,0.2)' }}>
            <div style={{ fontSize:11, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:8 }}>Available Balance</div>
            <div style={{ fontFamily:'var(--font-mono)', fontSize:36, fontWeight:700, color:'var(--green)', letterSpacing:'-.03em', marginBottom:6 }}>
              {fmtCurrency(user?.walletBalance)}
            </div>
            <div style={{ fontSize:11, color:'var(--text-3)' }}>Virtual simulation funds</div>
          </div>

          {/* Summary */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="card" style={{ textAlign:'center' }}>
              <div style={{ fontSize:10, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Total Credits</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:17, fontWeight:700, color:'var(--green)' }}>+{fmtCurrency(summary.totalCredits)}</div>
            </div>
            <div className="card" style={{ textAlign:'center' }}>
              <div style={{ fontSize:10, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:4 }}>Total Debits</div>
              <div style={{ fontFamily:'var(--font-mono)', fontSize:17, fontWeight:700, color:'var(--red)' }}>-{fmtCurrency(summary.totalDebits)}</div>
            </div>
          </div>

          {/* Add funds */}
          <div className="card">
            <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>💰 Add Virtual Funds</h3>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7, marginBottom:14 }}>
              {QUICK.map(a => (
                <button key={a} onClick={() => setAmount(String(a))}
                  style={{ padding:'5px 10px', fontSize:11, fontFamily:'var(--font-mono)', fontWeight:600, border:'1px solid', borderRadius:6, cursor:'pointer', transition:'all .12s',
                    ...(amount === String(a)
                      ? { borderColor:'var(--blue)', color:'var(--blue)', background:'var(--blue-dim)' }
                      : { borderColor:'var(--border)', color:'var(--text-2)', background:'transparent' }) }}>
                  ₹{a.toLocaleString('en-IN')}
                </button>
              ))}
            </div>
            <form onSubmit={handleAdd} style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <div className="form-group">
                <label className="form-label">Custom Amount (₹)</label>
                <input className="form-input" type="number" min="1" max="1000000" placeholder="Enter amount…"
                  value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ width:'100%', padding:'11px' }} disabled={addLoading || !amount}>
                {addLoading ? <><span className="spinner"/>Adding…</> : '+ Add Funds'}
              </button>
            </form>
            <p style={{ fontSize:10, color:'var(--text-3)', marginTop:10, textAlign:'center' }}>Max ₹10,00,000 per deposit · Simulation only</p>
          </div>

          {/* Activity chart */}
          {chartData.labels.length > 0 && (
            <div className="card">
              <div style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>Activity Chart</div>
              <div style={{ height:160 }}><Bar data={barData} options={barOpts}/></div>
            </div>
          )}
        </div>

        {/* Right: transaction history */}
        <div className="card" style={{ padding:0, overflow:'hidden', alignSelf:'start' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid var(--border)' }}>
            <span style={{ fontWeight:700, fontSize:14 }}>Transaction History</span>
            <select className="form-select" value={filterType} onChange={e => setFilter(e.target.value)} style={{ maxWidth:150, padding:'6px 10px', fontSize:12 }}>
              <option value="">All</option>
              <option value="CREDIT">Credits</option>
              <option value="DEBIT">Debits</option>
            </select>
          </div>

          {loading ? (
            <div style={{ display:'flex', justifyContent:'center', padding:60 }}>
              <div className="spinner" style={{ width:32, height:32, borderWidth:3 }} />
            </div>
          ) : transactions.length === 0 ? (
            <div className="empty"><div className="icon">📭</div><p>No transactions found</p></div>
          ) : (
            <>
              <div className="table-wrap" style={{ border:'none', borderRadius:0 }}>
                <table>
                  <thead><tr><th>Type</th><th>Description</th><th>Amount</th><th>Balance After</th><th>Date</th></tr></thead>
                  <tbody>
                    {transactions.map(tx => (
                      <tr key={tx._id}>
                        <td><span className={`badge badge-${tx.type.toLowerCase()}`}>{tx.type === 'CREDIT' ? '▲' : '▼'} {tx.type}</span></td>
                        <td style={{ maxWidth:260, color:'var(--text-2)', fontFamily:'var(--font-ui)', fontSize:12, whiteSpace:'normal' }}>{tx.description}</td>
                        <td style={{ color: tx.type === 'CREDIT' ? 'var(--green)' : 'var(--red)', fontWeight:700 }}>
                          {tx.type === 'CREDIT' ? '+' : '−'}{fmtCurrency(tx.amount)}
                        </td>
                        <td>{fmtCurrency(tx.balanceAfter)}</td>
                        <td style={{ color:'var(--text-3)', fontFamily:'var(--font-ui)', fontSize:11 }}>{fmtDate(tx.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pagination.pages > 1 && (
                <div className="pagination" style={{ padding:'14px 0' }}>
                  <button className="btn btn-ghost" style={{ fontSize:12, padding:'6px 14px' }} disabled={page<=1} onClick={() => load(page-1)}>← Prev</button>
                  <span>Page {page} of {pagination.pages}</span>
                  <button className="btn btn-ghost" style={{ fontSize:12, padding:'6px 14px' }} disabled={page>=pagination.pages} onClick={() => load(page+1)}>Next →</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
