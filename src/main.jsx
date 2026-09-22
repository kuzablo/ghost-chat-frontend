import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// [2.35.10] Тема стоит из inline-скрипта в index.html.
try {
  if (localStorage.getItem('ghost-chat-theme') === 'dark') {
    document.body.classList.add('dark');
  }
} catch { /* noop */ }

// [2.35.10] Единая точка показа. Chat.jsx дёргает window.__ready() когда готов.
let revealed = false;
window.__ready = function () {
  if (revealed) return;
  revealed = true;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.add('app-ready');
    });
  });
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker зарегистрирован:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker не зарегистрирован:', err);
      });
  });
}