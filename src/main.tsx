import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Clean up stale service workers and caches from previous deployments
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      // Unregister any SW whose scope doesn't match the current base path
      if (!reg.scope.includes('/way/')) {
        reg.unregister();
      }
    }
  });
  // Purge old workbox caches
  caches.keys().then((names) => {
    for (const name of names) {
      if (name.startsWith('workbox-') || name.startsWith('precache-')) {
        caches.delete(name);
      }
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
