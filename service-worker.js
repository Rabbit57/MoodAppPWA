'use strict';

const CACHE_NAME = 'mood-pwa-cache-v1';
const ASSETS = [
  '.',
  'index.html',
  'manifest.json',
  'main.js',
  'service-worker.js',
  'https://via.placeholder.com/192.png?text=Mood',
  'https://via.placeholder.com/512.png?text=Mood'
];

// IndexedDB helper functions
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('mood-db', 1);
    request.onupgradeneeded = event => {
      const db = event.target.result;
      db.createObjectStore('moods', { keyPath: 'id', autoIncrement: true });
    };
    request.onsuccess = event => resolve(event.target.result);
    request.onerror = event => reject(event.target.error);
  });
}

function addMood(record) {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('moods', 'readwrite');
      const store = tx.objectStore('moods');
      const req = store.add(record);
      req.onsuccess = () => resolve();
      req.onerror = event => reject(event.target.error);
    });
  });
}

// Schedule notifications three times a day using TimestampTrigger
async function scheduleNotifications() {
  if (!('showTrigger' in Notification.prototype)) {
    console.log('Notification Triggers not supported.');
    return;
  }
  const times = [9, 15, 21];
  const now = Date.now();
  const promises = times.map(hour => {
    const scheduled = new Date();
    scheduled.setHours(hour, 0, 0, 0);
    if (scheduled.getTime() <= now) {
      scheduled.setDate(scheduled.getDate() + 1);
    }
    return self.registration.showNotification('Mood Check', {
      tag: `mood-${hour}`,
      body: 'How are you feeling? (1 very sad - 5 very happy)',
      showTrigger: new TimestampTrigger({ timestamp: scheduled.getTime() }),
      actions: [
        { action: 'mood-1', title: '1' },
        { action: 'mood-2', title: '2' },
        { action: 'mood-3', title: '3' },
        { action: 'mood-4', title: '4' },
        { action: 'mood-5', title: '5' }
      ],
      data: { scheduledTime: scheduled.getTime() }
    });
  });
  await Promise.all(promises);
}

// Cache assets on install
self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate service worker and schedule notifications
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
      ),
      self.clients.claim(),
      scheduleNotifications()
    ])
  );
});

// Serve cached assets when offline
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request).then(resp => resp || fetch(event.request)));
});

// Handle notification click to record mood and reschedule
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const action = event.action;
  if (action && action.startsWith('mood-')) {
    const mood = parseInt(action.split('-')[1], 10);
    event.waitUntil(
      addMood({ timestamp: Date.now(), mood }).then(() => {
        scheduleNotifications();
        return self.clients.matchAll().then(clients => {
          clients.forEach(client =>
            client.postMessage({ type: 'new-mood', mood })
          );
        });
      })
    );
  }
});

// Reschedule notifications if notification is dismissed
self.addEventListener('notificationclose', event => {
  event.waitUntil(scheduleNotifications());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'schedule-notifications') {
    scheduleNotifications();
  }
});