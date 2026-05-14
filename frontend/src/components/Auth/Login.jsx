import React,{useState} from 'react';
import {Link,useNavigate,useLocation} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login(){
  const {login}=useAuth(); const nav=useNavigate(); const from=useLocation().state?.from?.pathname||'/dashboard';
  const [f,setF]=useState({email:'',password:''}); const [l,setL]=useState(false); const [e,setE]=useState({});
  const ch=ev=>{setF(p=>({...p,[ev.target.name]:ev.target.value}));setE(p=>({...p,[ev.target.name]:''}));};
  const sub=async(ev)=>{
    ev.preventDefault();
    const err={};if(!f.email)err.email='Required';if(!f.password)err.password='Required';
    if(Object.keys(err).length){setE(err);return;}
    setL(true);
    try{await login(f.email,f.password);toast.success('Welcome back! 🚀');nav(from,{replace:true});}
    catch(er){toast.error(er.response?.data?.message||'Login failed');}
    finally{setL(false);}
  };
  return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg-0)',padding:24,position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',width:600,height:600,borderRadius:'50%',background:'radial-gradient(circle,rgba(59,130,246,.07) 0%,transparent 70%)',top:-150,right:-100,pointerEvents:'none'}}/>
      <div style={{width:'100%',maxWidth:400,background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:'var(--r-xl)',padding:'40px 36px',boxShadow:'var(--shadow)',position:'relative',zIndex:1}} className="fade-up">
        <div style={{textAlign:'center',marginBottom:28}}>
          <div style={{fontSize:48,marginBottom:10}}>📈</div>
          <h1 style={{fontFamily:'var(--font-mono)',fontSize:26,fontWeight:700,letterSpacing:'-.04em',marginBottom:6}}>TradeSimX</h1>
          <p style={{fontSize:13,color:'var(--text-2)'}}>Sign in to your account</p>
        </div>
        <form onSubmit={sub} style={{display:'flex',flexDirection:'column',gap:14}}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" name="email" placeholder="trader@example.com" value={f.email} onChange={ch} autoComplete="email" style={e.email?{borderColor:'var(--red)'}:{}}/>
            {e.email&&<span className="form-error">{e.email}</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" name="password" placeholder="••••••••" value={f.password} onChange={ch} autoComplete="current-password" style={e.password?{borderColor:'var(--red)'}:{}}/>
            {e.password&&<span className="form-error">{e.password}</span>}
          </div>
          <button type="submit" className="btn btn-primary" style={{width:'100%',padding:'12px',fontSize:14,marginTop:4}} disabled={l}>
            {l?<><span className="spinner"/>Signing in…</>:'Sign In →'}
          </button>
        </form>
        <p style={{textAlign:'center',fontSize:13,color:'var(--text-2)',marginTop:18}}>No account? <Link to="/register" style={{color:'var(--blue)',textDecoration:'none',fontWeight:600}}>Create one</Link></p>
        <div style={{marginTop:14,textAlign:'center',fontSize:11,color:'var(--text-3)',padding:'8px',background:'var(--bg-1)',borderRadius:'var(--r-sm)'}}>🎓 Academic simulation · Virtual funds only</div>
      </div>
    </div>
  );
}