self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return self.clients.openWindow('/');
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_DEVICE_NOTIFICATION') {
    const { title, body, tag, data } = event.data.payload;
    self.registration.showNotification(title, {
      body,
      tag: tag || 'wattwise-alert',
      icon: '/wattwise-icon.svg',
      badge: '/wattwise-icon.svg',
      vibrate: [200, 100, 200],
      requireInteraction: false,
      data: data || {}
    });
  }
});
