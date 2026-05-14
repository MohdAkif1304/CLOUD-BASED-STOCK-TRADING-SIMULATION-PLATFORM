import React,{useState,useEffect,useCallback} from 'react';
import {useSearchParams,useNavigate} from 'react-router-dom';
import {Line} from 'react-chartjs-2';
import {useAuth} from '../../context/AuthContext';
import api from '../../services/api';
import socket from '../../socket/socket';
import {fmtCurrency} from '../../utils/format';
import toast from 'react-hot-toast';

const POPULAR=['AAPL','TSLA','GOOGL','MSFT','AMZN','META','NVDA','RELIANCE','TCS','INFY'];

export default function TradingPanel(){
  const [sp]=useSearchParams(); const nav=useNavigate();
  const {user,updateWallet}=useAuth();
  const [form,setForm]=useState({symbol:sp.get('symbol')||'',type:'BUY',quantity:'',price:''});
  const [quote,setQuote]=useState(null); const [history,setHistory]=useState([]);
  const [placing,setPlacing]=useState(false); const [loading,setLoading]=useState(false);
  const [openOrders,setOpenOrders]=useState([]); const [feed,setFeed]=useState([]);
  const [prices,setPrices]=useState({}); const [searchQ,setSearchQ]=useState('');
  const [searchRes,setSearchRes]=useState([]); const [holding,setHolding]=useState(null);

  const fetchQuote=useCallback(async(sym)=>{
    if(!sym)return; setLoading(true);
    try{
      const[qr,hr]=await Promise.all([api.get(`/stocks/${sym}`),api.get(`/stocks/history/${sym}?range=7&interval=1d`)]);
      setQuote(qr.data.quote); setHistory(hr.data.data||[]);
      if(qr.data.quote?.price)setForm(p=>({...p,price:qr.data.quote.price.toFixed(2)}));
    }catch(e){if(e.response?.status===404)toast.error(`"${sym}" not found`);}
    finally{setLoading(false);}
  },[]);

  useEffect(()=>{
    api.get('/stocks/prices').then(({data})=>setPrices(data.prices||{})).catch(()=>{});
    api.get('/orders/all?limit=40').then(({data})=>setOpenOrders(data.orders)).catch(()=>{});
    api.get('/portfolio').then(({data})=>{ if(form.symbol){const h=data.holdings.find(h=>h.symbol===form.symbol);setHolding(h||null);}}).catch(()=>{});
    if(form.symbol)fetchQuote(form.symbol);
    const onPrices=p=>{setPrices(p);if(form.symbol&&p[form.symbol])setQuote(prev=>prev?{...prev,...p[form.symbol]}:prev);};
    const onNew=o=>setOpenOrders(p=>[o,...p].slice(0,50));
    const onUpd=o=>setOpenOrders(p=>['FILLED','CANCELLED'].includes(o.status)?p.filter(x=>x._id!==o._id):p.map(x=>x._id===o._id?{...x,...o}:x));
    const onTrade=t=>{
      setFeed(p=>[t,...p].slice(0,10));
      api.get('/wallet').then(({data})=>updateWallet(data.walletBalance)).catch(()=>{});
      api.get('/portfolio').then(({data})=>{if(form.symbol){const h=data.holdings.find(h=>h.symbol===form.symbol);setHolding(h||null);}}).catch(()=>{});
    };
    socket.on('prices:update',onPrices);socket.on('order:new',onNew);socket.on('order:updated',onUpd);socket.on('trade:executed',onTrade);
    return()=>{socket.off('prices:update',onPrices);socket.off('order:new',onNew);socket.off('order:updated',onUpd);socket.off('trade:executed',onTrade);};
  },[form.symbol,fetchQuote,updateWallet]);

  useEffect(()=>{
    if(!searchQ.trim()){setSearchRes([]);return;}
    const t=setTimeout(async()=>{try{const{data}=await api.get(`/stocks/search?q=${encodeURIComponent(searchQ)}`);setSearchRes(data.results||[]);}catch{}},350);
    return()=>clearTimeout(t);
  },[searchQ]);

  const selectSym=sym=>{setForm(p=>({...p,symbol:sym}));setSearchQ('');setSearchRes([]);fetchQuote(sym);};

  const handleSubmit=async(e)=>{
    e.preventDefault();
    if(!form.symbol){toast.error('Choose a symbol');return;}
    if(!form.quantity||parseInt(form.quantity)<1){toast.error('Enter quantity');return;}
    if(!form.price||parseFloat(form.price)<=0){toast.error('Enter price');return;}
    setPlacing(true);
    try{
      const{data}=await api.post('/orders',{symbol:form.symbol.toUpperCase(),type:form.type,quantity:parseInt(form.quantity),price:parseFloat(form.price),companyName:quote?.name||''});
      toast.success(`${form.type} order placed! ${data.tradesExecuted} trade(s) executed.`,{duration:5000});
      if(data.walletBalance!==undefined)updateWallet(data.walletBalance);
      setForm(p=>({...p,quantity:'',price:quote?.price?.toFixed(2)||p.price}));
      api.get('/orders/all?limit=40').then(({data})=>setOpenOrders(data.orders)).catch(()=>{});
    }catch(e){toast.error(e.response?.data?.message||'Order failed');}
    finally{setPlacing(false);}
  };

  const orderValue=(parseFloat(form.quantity)||0)*(parseFloat(form.price)||0);
  const up=(quote?.changePercent||0)>=0;
  const closes=history.map(d=>d.close);
  const lc=up?'#00d084':'#ff4560';
  const sparkData={labels:closes.map(()=>''),datasets:[{data:closes,borderColor:lc,backgroundColor:up?'rgba(0,208,132,0.1)':'rgba(255,69,96,0.1)',borderWidth:1.5,pointRadius:0,fill:true,tension:0.4}]};
  const sparkOpts={responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},tooltip:{enabled:false}},scales:{x:{display:false},y:{display:false}},animation:false};
  const buyOrders=openOrders.filter(o=>o.type==='BUY').sort((a,b)=>b.price-a.price);
  const sellOrders=openOrders.filter(o=>o.type==='SELL').sort((a,b)=>a.price-b.price);

  return(
    <div className="page fade-up">
      <h1 className="page-title">Trading Panel</h1>
      <div style={{display:'grid',gridTemplateColumns:'320px 1fr 280px',gap:16,alignItems:'start'}}>

        {/* Left: form */}
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="card">
            <div style={{position:'relative'}}>
              <input className="form-input" placeholder="🔍 Search symbol…" value={searchQ} onChange={e=>setSearchQ(e.target.value)}/>
              {searchRes.length>0&&<div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'var(--bg-3)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',zIndex:200,overflow:'hidden',boxShadow:'var(--shadow)'}}>
                {searchRes.map(r=><div key={r.symbol} onClick={()=>selectSym(r.symbol)} style={{padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid var(--border)',display:'flex',flexDirection:'column',gap:2}} onMouseOver={e=>e.currentTarget.style.background='var(--bg-4)'} onMouseOut={e=>e.currentTarget.style.background=''}><span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:13}}>{r.symbol}</span><span style={{fontSize:11,color:'var(--text-2)'}}>{r.name}</span></div>)}
              </div>}
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:6,marginTop:12}}>
              {POPULAR.map(s=><button key={s} onClick={()=>selectSym(s)} style={{padding:'3px 9px',fontSize:11,fontFamily:'var(--font-mono)',fontWeight:600,border:'1px solid',borderRadius:5,cursor:'pointer',transition:'all .12s',...(form.symbol===s?{borderColor:'var(--blue)',color:'var(--blue)',background:'var(--blue-dim)'}:{borderColor:'var(--border)',color:'var(--text-2)',background:'transparent'})}}>{s}</button>)}
            </div>
          </div>

          {quote&&<div className="card" style={{padding:0,overflow:'hidden'}}>
            <div style={{padding:'14px 16px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div><div style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:16,marginBottom:2}}>{quote.symbol}</div><span style={{fontSize:11,color:'var(--text-2)'}}>{quote.name}</span></div>
              <div style={{textAlign:'right'}}><div style={{fontFamily:'var(--font-mono)',fontSize:22,fontWeight:700}}>{fmtCurrency(quote.price)}</div><div style={{fontFamily:'var(--font-mono)',fontSize:12,color:up?'var(--green)':'var(--red)',fontWeight:600}}>{up?'▲':'▼'}{Math.abs(quote.changePercent||0).toFixed(2)}%</div></div>
            </div>
            {history.length>0&&<div style={{height:70}}><Line data={sparkData} options={sparkOpts}/></div>}
            <div style={{display:'flex',justifyContent:'space-around',padding:'10px 16px',background:'var(--bg-1)',borderTop:'1px solid var(--border)',fontSize:11}}>
              {[['Open',fmtCurrency(quote.open)],['High',fmtCurrency(quote.high)],['Low',fmtCurrency(quote.low)],['Vol',quote.volume?(quote.volume/1e6).toFixed(1)+'M':'—']].map(([l,v])=>(
                <div key={l} style={{textAlign:'center'}}><div style={{color:'var(--text-3)',marginBottom:2}}>{l}</div><div style={{fontFamily:'var(--font-mono)',fontWeight:600,fontSize:12}}>{v}</div></div>
              ))}
            </div>
            <div style={{padding:'8px 16px',textAlign:'right'}}><button className="btn btn-ghost" style={{fontSize:11,padding:'4px 10px'}} onClick={()=>nav(`/stock/${quote.symbol}`)}>Full Chart →</button></div>
          </div>}

          <div className="card">
            <h3 style={{fontSize:14,fontWeight:700,marginBottom:14}}>Place Limit Order</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,background:'var(--bg-1)',padding:4,borderRadius:'var(--r-md)',marginBottom:14}}>
              {['BUY','SELL'].map(t=><button key={t} type="button" onClick={()=>setForm(p=>({...p,type:t}))} style={{padding:10,border:'none',borderRadius:8,cursor:'pointer',fontWeight:700,fontSize:13,fontFamily:'var(--font-mono)',transition:'all .15s',...(form.type===t?(t==='BUY'?{background:'var(--green)',color:'#000'}:{background:'var(--red)',color:'#fff'}):{background:'transparent',color:'var(--text-3)'})}}>{t==='BUY'?'▲ BUY':'▼ SELL'}</button>)}
            </div>
            <form onSubmit={handleSubmit} style={{display:'flex',flexDirection:'column',gap:12}}>
              <div className="form-group">
                <label className="form-label">Symbol</label>
                <input className="form-input" value={form.symbol} onChange={e=>setForm(p=>({...p,symbol:e.target.value.toUpperCase()}))} placeholder="e.g. AAPL" style={{textTransform:'uppercase',fontFamily:'var(--font-mono)',fontWeight:700}}/>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <input className="form-input" type="number" min="1" placeholder="0" value={form.quantity} onChange={e=>setForm(p=>({...p,quantity:e.target.value}))}/>
                {form.type==='SELL'&&holding&&<span style={{fontSize:10,color:'var(--text-3)'}}>You hold {holding.quantity} shares</span>}
                {form.type==='SELL'&&!holding&&<span style={{fontSize:10,color:'var(--red)'}}>No shares of {form.symbol||'this stock'}</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Limit Price (₹)</label>
                <input className="form-input" type="number" min="0.01" step="0.01" placeholder="0.00" value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))}/>
                {quote&&<span style={{fontSize:10,color:'var(--text-3)',display:'flex',justifyContent:'space-between'}}><span>Market: {fmtCurrency(quote.price)}</span><button type="button" onClick={()=>setForm(p=>({...p,price:quote.price.toFixed(2)}))} style={{background:'none',border:'none',color:'var(--blue)',fontSize:10,cursor:'pointer',textDecoration:'underline'}}>Use market</button></span>}
              </div>
              {orderValue>0&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 13px',background:'var(--bg-1)',borderRadius:'var(--r-md)',border:'1px solid var(--border)'}}><span style={{fontSize:12,color:'var(--text-2)'}}>Order Value</span><span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:15,color:form.type==='BUY'?'var(--red)':'var(--green)'}}>{form.type==='BUY'?'−':'+'}{fmtCurrency(orderValue)}</span></div>}
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'var(--text-3)'}}><span>Cash Available</span><span style={{color:'var(--green)',fontFamily:'var(--font-mono)'}}>{fmtCurrency(user?.walletBalance)}</span></div>
              <button type="submit" className={`btn btn-${form.type==='BUY'?'buy':'sell'}`} disabled={placing||loading}>{placing?<><span className="spinner"/>Processing…</>:`${form.type==='BUY'?'▲ Place BUY':'▼ Place SELL'} Order`}</button>
            </form>
          </div>
        </div>

        {/* Middle: order book */}
        <div className="card">
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <h3 style={{fontSize:14,fontWeight:700}}>Order Book</h3>
            <div style={{display:'flex',alignItems:'center',gap:6}}><span style={{width:7,height:7,borderRadius:'50%',background:'var(--green)',display:'inline-block',boxShadow:'0 0 6px var(--green)'}}/><span style={{fontSize:11,color:'var(--text-3)',fontFamily:'var(--font-mono)'}}>LIVE</span></div>
          </div>
          <div style={{marginBottom:10}}>
            <div style={{fontSize:10,color:'var(--red)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:6}}>▼ Sell Orders</div>
            {sellOrders.length===0?<div style={{fontSize:12,color:'var(--text-3)',padding:'8px 0'}}>No sell orders</div>:(
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Price','Qty','Rem.','Trader'].map(h=><th key={h} style={{padding:'4px 8px',textAlign:'left',fontSize:10,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
              <tbody>{sellOrders.slice(0,8).map(o=><tr key={o._id} style={{borderBottom:'1px solid var(--border)'}}><td style={{padding:'5px 8px',fontFamily:'var(--font-mono)',color:'var(--red)',fontWeight:600}}>₹{o.price}</td><td style={{padding:'5px 8px',fontFamily:'var(--font-mono)'}}>{o.quantity}</td><td style={{padding:'5px 8px',fontFamily:'var(--font-mono)',color:'var(--text-2)'}}>{o.remainingQuantity}</td><td style={{padding:'5px 8px',color:'var(--text-3)',fontSize:11}}>{o.user?.name?.split(' ')[0]||'—'}</td></tr>)}</tbody>
              </table>
            )}
          </div>
          {buyOrders[0]&&sellOrders[0]&&<div style={{textAlign:'center',padding:'6px 0',background:'var(--bg-1)',borderRadius:6,marginBottom:10,fontSize:11,color:'var(--text-2)',fontFamily:'var(--font-mono)'}}>Spread: ₹{Math.abs(sellOrders[0].price-buyOrders[0].price).toFixed(2)}</div>}
          <div>
            <div style={{fontSize:10,color:'var(--green)',fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',marginBottom:6}}>▲ Buy Orders</div>
            {buyOrders.length===0?<div style={{fontSize:12,color:'var(--text-3)',padding:'8px 0'}}>No buy orders</div>:(
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}><thead><tr>{['Price','Qty','Rem.','Trader'].map(h=><th key={h} style={{padding:'4px 8px',textAlign:'left',fontSize:10,color:'var(--text-3)',fontWeight:600,textTransform:'uppercase'}}>{h}</th>)}</tr></thead>
              <tbody>{buyOrders.slice(0,8).map(o=><tr key={o._id} style={{borderBottom:'1px solid var(--border)'}}><td style={{padding:'5px 8px',fontFamily:'var(--font-mono)',color:'var(--green)',fontWeight:600}}>₹{o.price}</td><td style={{padding:'5px 8px',fontFamily:'var(--font-mono)'}}>{o.quantity}</td><td style={{padding:'5px 8px',fontFamily:'var(--font-mono)',color:'var(--text-2)'}}>{o.remainingQuantity}</td><td style={{padding:'5px 8px',color:'var(--text-3)',fontSize:11}}>{o.user?.name?.split(' ')[0]||'—'}</td></tr>)}</tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right: live feed + market snapshot */}
        <div style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="card">
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}><span style={{width:8,height:8,borderRadius:'50%',background:'var(--red)',display:'inline-block'}}/><h3 style={{fontSize:14,fontWeight:700}}>Live Executions</h3></div>
            {feed.length===0?<div style={{color:'var(--text-3)',fontSize:12}}>Waiting for trades…</div>:(
              <div style={{display:'flex',flexDirection:'column',gap:7}}>
                {feed.map((t,i)=><div key={i} className="flash-new" style={{padding:'9px 12px',background:'var(--bg-3)',borderRadius:8,border:'1px solid var(--green-dim)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div><span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:13,color:'var(--green)'}}>{t.symbol}</span><div style={{fontSize:11,color:'var(--text-2)',marginTop:2}}>{t.quantity} × {fmtCurrency(t.price)}</div></div>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:12,fontWeight:700,color:'var(--green)'}}>{fmtCurrency(t.totalValue)}</span>
                </div>)}
              </div>
            )}
          </div>
          <div className="card">
            <h3 style={{fontSize:14,fontWeight:700,marginBottom:14}}>Market Snapshot</h3>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {POPULAR.slice(0,8).map(sym=>{
                const q=prices[sym];const up=(q?.changePercent||0)>=0;
                return(<div key={sym} onClick={()=>selectSym(sym)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',padding:'6px 8px',borderRadius:6,transition:'background .12s'}} onMouseOver={e=>e.currentTarget.style.background='var(--bg-3)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:12,fontWeight:700}}>{sym}</span>
                  <div style={{textAlign:'right'}}><div style={{fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600}}>{q?fmtCurrency(q.price):'—'}</div>{q&&<div style={{fontSize:10,color:up?'var(--green)':'var(--red)',fontFamily:'var(--font-mono)'}}>{up?'▲':'▼'}{Math.abs(q.changePercent||0).toFixed(2)}%</div>}</div>
                </div>);
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}