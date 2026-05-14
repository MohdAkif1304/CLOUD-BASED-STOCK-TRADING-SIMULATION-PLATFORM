import React,{useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {useAuth} from '../../context/AuthContext';
import toast from 'react-hot-toast';

export default function Register(){
  const {register}=useAuth(); const nav=useNavigate();
  const [f,setF]=useState({name:'',email:'',password:'',confirm:''});
  const [l,setL]=useState(false); const [e,setE]=useState({});
  const ch=ev=>{setF(p=>({...p,[ev.target.name]:ev.target.value}));setE(p=>({...p,[ev.target.name]:''}));};
  const sub=async(ev)=>{
    ev.preventDefault();
    const err={};
    if(!f.name.trim())err.name='Name required';
    if(!f.email)err.email='Email required';else if(!/\S+@\S+\.\S+/.test(f.email))err.email='Invalid email';
    if(!f.password)err.password='Password required';else if(f.password.length<6)err.password='Min 6 chars';
    if(f.password!==f.confirm)err.confirm='Passwords do not match';
    if(Object.keys(err).length){setE(err);return;}
    setL(true);
    try{await register(f.name.trim(),f.email,f.password);toast.success('Account created! Starting with ₹1,00,000 🎉');nav('/dashboard');}
    catch(er){toast.error(er.response?.data?.message||'Registration failed');}
    finally{setL(false);}
  };
  const fields=[{n:'name',l:'Full Name',t:'text',p:'John Doe'},{n:'email',l:'Email',t:'email',p:'trader@example.com'},{n:'password',l:'Password',t:'password',p:'Min 6 chars'},{n:'confirm',l:'Confirm Password',t:'password',p:'Re-enter password'}];
  return(
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg-0)',padding:24,position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',width:600,height:600,borderRadius:'50%',background:'radial-gradient(circle,rgba(59,130,246,.07) 0%,transparent 70%)',top:-150,right:-100,pointerEvents:'none'}}/>
      <div style={{width:'100%',maxWidth:420,background:'var(--bg-2)',border:'1px solid var(--border)',borderRadius:'var(--r-xl)',padding:'40px 36px',boxShadow:'var(--shadow)',position:'relative',zIndex:1}} className="fade-up">
        <div style={{textAlign:'center',marginBottom:24}}>
          <div style={{fontSize:44,marginBottom:8}}>📈</div>
          <h1 style={{fontFamily:'var(--font-mono)',fontSize:24,fontWeight:700,letterSpacing:'-.04em',marginBottom:6}}>Create Account</h1>
          <p style={{fontSize:13,color:'var(--text-2)'}}>Start with ₹1,00,000 virtual balance</p>
        </div>
        <form onSubmit={sub} style={{display:'flex',flexDirection:'column',gap:12}}>
          {fields.map(({n,l,t,p})=>(
            <div key={n} className="form-group">
              <label className="form-label">{l}</label>
              <input className="form-input" type={t} name={n} placeholder={p} value={f[n]} onChange={ch} style={e[n]?{borderColor:'var(--red)'}:{}}/>
              {e[n]&&<span className="form-error">{e[n]}</span>}
            </div>
          ))}
          <button type="submit" className="btn btn-primary" style={{width:'100%',padding:'12px',fontSize:14,marginTop:4}} disabled={l}>
            {l?<><span className="spinner"/>Creating…</>:'Create Account →'}
          </button>
        </form>
        <p style={{textAlign:'center',fontSize:13,color:'var(--text-2)',marginTop:18}}>Have account? <Link to="/login" style={{color:'var(--blue)',textDecoration:'none',fontWeight:600}}>Sign in</Link></p>
      </div>
    </div>
  );
}