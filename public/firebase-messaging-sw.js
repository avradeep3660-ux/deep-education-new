/* Firebase Cloud Messaging background worker. Keep this config in sync with src/firebase.js. */
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDCDa3c0X8E6iXO2acHZA7eWR5LAqHEwEM',
  authDomain: 'deep-education-5972f.firebaseapp.com',
  projectId: 'deep-education-5972f',
  storageBucket: 'deep-education-5972f.firebasestorage.app',
  messagingSenderId: '532958567123',
  appId: '1:532958567123:web:0e5b43c4905ed764fa9226'
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || 'Deep Education';
  const options = {
    body: payload.notification?.body || payload.data?.body || 'You have a new update.',
    icon: '/deep_education_logo_de_2.png.png',
    badge: '/favicon.svg',
    data: { url: payload.data?.url || '/' },
    tag: payload.data?.tag || 'deep-education-update',
    renotify: false
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/';
  event.waitUntil((async () => {
    const clientsList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if ('focus' in client) { await client.focus(); if ('navigate' in client) await client.navigate(target); return; }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});
