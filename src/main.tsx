import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Clear any stale Service Workers or caches from previous PWA builds
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      reg.unregister();
    }
  });
}
if ('caches' in window) {
  caches.keys().then((keys) => {
    for (const key of keys) {
      caches.delete(key);
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
