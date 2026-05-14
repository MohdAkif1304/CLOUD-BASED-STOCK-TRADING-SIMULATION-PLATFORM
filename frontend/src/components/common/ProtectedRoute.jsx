import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16,background:'var(--bg-0)'}}>
      <div className="spinner" style={{width:40,height:40,borderWidth:3}} />
      <span style={{fontFamily:'var(--font-mono)',fontSize:13,color:'var(--text-2)'}}>Loading…</span>
    </div>
  );
  return isAuthenticated ? children : <Navigate to="/login" state={{ from: location }} replace />;
};
export default ProtectedRoute;