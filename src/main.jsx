// [2.37.2] Диагностика: chat-render-start в Chat.jsx + ErrorBoundary
// + перехват console.error в index.html.
// [2.37.3] Метка версии фронта — прилетит в логи Amvera через client-error.
window.__frontVersion = '2.37.3';

if (typeof window !== 'undefined' && typeof window.__clientLog === 'function') {
  window.__clientLog('module-load-start', 'main.jsx top reached');
} else if (typeof window !== 'undefined') {
  window.__clientLog = function () { /* noop */ };
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import ErrorBoundary from './mainComponent/ErrorBoundary.jsx';

try {
  if (localStorage.getItem('ghost-chat-theme') === 'dark') {
    document.body.classList.add('dark');
  }
} catch { /* noop */ }

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

try {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        if (typeof window.__clientLog === 'function') {
          window.__clientLog('sw-registered', reg.scope);
        }
        reg.update().catch(() => { /* noop */ });
      })
      .catch((err) => {
        if (typeof window.__clientLog === 'function') {
          window.__clientLog('sw-register-failed', (err && err.message) || String(err));
        }
      });
  });
}