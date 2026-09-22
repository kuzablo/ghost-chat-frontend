import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// [2.35.9] Тема уже стоит из inline-скрипта в index.html.
try {
  if (localStorage.getItem('ghost-chat-theme') === 'dark') {
    document.body.classList.add('dark');
  }
} catch { /* noop */ }

const rootEl = document.getElementById('root');

// [2.35.9] Ждём: шрифты + все stylesheet + 1 кадр после монтирования React.
// К этому моменту НЕ должно быть ни разъезда, ни «прыжка» текста.
function waitForStylesheets() {
  const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
  return Promise.allSettled(
    links.map((link) =>
      new Promise((resolve) => {
        if (link.sheet) return resolve();
        link.addEventListener('load', () => resolve(), { once: true });
        link.addEventListener('error', () => resolve(), { once: true });
      })
    )
  );
}

function waitForFonts() {
  if (document.fonts && document.fonts.ready) {
    return document.fonts.ready.catch(() => {});
  }
  return Promise.resolve();
}

function showApp() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.body.classList.add('app-ready');
      rootEl.classList.add('ready');
    });
  });
}

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Минимальная задержка показа — чтобы скелетон не мигал при быстрой загрузке.
const MIN_SPLASH_MS = 250;

Promise.all([
  waitForFonts(),
  waitForStylesheets(),
  new Promise((r) => setTimeout(r, MIN_SPLASH_MS)),
]).then(showApp);

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