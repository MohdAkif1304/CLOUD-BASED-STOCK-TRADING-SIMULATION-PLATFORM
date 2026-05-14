import React,{useState,useEffect,useCallback} from 'react';
import api from '../../services/api';
import socket from '../../socket/socket';
import {fmtCurrency,fmtDate} from '../../utils/format';
import toast from 'react-hot-toast';

export default function OrdersList(){
  const [orders,setOrders]=useState([]); const [loading,setLoading]=useState(true);
  const [cancelling,setCancelling]=useState(null);
  const [filters,setFilters]=useState({symbol:'',type:'',status:''});
  const [page,setPage]=useState(1); const [pagination,setPagination]=useState({pages:1,total:0});

  const load=useCallback(async(pg=1)=>{
    setLoading(true);
    try{
      const p=new URLSearchParams({page:pg,limit:15});
      if(filters.symbol)p.append('symbol',filters.symbol.toUpperCase());
      if(filters.type)p.append('type',filters.type);
      if(filters.status)p.append('status',filters.status);
      const{data}=await api.get(`/orders?${p}`);
      setOrders(data.orders);setPagination({pages:data.pages,total:data.total});setPage(data.page);
    }catch(e){console.error(e);}finally{setLoading(false);}
  },[filters]);

  useEffect(()=>{load(1);},[load]);
  useEffect(()=>{
    const onUpd=u=>setOrders(p=>p.map(o=>o._id===u._id?{...o,...u}:o));
    socket.on('order:updated',onUpd); socket.on('trade:executed',()=>load(page));
    return()=>{socket.off('order:updated',onUpd);socket.off('trade:executed');};
  },[load,page]);

  const cancel=async(id)=>{
    setCancelling(id);
    try{await api.put(`/orders/${id}/cancel`);toast.success('Order cancelled');setOrders(p=>p.map(o=>o._id===id?{...o,status:'CANCELLED'}:o));}
    catch(e){toast.error(e.response?.data?.message||'Failed');}finally{setCancelling(null);}
  };

  const counts=orders.reduce((a,o)=>({...a,[o.status]:(a[o.status]||0)+1}),{});

  return(
    <div className="page fade-up">
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:22,flexWrap:'wrap',gap:12}}>
        <h1 className="page-title" style={{marginBottom:0}}>My Orders</h1>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{width:7,height:7,borderRadius:'50%',background:'var(--green)',display:'inline-block',boxShadow:'0 0 6px var(--green)'}}/>
          <span style={{fontSize:11,color:'var(--text-3)',fontFamily:'var(--font-mono)'}}>LIVE UPDATES</span>
        </div>
      </div>
      <div style={{display:'flex',gap:10,marginBottom:18,flexWrap:'wrap'}}>
        {[['OPEN','var(--yellow)'],['PARTIAL','var(--blue)'],['FILLED','var(--green)'],['CANCELLED','var(--red)']].map(([s,c])=>(
          <div key={s} style={{padding:'6px 14px',borderRadius:20,background:'var(--bg-2)',border:`1px solid ${c}30`,fontSize:12,fontFamily:'var(--font-mono)',color:c}}>{s}: <strong>{counts[s]||0}</strong></div>
        ))}
        <div style={{marginLeft:'auto',padding:'6px 14px',background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:20,fontSize:12,color:'var(--text-2)'}}>Total: {pagination.total}</div>
      </div>
      <div className="card" style={{marginBottom:16,padding:'14px 18px'}}>
        <div style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center'}}>
          <input className="form-input" placeholder="Symbol…" value={filters.symbol} onChange={e=>setFilters(p=>({...p,symbol:e.target.value}))} style={{maxWidth:160,textTransform:'uppercase'}}/>
          <select className="form-select" value={filters.type} onChange={e=>setFilters(p=>({...p,type:e.target.value}))} style={{maxWidth:140}}><option value="">All Types</option><option value="BUY">BUY</option><option value="SELL">SELL</option></select>
          <select className="form-select" value={filters.status} onChange={e=>setFilters(p=>({...p,status:e.target.value}))} style={{maxWidth:160}}><option value="">All Statuses</option><option value="OPEN">OPEN</option><option value="PARTIAL">PARTIAL</option><option value="FILLED">FILLED</option><option value="CANCELLED">CANCELLED</option></select>
          <button className="btn btn-ghost" style={{fontSize:12,padding:'8px 14px'}} onClick={()=>setFilters({symbol:'',type:'',status:''})}>Clear</button>
        </div>
      </div>
      <div className="card" style={{padding:0,overflow:'hidden'}}>
        {loading?<div style={{display:'flex',justifyContent:'center',padding:60}}><div className="spinner" style={{width:36,height:36,borderWidth:3}}/></div>
        :orders.length===0?<div className="empty"><div className="icon">📋</div><p>No orders found</p></div>:(
          <>
            <div className="table-wrap" style={{border:'none',borderRadius:0}}>
              <table><thead><tr><th>Symbol</th><th>Type</th><th>Qty</th><th>Filled</th><th>Rem.</th><th>Price</th><th>Value</th><th>Status</th><th>Placed At</th><th>Action</th></tr></thead>
              <tbody>{orders.map(o=>{
                const filled=o.quantity-o.remainingQuantity;const canCancel=['OPEN','PARTIAL'].includes(o.status);
                return(<tr key={o._id}>
                  <td><div style={{fontFamily:'var(--font-mono)',fontWeight:700}}>{o.symbol}</div>{o.companyName&&<div style={{fontSize:10,color:'var(--text-3)',fontFamily:'var(--font-ui)',maxWidth:120}}>{o.companyName}</div>}</td>
                  <td><span className={`badge badge-${o.type.toLowerCase()}`}>{o.type}</span></td>
                  <td>{o.quantity}</td>
                  <td style={{color:filled>0?'var(--green)':'var(--text-3)'}}>{filled}</td>
                  <td style={{color:o.remainingQuantity>0?'var(--yellow)':'var(--text-3)'}}>{o.remainingQuantity}</td>
                  <td>{fmtCurrency(o.price)}</td>
                  <td>{fmtCurrency(o.quantity*o.price)}</td>
                  <td><span className={`badge badge-${o.status.toLowerCase()}`}>{o.status}</span></td>
                  <td style={{color:'var(--text-3)',fontFamily:'var(--font-ui)',fontSize:11}}>{fmtDate(o.createdAt)}</td>
                  <td>{canCancel?<button className="btn btn-danger" onClick={()=>cancel(o._id)} disabled={cancelling===o._id}>{cancelling===o._id?'…':'Cancel'}</button>:<span style={{color:'var(--text-3)',fontSize:11}}>—</span>}</td>
                </tr>);
              })}</tbody></table>
            </div>
            {pagination.pages>1&&<div className="pagination" style={{padding:'14px 0'}}>
              <button className="btn btn-ghost" style={{fontSize:12,padding:'6px 14px'}} disabled={page<=1} onClick={()=>load(page-1)}>← Prev</button>
              <span>Page {page} of {pagination.pages}</span>
              <button className="btn btn-ghost" style={{fontSize:12,padding:'6px 14px'}} disabled={page>=pagination.pages} onClick={()=>load(page+1)}>Next →</button>
            </div>}
          </>
        )}
      </div>
    </div>
  );
}