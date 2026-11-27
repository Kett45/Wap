import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredPromptGlobal: BeforeInstallPromptEvent | null = null;

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPromptGlobal = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new Event('kam-pwa-prompt-ready'));
  });
}

export function usePWAInstall() {
  const [isInstallable, setIsInstallable] = useState<boolean>(() => Boolean(deferredPromptGlobal));
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    );
  });

  const isIosSafari =
    typeof window !== 'undefined' &&
    /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
    !isInstalled;

  useEffect(() => {
    const syncState = () => {
      setIsInstallable(Boolean(deferredPromptGlobal));
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
      }
    };

    const handleAppInstalled = () => {
      deferredPromptGlobal = null;
      setIsInstallable(false);
      setIsInstalled(true);
    };

    window.addEventListener('kam-pwa-prompt-ready', syncState);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('kam-pwa-prompt-ready', syncState);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async (): Promise<boolean> => {
    if (!deferredPromptGlobal) return false;
    await deferredPromptGlobal.prompt();
    const { outcome } = await deferredPromptGlobal.userChoice;
    if (outcome === 'accepted') {
      deferredPromptGlobal = null;
      setIsInstallable(false);
    }
    return outcome === 'accepted';
  };

  return {
    isInstallable,
    isInstalled,
    isIosSafari,
    isIOS: isIosSafari,
    promptInstall,
    triggerInstall: promptInstall,
  };
}
