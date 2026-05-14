import axios from 'axios';
const api = axios.create({ baseURL: '/api', timeout: 15000 });
api.interceptors.request.use(cfg => { const t = localStorage.getItem('token'); if (t) cfg.headers.Authorization = `Bearer ${t}`; return cfg; }, e => Promise.reject(e));
api.interceptors.response.use(r => r, e => { if (e.response?.status === 401) { localStorage.removeItem('token'); delete api.defaults.headers.common['Authorization']; } return Promise.reject(e); });
export default api;