import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
const Ctx = createContext(null);
export const AuthProvider = ({ children }) => {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const verify = async () => {
      const t = localStorage.getItem('token');
      if (!t) { setLoading(false); return; }
      try {
        api.defaults.headers.common['Authorization'] = `Bearer ${t}`;
        const { data } = await api.get('/auth/me');
        setUser(data.user);
      } catch { localStorage.removeItem('token'); delete api.defaults.headers.common['Authorization']; }
      finally { setLoading(false); }
    };
    verify();
  }, []);
  const register = useCallback(async (name, email, password) => {
    const { data } = await api.post('/auth/register', { name, email, password });
    localStorage.setItem('token', data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data.user); return data;
  }, []);
  const login = useCallback(async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.token);
    api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setUser(data.user); return data;
  }, []);
  const logout = useCallback(() => {
    localStorage.removeItem('token');
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  }, []);
  const updateWallet = useCallback(bal => setUser(p => p ? { ...p, walletBalance: bal } : p), []);
  return <Ctx.Provider value={{ user, loading, isAuthenticated: !!user, register, login, logout, updateWallet }}>{children}</Ctx.Provider>;
};
export const useAuth = () => { const c = useContext(Ctx); if (!c) throw new Error('useAuth must be inside AuthProvider'); return c; };