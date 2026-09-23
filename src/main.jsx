// [2.36.6] Метки этапов загрузки на сервер — диагностика Android-зависаний.
// Самый верх модуля: до любых импортов React и компонентов.
if (typeof window !== 'undefined' && typeof window.__clientLog === 'function') {
  window.__clientLog('module-load-start', 'main.jsx top reached');
} else if (typeof window !== 'undefined') {
  // Фолбэк: если main.jsx загрузился раньше inline-скрипта (не должно быть).
  window.__clientLog = function () { /* noop */ };
}

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

// [2.36.6] Единая точка показа. Chat.jsx дёргает window.__ready() когда готов.
let revealed = false;
window.__ready = function () {
  if (revealed) return;
  revealed = true;

  if (typeof window.__clientLog === 'function') {
    window.__clientLog('boot-ready-called', 'window.__ready invoked');
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.add('app-ready');
      const splash = document.getElementById('boot-splash');
      if (splash && splash.parentNode) {
        setTimeout(() => {
          if (splash.parentNode) splash.parentNode.removeChild(splash);
        }, 360);
      }
    });
  });
};

// [2.36.6] Обёртка рендера: если React не смонтируется — отправим ошибку
try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  if (typeof window.__clientLog === 'function') {
    window.__clientLog('module-render-called', 'createRoot().render() done');
  }
} catch (err) {
  if (typeof window.__clientLog === 'function') {
    window.__clientLog(
      'render-throw',
      (err && err.message) || String(err),
      (err && err.stack) || ''
    );
  }
  throw err;
}

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker зарегистрирован:', reg.scope);
        if (typeof window.__clientLog === 'function') {
          window.__clientLog('sw-registered', reg.scope);
        }
        reg.update().catch(() => { /* noop */ });
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker не зарегистрирован:', err);
        if (typeof window.__clientLog === 'function') {
          window.__clientLog('sw-register-failed', (err && err.message) || String(err));
        }
      });
  });
}