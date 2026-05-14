export const fmtCurrency = (n, sym = '₹') => `${sym}${(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}`;
export const fmtDate = (d) => new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
export const fmtDateShort = (d) => new Date(d).toLocaleString('en-IN',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'});
export const pnlColor = n => n >= 0 ? 'var(--green)' : 'var(--red)';
export const pnlSign  = n => n >= 0 ? '+' : '';