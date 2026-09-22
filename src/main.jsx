import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// [2.35.35] Тема уже стоит на <body> из inline-скрипта.
try {
  if (localStorage.getItem('ghost-chat-theme') === 'dark') {
    document.body.classList.add('dark');
  }
} catch { /* noop */ }

// [2.35.35] Единая точка показа. Chat.jsx дёргает window.__ready() когда готов.
// Boot-splash удаляется из DOM — гарантированно, что не вернётся.
let revealed = false;
window.__ready = function () {
  if (revealed) return;
  revealed = true;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.add('app-ready');
      const splash = document.getElementById('boot-splash');
      if (splash && splash.parentNode) {
        // даём fade-out проиграть 320мс, потом удаляем из DOM
        setTimeout(() => {
          if (splash.parentNode) splash.parentNode.removeChild(splash);
        }, 360);
      }
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