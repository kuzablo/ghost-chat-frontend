/*
  [2.32.18] push → postMessage всем живым окнам PWA, чтобы поставили бейдж
            (iOS не даёт setAppBadge из SW — только из окна)
  [2.19.0] Web Push: слушаем push, показываем уведомление, обновляем бейдж.
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

/* ===== [2.19.0] PUSH ===== */

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'banjoboy\'s crew', body: 'Новое сообщение' };
  }

  const title = data.title || "banjoboy's crew";
  const body = data.body || 'Новое сообщение';
  const url = data.url || '/';
  const tag = data.tag || 'crew-msg';

  event.waitUntil((async () => {
    // 1. Показываем уведомление
    await self.registration.showNotification(title, {
      body,
      tag,
      icon: '/icon-512.png',
      badge: '/icon-512.png',
      data: { url },
      renotify: true,
    });

    // 2. [2.32.18] Сообщаем всем живым окнам PWA — пусть поставят бейдж.
    //    iOS не даёт setAppBadge из service worker. Если PWA в фоне (не убита) —
    //    окно само увеличит счётчик и бейдж встанет. Если убита — не встанет.
    try {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      clientList.forEach(c => c.postMessage({ type: 'push-received' }));
    } catch { /* noop */ }
  })());
});

/* ===== [2.19.0] КЛИК ПО УВЕДОМЛЕНИЮ ===== */

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil((async () => {
    const clientList = await self.clients.matchAll({
      type: 'window',
      includeUncontrolled: true,
    });

    for (const client of clientList) {
      if ('focus' in client) {
        try {
          await client.focus();
          if ('navigate' in client) {
            try { await client.navigate(url); } catch { /* noop */ }
          }
          return;
        } catch { /* noop */ }
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(url);
    }
  })());
});