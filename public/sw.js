// Service worker: recebe avisos push e abre o app ao tocar na notificação.
self.addEventListener('push', (event) => {
  let dados = { title: 'App Financeiro', body: 'Você tem boletos perto do vencimento.', url: '/boletos' };
  try {
    dados = { ...dados, ...event.data.json() };
  } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(dados.title, {
      body: dados.body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      data: { url: dados.url },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/boletos';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ('focus' in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
