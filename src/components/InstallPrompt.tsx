import { useState, useEffect } from 'react';
import { BeforeInstallPromptEvent, showInstallPrompt, getPWAInstallState } from '@/lib/pwa-utils';

interface InstallPromptProps {
  className?: string;
}

export function InstallPrompt({ className = '' }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [installState, setInstallState] = useState(getPWAInstallState());

  useEffect(() => {
    // Update install state
    setInstallState(getPWAInstallState());

    // Listen for the beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      console.log('PWA: Install prompt available');

      const installEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(installEvent);
      setShowPrompt(true);
    };

    // Listen for successful installation
    const handleAppInstalled = () => {
      console.log('PWA: App installed successfully');
      setDeferredPrompt(null);
      setShowPrompt(false);
      setInstallState(getPWAInstallState());
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.log('No install prompt available');
      return;
    }

    setIsInstalling(true);

    try {
      const installed = await showInstallPrompt(deferredPrompt);

      if (installed) {
        console.log('PWA: User accepted installation');
        setDeferredPrompt(null);
        setShowPrompt(false);
      } else {
        console.log('PWA: User dismissed installation');
      }
    } catch (error) {
      console.error('PWA: Installation failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Keep the deferred prompt for later use but hide the UI
  };

  // Don't show if already installed or no prompt available
  if (installState.isInstalled || !showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className={`install-prompt ${className}`}>
      <div className="install-prompt-content">
        <div className="install-prompt-icon">📱</div>
        <div className="install-prompt-text">
          <h3>Install Recipe Tracker</h3>
          <p>Get the full app experience with offline access and native file saves!</p>
        </div>
        <div className="install-prompt-actions">
          <button
            className="install-prompt-button primary"
            onClick={handleInstallClick}
            disabled={isInstalling}
          >
            {isInstalling ? 'Installing...' : 'Install App'}
          </button>
          <button
            className="install-prompt-button secondary"
            onClick={handleDismiss}
            disabled={isInstalling}
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}

export default InstallPrompt;