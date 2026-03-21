import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Cleanup: unregister any SW that was previously registered at wrong scope for this app
// (other apps' SWs at their own scopes are fine — don't touch them)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      const scope = new URL(reg.scope).pathname;
      if (scope === '/' || scope === '/way') {
        // Root-scope SW or missing trailing slash — leftover from old deploy
        reg.unregister();
      }
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
