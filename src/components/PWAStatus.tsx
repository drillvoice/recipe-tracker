import { useState, useEffect } from 'react';
import { getPWAInstallState, getPWACapabilities } from '@/lib/pwa-utils';
import { PWAFileManager } from '@/lib/pwa-file-manager';

export function PWAStatus() {
  const [installState, setInstallState] = useState(getPWAInstallState());
  const [capabilities, setCapabilities] = useState(getPWACapabilities());
  const [fileFeatures, setFileFeatures] = useState(PWAFileManager.getAvailableFeatures());

  useEffect(() => {
    // Update state periodically
    const updateState = () => {
      setInstallState(getPWAInstallState());
      setCapabilities(getPWACapabilities());
      setFileFeatures(PWAFileManager.getAvailableFeatures());
    };

    updateState();

    // Listen for app installation events
    const handleAppInstalled = () => updateState();
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  return (
    <div className="pwa-status">
      <h3>App Features</h3>

      <div className="pwa-status-grid">
        <div className="pwa-status-item">
          <span className={`status-indicator ${installState.isInstalled ? 'active' : 'inactive'}`} />
          <span>Installed as App</span>
        </div>

        <div className="pwa-status-item">
          <span className={`status-indicator ${capabilities.serviceWorker ? 'active' : 'inactive'}`} />
          <span>Offline Support</span>
        </div>

        <div className="pwa-status-item">
          <span className={`status-indicator ${fileFeatures.nativeFilePicker ? 'active' : 'inactive'}`} />
          <span>Native File Picker</span>
        </div>

        <div className="pwa-status-item">
          <span className={`status-indicator ${capabilities.webShare ? 'active' : 'inactive'}`} />
          <span>Share Integration</span>
        </div>

        <div className="pwa-status-item">
          <span className={`status-indicator ${capabilities.pushNotifications ? 'active' : 'inactive'}`} />
          <span>Push Notifications</span>
        </div>

        <div className="pwa-status-item">
          <span className={`status-indicator ${capabilities.backgroundSync ? 'active' : 'inactive'}`} />
          <span>Background Sync</span>
        </div>
      </div>

      {fileFeatures.nativeFilePicker && (
        <div className="pwa-feature-highlight">
          <p>🎉 <strong>Native file picker available!</strong> You can now save exports directly to Google Drive, OneDrive, or any location.</p>
        </div>
      )}

      {installState.isStandalone && (
        <div className="pwa-feature-highlight">
          <p>✅ <strong>Running as installed app!</strong> You have the full PWA experience.</p>
        </div>
      )}
    </div>
  );
}

export default PWAStatus;