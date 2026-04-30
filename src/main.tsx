import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { migrateDbName } from './db/migrate-db-name';
import App from './App';
import './index.css';

// Cleanup: unregister any SW that was previously registered at wrong scope for this app
// (other apps' SWs at their own scopes are fine — don't touch them)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const reg of registrations) {
      const scope = new URL(reg.scope).pathname;
      if (scope === '/' || scope === '/way' || scope === '/heroincome') {
        // Root-scope SW or missing trailing slash — leftover from old deploy
        reg.unregister();
      }
    }
  });
}

const SPLASH_STORAGE_KEY = 'hi-splash-seen-v2';

// Splash screen: show on first launch, then keep subsequent starts clean.
let splashStarted = false;
function runSplash(): void {
  const splash = document.getElementById('splash');
  if (!splash || splashStarted) return;

  if (localStorage.getItem(SPLASH_STORAGE_KEY)) {
    splash.remove();
    return;
  }

  splashStarted = true;
  splash.style.display = 'flex';
  localStorage.setItem(SPLASH_STORAGE_KEY, '1');

  const fills = splash.querySelectorAll<HTMLElement>('.s-fill');
  const bang = document.getElementById('s-bang');

  const widths: number[] = [];
  fills.forEach((f) => {
    f.style.cssText = 'display:inline-block;width:auto;opacity:1;position:absolute;visibility:hidden;';
    widths.push(f.getBoundingClientRect().width);
    f.style.cssText = 'display:inline-block;width:0;overflow:hidden;opacity:0;';
  });

  const heroFills = [0, 1, 2];
  const incomeFills = [3, 4, 5, 6, 7];
  const revealDuration = 600;
  const startAt = 800;

  heroFills.forEach((idx, i) => {
    setTimeout(() => {
      fills[idx].style.transition = 'width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease';
      fills[idx].style.width = `${widths[idx]}px`;
      fills[idx].style.opacity = '1';
    }, startAt + (i / 3) * revealDuration);
  });

  incomeFills.forEach((idx, i) => {
    setTimeout(() => {
      fills[idx].style.transition = 'width 0.35s cubic-bezier(0.4,0,0.2,1), opacity 0.25s ease';
      fills[idx].style.width = `${widths[idx]}px`;
      fills[idx].style.opacity = '1';
    }, startAt + (i / 5) * revealDuration);
  });

  setTimeout(() => {
    if (bang) bang.style.opacity = '0';
  }, startAt + revealDuration);

  setTimeout(() => {
    splash.style.opacity = '0';
    setTimeout(() => splash.remove(), 500);
  }, 2000);
}

// Migrate old DB name before React mounts
migrateDbName().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  runSplash();
});
