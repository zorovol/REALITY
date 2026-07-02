import React from 'react';
import ReactDOM from 'react-dom/client';
import TradingApp from './TradingApp.jsx';
import AdminPage from './pages/AdminPage.jsx';
import './styles.css';

const isAdminPath = () => {
  const p = window.location.pathname.replace(/\/$/, '') || '/';
  return p === '/admin';
};

const Root = isAdminPath() ? AdminPage : TradingApp;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>,
);
