/*
  [2.28.0] Service Worker для PWA.
  Пока без кеша — нужен только для установки в Chrome/Android.
  В следующей итерации добавим офлайн-кеш.
*/

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/* Пустой fetch — Chrome это устраивает, установка доступна */
self.addEventListener('fetch', () => {
  /* пропускаем — браузер работает как обычно */
});