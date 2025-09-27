import { useState } from 'react';
import Navigation from '@/components/Navigation';
import InstallPrompt from '@/components/InstallPrompt';
import PWAStatus from '@/components/PWAStatus';
import CloudBackup from './CloudBackup';
import DataExport from './DataExport';
import DataImport from './DataImport';
import DataValidation from './DataValidation';
import NotificationSettings from './NotificationSettings';
import type { TabType, MessageState } from './types';

export default function DataManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('export');
  const [message, setMessage] = useState<MessageState | null>(null);
  const [importMessage, setImportMessage] = useState<MessageState | null>(null);

  const clearMessages = () => {
    setMessage(null);
    setImportMessage(null);
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    clearMessages();
  };

  return (
    <>
      <Navigation currentPage="account" />
      <main className="main-container">
        <h1>Data Management</h1>

        {/* Install Prompt */}
        <InstallPrompt />

        {/* Global Messages */}
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
            <button
              onClick={() => setMessage(null)}
              className="message-close"
              aria-label="Close message"
            >
              ×
            </button>
          </div>
        )}

        {/* Cloud Backup Section */}
        <section className="data-section">
          <CloudBackup onMessage={setMessage} />
        </section>

        {/* Local Data Management */}
        <section className="data-section">
          <div className="status-header">
            <h2>📁 Local Data Management</h2>
            <div className="status-indicator">
              <div className="status-dot active" />
              <span className="status-text active">Ready</span>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="tab-navigation">
            <button
              className={`tab-button ${activeTab === 'export' ? 'active' : ''}`}
              onClick={() => handleTabChange('export')}
            >
              Export Data
            </button>
            <button
              className={`tab-button ${activeTab === 'import' ? 'active' : ''}`}
              onClick={() => handleTabChange('import')}
            >
              Import Data
            </button>
            <button
              className={`tab-button ${activeTab === 'verification' ? 'active' : ''}`}
              onClick={() => handleTabChange('verification')}
            >
              Data Verification
            </button>
          </div>

          {/* Import-specific messages */}
          {activeTab === 'import' && importMessage && (
            <div className={`message ${importMessage.type}`}>
              {importMessage.text}
              <button
                onClick={() => setImportMessage(null)}
                className="message-close"
                aria-label="Close message"
              >
                ×
              </button>
            </div>
          )}

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'export' && <DataExport onMessage={setMessage} />}
            {activeTab === 'import' && <DataImport onMessage={setImportMessage} />}
            {activeTab === 'verification' && <DataValidation />}
          </div>
        </section>

        {/* Notification Settings */}
        <section className="data-section">
          <NotificationSettings onMessage={setMessage} />
        </section>

        {/* PWA Status */}
        <PWAStatus />

        {/* Information Note */}
        <div className="info-note">
          <p>
            💡 <strong>Data Storage:</strong> All your data is stored locally on your device using IndexedDB,
            ensuring privacy and offline access. Cloud backup provides additional security and cross-device sync.
          </p>
        </div>
      </main>
    </>
  );
}