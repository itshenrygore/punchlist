import { useState, useEffect, useCallback } from 'react';

let deferredPrompt = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    window.dispatchEvent(new Event('pwa-installable'));
  });
}

export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('pl_pwa_dismissed') === '1'; } catch { return false; }
  });

  useEffect(() => {
    const handler = () => setCanInstall(true);
    window.addEventListener('pwa-installable', handler);
    return () => window.removeEventListener('pwa-installable', handler);
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setCanInstall(false);
    return outcome === 'accepted';
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    try { localStorage.setItem('pl_pwa_dismissed', '1'); } catch {}
  }, []);

  const isStandalone = typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone);

  return {
    canInstall: canInstall && !dismissed && !isStandalone,
    install,
    dismiss,
    isStandalone,
  };
}
