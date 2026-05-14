import React,{useState,useEffect} from 'react';
import {useNavigate} from 'react-router-dom';
import api from '../../services/api';
import socket from '../../socket/socket';
import {fmtCurrency} from '../../utils/format';
import toast from 'react-hot-toast';

const SECTIONS=[
  {label:'US Markets',     syms:['AAPL','TSLA','GOOGL','MSFT','AMZN','META','NVDA','NFLX','AMD','INTC']},
  {label:'Indian Markets', syms:['RELIANCE','TCS','INFY','HDFCBANK','WIPRO']},
];

export default function MarketPage(){
  const nav=useNavigate();
  const [prices,setPrices]=useState({});
  const [watchlist,setWatchlist]=useState([]);
  const [searchQ,setSearchQ]=useState('');
  const [searchRes,setSearchRes]=useState([]);

  useEffect(()=>{
    api.get('/stocks/prices').then(({data})=>setPrices(data.prices||{})).catch(()=>{});
    api.get('/watchlist').then(({data})=>setWatchlist(data.watchlist.map(w=>w.symbol))).catch(()=>{});
    socket.on('prices:update',setPrices);
    return ()=>socket.off('prices:update',setPrices);
  },[]);

  useEffect(()=>{
    if(!searchQ.trim()){setSearchRes([]);return;}
    const t=setTimeout(async()=>{
      try{const{data}=await api.get(`/stocks/search?q=${encodeURIComponent(searchQ)}`);setSearchRes(data.results||[]);}catch{}
    },400);
    return ()=>clearTimeout(t);
  },[searchQ]);

  const toggleWL=async(sym,name)=>{
    const watched=watchlist.includes(sym);
    try{
      if(watched){await api.delete(`/watchlist/${sym}`);setWatchlist(p=>p.filter(s=>s!==sym));toast.success(`${sym} removed`);}
      else{await api.post('/watchlist',{symbol:sym,companyName:name});setWatchlist(p=>[...p,sym]);toast.success(`${sym} added ⭐`);}
    }catch(e){toast.error(e.response?.data?.message||'Error');}
  };

  const QuoteRow=({sym})=>{
    const q=prices[sym];const up=(q?.changePercent||0)>=0;
    return(
      <tr onClick={()=>nav(`/stock/${sym}`)} style={{cursor:'pointer'}}>
        <td><div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:36,height:36,borderRadius:8,background:'var(--bg-1)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'var(--font-mono)',fontSize:9,fontWeight:700,color:'var(--text-2)',flexShrink:0}}>{sym.slice(0,4)}</div>
          <div><div style={{fontWeight:600,fontSize:13}}>{sym}</div><div style={{fontSize:11,color:'var(--text-2)',fontFamily:'var(--font-ui)'}}>{q?.name||'—'}</div></div>
        </div></td>
        <td style={{fontWeight:700,fontSize:14}}>{q?fmtCurrency(q.price):'—'}</td>
        <td style={{color:up?'var(--green)':'var(--red)',fontWeight:600}}>{q?`${up?'+':''}${(q.change||0).toFixed(2)}`:'—'}</td>
        <td>{q&&<span style={{display:'inline-flex',alignItems:'center',gap:4,padding:'2px 8px',borderRadius:4,fontSize:11,fontWeight:700,fontFamily:'var(--font-mono)',background:up?'var(--green-dim)':'var(--red-dim)',color:up?'var(--green)':'var(--red)'}}>{up?'▲':'▼'}{Math.abs(q.changePercent||0).toFixed(2)}%</span>}</td>
        <td style={{color:'var(--text-2)'}}>{q?fmtCurrency(q.high):'—'}</td>
        <td style={{color:'var(--text-2)'}}>{q?fmtCurrency(q.low):'—'}</td>
        <td style={{color:'var(--text-2)'}}>{q?.volume?(q.volume/1e6).toFixed(2)+'M':'—'}</td>
        <td><div style={{display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
          <button className="btn-icon" onClick={()=>toggleWL(sym,q?.name)}>{watchlist.includes(sym)?'⭐':'☆'}</button>
          <button className="btn btn-primary" style={{fontSize:11,padding:'5px 10px'}} onClick={()=>nav(`/trade?symbol=${sym}`)}>Trade</button>
        </div></td>
      </tr>
    );
  };

  return(
    <div className="page fade-up">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:14}}>
        <h1 className="page-title" style={{marginBottom:0}}>Market Watch</h1>
        <div style={{position:'relative',minWidth:280}}>
          <input className="form-input" placeholder="🔍 Search stocks — AAPL, RELIANCE…" value={searchQ} onChange={e=>setSearchQ(e.target.value)}/>
          {searchRes.length>0&&(
            <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,right:0,background:'var(--bg-3)',border:'1px solid var(--border)',borderRadius:'var(--r-md)',zIndex:200,overflow:'hidden',boxShadow:'var(--shadow)'}}>
              {searchRes.map(r=>(
                <div key={r.symbol} onClick={()=>{nav(`/stock/${r.symbol}`);setSearchQ('');setSearchRes([]);}}
                  style={{padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}
                  onMouseOver={e=>e.currentTarget.style.background='var(--bg-4)'} onMouseOut={e=>e.currentTarget.style.background=''}>
                  <div><span style={{fontFamily:'var(--font-mono)',fontWeight:700,fontSize:13}}>{r.symbol}</span><span style={{fontSize:11,color:'var(--text-2)',marginLeft:8}}>{r.name}</span></div>
                  <span style={{fontSize:10,color:'var(--text-3)'}}>{r.exchange}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {SECTIONS.map(({label,syms})=>(
        <div key={label} style={{marginBottom:28}}>
          <h2 style={{fontSize:14,fontWeight:600,color:'var(--text-2)',marginBottom:12,textTransform:'uppercase',letterSpacing:'.08em',display:'flex',alignItems:'center',gap:8}}>
            <span style={{width:3,height:14,background:'var(--blue)',borderRadius:2,display:'inline-block'}}/>
            {label}
          </h2>
          <div className="table-wrap">
            <table><thead><tr><th>Symbol</th><th>Price</th><th>Change</th><th>Change %</th><th>Day High</th><th>Day Low</th><th>Volume</th><th>Actions</th></tr></thead>
            <tbody>{syms.map(s=><QuoteRow key={s} sym={s}/>)}</tbody></table>
          </div>
        </div>
      ))}
    </div>
  );
}