// src/main.jsx — FIXED: Only register Chart.js elements that exist in chart.js v4
// TimeScale and TimeSeriesScale require chartjs-adapter-date-fns which is NOT installed
// Removing them fixes the blank screen crash
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// Register once globally — all components share this
ChartJS.register(
  CategoryScale, LinearScale,
  PointElement, LineElement,
  BarElement, ArcElement,
  Title, Tooltip, Legend, Filler
);

// Global dark theme defaults
ChartJS.defaults.color = '#8a9bba';
ChartJS.defaults.borderColor = '#1e2d45';
ChartJS.defaults.font.family = "'JetBrains Mono', monospace";
ChartJS.defaults.font.size = 11;

import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
