import { useState, lazy, Suspense } from 'react';
import Navigation from '@/components/Navigation';
import InstallPrompt from '@/components/InstallPrompt';
import PWAStatus from '@/components/PWAStatus';
import CloudBackup from './CloudBackup';
import type { TabType, MessageState } from './types';

const DataExport = lazy(() => import('./DataExport'));
const DataImport = lazy(() => import('./DataImport'));
const DataValidation = lazy(() => import('./DataValidation'));

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
      <main className="container">
        <h1>Data Management</h1>

        {/* Install Prompt */}
        <InstallPrompt />

        {/* Global Messages */}
        {message && (
          <div className={`message-card ${message.type}`}>
            <p>{message.text}</p>
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
        <section className="data-section enhanced-tabs">
          <div className="tab-header">
            <h2>📁 Local Data Management</h2>
            <p className="tab-description">
              Export your meal data for backup, import saved files, and verify data integrity.
            </p>
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
            <div className={`message-card ${importMessage.type}`} style={{ margin: '16px 0' }}>
              <p>{importMessage.text}</p>
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
            <Suspense fallback={<div className="form"><p>Loading...</p></div>}>
              {activeTab === 'export' && <DataExport onMessage={setMessage} />}
              {activeTab === 'import' && <DataImport onMessage={setImportMessage} />}
              {activeTab === 'verification' && <DataValidation />}
            </Suspense>
          </div>
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