/**
 * Main JavaScript for Mood Tracker PWA.
 */

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('service-worker.js')
      .then(reg => console.log('Service Worker registered', reg))
      .catch(err => console.error('Service Worker registration failed', err));
  });
}

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

function getAllMoods() {
  return openDB().then(db => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('moods', 'readonly');
      const store = tx.objectStore('moods');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = event => reject(event.target.error);
    });
  });
}

// Request notification permission
document.getElementById('request-notification').addEventListener('click', () => {
  Notification.requestPermission().then(permission => {
    if (permission === 'granted') {
      alert('Notification permission granted. You will receive mood check notifications.');
      navigator.serviceWorker.ready.then(reg => {
        if (reg.active) {
          reg.active.postMessage({ type: 'schedule-notifications' });
        }
      });
    } else {
      alert('Notification permission denied.');
    }
  });
});

// Setup Chart.js line chart
const ctx = document.getElementById('chart').getContext('2d');
const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels: [],
    datasets: [
      {
        label: 'Mood',
        data: [],
        fill: false,
        borderColor: '#3f51b5'
      }
    ]
  },
  options: {
    scales: {
      x: {
        type: 'time',
        time: { unit: 'day' }
      },
      y: {
        min: 1,
        max: 5,
        ticks: { stepSize: 1 }
      }
    }
  }
});

// Update chart with data from IndexedDB
function updateChart() {
  getAllMoods().then(records => {
    records.sort((a, b) => a.timestamp - b.timestamp);
    chart.data.labels = records.map(r => new Date(r.timestamp));
    chart.data.datasets[0].data = records.map(r => r.mood);
    chart.update();
  });
}

// Listen for new mood events from service worker
navigator.serviceWorker.addEventListener('message', event => {
  if (event.data && event.data.type === 'new-mood') {
    updateChart();
  }
});

// Initial chart render
updateChart();