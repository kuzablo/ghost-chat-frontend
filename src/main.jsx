import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// [2.35.9] Тема уже стоит на <body> из inline-скрипта в index.html.
// Дублируем для случая, когда inline не сработал (например, при прямом вызове).
try {
  if (localStorage.getItem('ghost-chat-theme') === 'dark') {
    document.body.classList.add('dark');
  }
} catch { /* noop */ }

const rootEl = document.getElementById('root');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// [2.35.9] Показать содержимое после первой отрисовки (два RAF — гарантия).
// К этому моменту основной CSS уже применён, элементы на своих местах.
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    rootEl.classList.add('ready');
  });
});

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