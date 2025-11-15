import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, X } from 'lucide-react';

// Local type for the install prompt event
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const INSTALL_KEY = 'pwa-installed';
const DISMISS_KEY = 'pwa-prompt-last-dismissed';
const RE_SHOW_MS = 12 * 60 * 60 * 1000; // 12 hours

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const isInstalled = localStorage.getItem(INSTALL_KEY) === 'true';
    const lastDismissed = Number(localStorage.getItem(DISMISS_KEY) || 0);

    // If already installed or recently dismissed, do not show immediately
    if (isInstalled || (Date.now() - lastDismissed < RE_SHOW_MS)) {
      // Still listen for events to keep state in sync
    }

    const beforeInstallHandler = (e: Event) => {
      e.preventDefault();
      const bip = e as BeforeInstallPromptEvent;
      setDeferredPrompt(bip);

      const canShow = !isInstalled && (Date.now() - lastDismissed >= RE_SHOW_MS);
      if (canShow) setShowPrompt(true);
    };

    const appInstalledHandler = () => {
      localStorage.setItem(INSTALL_KEY, 'true');
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', beforeInstallHandler);
    window.addEventListener('appinstalled', appInstalledHandler);

    // If app already running standalone (e.g., iOS A2HS)
    if (window.matchMedia('(display-mode: standalone)').matches) {
      localStorage.setItem(INSTALL_KEY, 'true');
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstallHandler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem(INSTALL_KEY, 'true');
    } else {
      // Re-show after cooldown
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 z-50 animate-slide-in">
      <Card className="shadow-2xl border-2 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Download className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h3 className="font-semibold text-sm mb-1">Install ForexNepal App</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Install this app on your device. It's only a few KB and works offline!
              </p>
              <div className="flex gap-2">
                <Button onClick={handleInstall} size="sm" className="flex-1">
                  Install
                </Button>
                <Button onClick={handleDismiss} size="sm" variant="outline" aria-label="Dismiss install prompt">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PWAInstallPrompt;
