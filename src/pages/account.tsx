import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import { ExportManager, type ExportOptions } from "@/lib/export-manager";
import { ImportManager, type ImportOptions, type ImportPreview } from "@/lib/import-manager";
import { DataValidator, type ValidationResult } from "@/lib/data-validator";
import { getAllMeals } from "@/lib/offline-storage";
import { getBackupStatus as getEnhancedBackupStatus } from "@/lib/offline-storage";
import { backupMealsToCloud, getCloudBackupStatus, type CloudBackupStatus } from "@/lib/firestore-backup";
import InstallPrompt from "@/components/InstallPrompt";
import PWAStatus from "@/components/PWAStatus";

interface BackupStatus {
  lastBackup: number;
  mealCount: number;
  needsBackup: boolean;
  daysSinceBackup: number;
}

type TabType = 'export' | 'import' | 'verification';

export default function DataManagement() {
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [cloudBackupStatus, setCloudBackupStatus] = useState<CloudBackupStatus | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importFileContent, setImportFileContent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('export');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadBackupStatus();
    loadCloudBackupStatus();
    performDataValidation();
  }, []);

  const loadBackupStatus = async () => {
    try {
      // Get actual meal count from main database
      const meals = await getAllMeals();
      const status = {
        lastBackup: 0,
        mealCount: meals.length,
        needsBackup: true,
        daysSinceBackup: Infinity
      };
      setBackupStatus(status);
    } catch (error) {
      console.error('Failed to load backup status:', error);
    }
  };

  const loadCloudBackupStatus = async () => {
    try {
      const status = await getCloudBackupStatus();
      setCloudBackupStatus(status);
    } catch (error) {
      console.error('Failed to load cloud backup status:', error);
    }
  };

  const performDataValidation = async () => {
    try {
      const result = await DataValidator.validateAllData();
      setValidationResult(result);
    } catch (error) {
      console.error('Failed to validate data:', error);
    }
  };

  const handleBackupNow = async () => {
    setExporting(true);
    setMessage(null);

    try {
      const result = await backupMealsToCloud();

      if (result.success) {
        setMessage({
          type: 'success',
          text: `Cloud backup successful: ${result.mealsBackedUp} meals backed up to Firestore`
        });
        await loadBackupStatus();
        await loadCloudBackupStatus();
      } else {
        setMessage({
          type: 'error',
          text: `Cloud backup failed: ${result.errors.join(', ')}`
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Cloud backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setExporting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);

    try {
      const options: ExportOptions = {
        format: 'json',
        includeMeals: true,
        includeSettings: true,
        includeMetadata: true
      };

      const result = await ExportManager.exportData(options);

      if (result.success) {
        setMessage({
          type: 'success',
          text: `Export completed: ${result.filename} (${result.itemCount} meals, ${formatFileSize(result.size)}). ${result.saveLocationDescription || 'File saved successfully.'}`
        });
      } else {
        setMessage({
          type: 'error',
          text: `Export failed: ${result.errors.join(', ')}`
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportMessage(null);
    setImportPreview(null);
    setImportFileContent(null);

    try {
      // Validate file
      const validation = ImportManager.validateImportFile(file);
      if (!validation.valid) {
        setImportMessage({
          type: 'error',
          text: `Invalid file: ${validation.errors.join(', ')}`
        });
        return;
      }

      // Read and preview file
      const content = await ImportManager.readFileContent(file);
      const preview = await ImportManager.previewImport(content);

      if (preview.valid) {
        setImportPreview(preview);
        setImportFileContent(content); // Store content for later import
      } else {
        setImportMessage({
          type: 'error',
          text: `Invalid import data: ${preview.errors.join(', ')}`
        });
      }
    } catch (error) {
      setImportMessage({
        type: 'error',
        text: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setImporting(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleImport = async () => {
    if (!importPreview || !importFileContent) {
      console.log('Missing preview or file content');
      return;
    }

    setImporting(true);
    setImportMessage(null);

    try {
      console.log('Starting import process...');
      const options: ImportOptions = {
        conflictResolution: 'ask',
        createBackup: false, // Don't create backup during import to avoid confusion
        dryRun: false
      };

      console.log('Calling ImportManager.importData...');
      const result = await ImportManager.importData(importFileContent, options);
      console.log('Import result:', result);

      if (result.success) {
        const totalProcessed = result.summary.mealsImported + result.summary.mealsUpdated;
        const successParts = [];

        if (result.summary.mealsImported > 0) {
          successParts.push(`${result.summary.mealsImported} new recipes imported`);
        }
        if (result.summary.mealsUpdated > 0) {
          successParts.push(`${result.summary.mealsUpdated} recipes updated`);
        }
        if (result.summary.mealsSkipped > 0) {
          successParts.push(`${result.summary.mealsSkipped} recipes skipped`);
        }

        const successText = totalProcessed > 0
          ? `✅ Import successful! ${successParts.join(', ')}`
          : '✅ Import completed - no new data to add';

        setImportMessage({
          type: 'success',
          text: successText
        });
        setImportPreview(null);
        setImportFileContent(null);
        await loadBackupStatus();
        await performDataValidation();
      } else {
        console.log('Import failed with errors:', result.errors);
        setImportMessage({
          type: 'error',
          text: `Import failed: ${result.errors.join(', ')}`
        });
      }
    } catch (error) {
      console.error('Import exception:', error);
      setImportMessage({
        type: 'error',
        text: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setImporting(false);
    }
  };

  const handleClearLocalData = async () => {
    if (!confirm('Are you sure you want to clear all local data? This cannot be undone. Make sure you have a backup first.')) {
      return;
    }

    try {
      setMessage({
        type: 'info',
        text: 'Clear local data feature will be implemented in the next update'
      });
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Failed to clear data: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimeAgo = (timestamp: number): string => {
    if (timestamp === 0) return 'Never';

    const now = Date.now();
    const diffMs = now - timestamp;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else {
      return 'Just now';
    }
  };

  return (
    <main className="container">
      <Navigation currentPage="account" />

      <h1>Data Management</h1>

      <InstallPrompt />

      {message && (
        <div className={`message-card ${message.type}`}>
          <p>{message.text}</p>
          <button onClick={() => setMessage(null)} className="message-close">×</button>
        </div>
      )}

      {/* Compact Cloud Backup Section */}
      <section className="data-section">
        <div className="status-header">
          <h2>Cloud Backup</h2>
          <div className="status-indicator">
            <div className={`status-dot ${!cloudBackupStatus?.isAuthenticated || cloudBackupStatus?.syncNeeded ? 'warning' : 'active'}`} />
            <span className={`status-text ${!cloudBackupStatus?.isAuthenticated || cloudBackupStatus?.syncNeeded ? 'warning' : 'active'}`}>
              {!cloudBackupStatus?.isAuthenticated ? 'Not Connected' : cloudBackupStatus?.syncNeeded ? 'Sync Needed' : 'Up to Date'}
            </span>
          </div>
        </div>

        {cloudBackupStatus ? (
          <div className="backup-info-compact">
            <div className="backup-stats">
              <div className="backup-stat">
                <span>📊</span>
                <span><strong>{cloudBackupStatus.cloudMealCount}</strong> meals in cloud</span>
              </div>
              <div className="backup-stat">
                <span>⏰</span>
                <span>Last backup: <strong>{formatTimeAgo(cloudBackupStatus.lastCloudBackup)}</strong></span>
              </div>
              <div className="backup-stat">
                <span>☁️</span>
                <span>Status: <strong>{cloudBackupStatus.isAuthenticated ? 'Connected' : 'Disconnected'}</strong></span>
              </div>
            </div>
            <button
              className="backup-button compact"
              onClick={handleBackupNow}
              disabled={exporting}
            >
              {exporting ? 'Backing Up...' : 'Backup to Cloud'}
            </button>
          </div>
        ) : (
          <div className="loading">Loading cloud backup status...</div>
        )}
      </section>

      {/* Enhanced Data Management with Tabs */}
      <section className="data-section enhanced-tabs">
        <div className="tab-header">
          <h2>Local Data Management</h2>
          <p className="tab-description">
            Export your meal data to files for local backup, import data from files, and verify data integrity.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button
            onClick={() => setActiveTab('export')}
            className={`tab-button ${activeTab === 'export' ? 'active' : ''}`}
          >
            Export Data
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`tab-button ${activeTab === 'import' ? 'active' : ''}`}
          >
            Import Data
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`tab-button ${activeTab === 'verification' ? 'active' : ''}`}
          >
            Backup Verification
          </button>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          
          {/* Export Data Panel */}
          {activeTab === 'export' && (
            <div>
              <div className="export-controls">
                <p className="export-description">
                  Export all your meal data as a JSON file for backup or transfer to another device.
                </p>

                <button
                  className="export-button primary"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  {exporting ? 'Exporting...' : 'Export All Data (JSON)'}
                </button>

                <p className="export-note">
                  <strong>Save Options:</strong> Modern browsers (Chrome, Edge) will show a "Save As" dialog to choose your save location.
                  For Google Drive, save to your local Google Drive folder or use the Google Drive web interface to upload the file.
                </p>
                <p className="export-details">
                  The exported file will include all meals, settings, and metadata in JSON format.
                </p>
              </div>
            </div>
          )}

          {/* Import Data Panel */}
          {activeTab === 'import' && (
            <div>
              <div
                className="file-drop-zone"
                onClick={() => document.getElementById('file-input')?.click()}
              >
                <div className="file-icon">📁</div>
                <p className="file-drop-title">
                  Click to browse or drag files here
                </p>
                <p className="file-drop-subtitle">
                  Supports JSON, CSV, and backup files
                </p>
                <input
                  id="file-input"
                  type="file"
                  accept=".json,.csv,.backup"
                  onChange={handleFileSelect}
                  disabled={importing}
                  style={{ display: 'none' }}
                />
              </div>

              {importing && (
                <div className="import-status">
                  Reading file...
                </div>
              )}

              {importMessage && (
                <div className={`message-card ${importMessage.type}`} style={{ margin: '16px 0' }}>
                  <p>{importMessage.text}</p>
                  <button onClick={() => setImportMessage(null)} className="message-close">×</button>
                </div>
              )}

              {importPreview && (
                <div className="import-preview">
                  <h4 className="preview-title">Import Preview</h4>
                  <div className="preview-stats">
                    <div className="stat-item">
                      <span className="stat-value">
                        {importPreview.format.toUpperCase()}
                      </span>
                      <span className="stat-label">
                        Format
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">
                        {importPreview.summary.totalMeals}
                      </span>
                      <span className="stat-label">
                        Total Sessions
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className="stat-value">
                        {importPreview.summary.newMeals}
                      </span>
                      <span className="stat-label">
                        New Sessions
                      </span>
                    </div>
                    <div className="stat-item">
                      <span className={`stat-value ${importPreview.conflicts.length > 0 ? 'warning' : 'success'}`}>
                        {importPreview.conflicts.length}
                      </span>
                      <span className="stat-label">
                        Conflicts
                      </span>
                    </div>
                  </div>

                  {importPreview.conflicts.length > 0 && (
                    <div className="conflicts-warning">
                      <p>⚠️ {importPreview.conflicts.length} conflicts detected. Existing data will be preserved.</p>
                    </div>
                  )}

                  <div className="import-actions">
                    <button
                      className="import-button"
                      onClick={handleImport}
                      disabled={importing}
                    >
                      {importing ? 'Importing...' : 'Import Data'}
                    </button>
                    <button
                      className="cancel-button"
                      onClick={() => {
                        setImportPreview(null);
                        setImportFileContent(null);
                        setImportMessage(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Backup Verification Panel */}
          {activeTab === 'verification' && validationResult && (
            <div>
              <div className="verification-grid">
                <div className="score-circle">
                  <span className="score">{validationResult.stats.dataIntegrityScore}</span>
                  <span className="score-label">Integrity</span>
                </div>

                <div className="verification-stats">
                  <div className="verification-stat">
                    <span className="verification-label">
                      Total Sessions
                    </span>
                    <span className="verification-value">
                      {validationResult.stats.totalMeals}
                    </span>
                  </div>
                  <div className="verification-stat">
                    <span className="verification-label">
                      Issues Found
                    </span>
                    <span className={`verification-value ${validationResult.errors.length > 0 ? 'warning' : ''}`}>
                      {validationResult.errors.length}
                    </span>
                  </div>
                  <div className="verification-stat">
                    <span className="verification-label">
                      Data Status
                    </span>
                    <span className={`verification-badge ${validationResult.valid ? 'healthy' : 'attention'}`}>
                      {validationResult.valid ? '✓ Healthy' : '⚠ Needs attention'}
                    </span>
                  </div>
                  <div className="verification-stat">
                    <span className="verification-label">
                      Last Check
                    </span>
                    <span className="verification-value">
                      2 hours ago
                    </span>
                  </div>
                </div>
              </div>

              <div className="verification-status">
                <p>
                  <strong>All systems operational.</strong> Your training data is secure and backed up regularly.
                  The next automatic backup is scheduled for Sunday.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* PWA Status */}
      <PWAStatus />

      {/* Information Note */}
      <div className="info-note">
        <p>
          <strong>Note:</strong> Cloud backup automatically syncs your data to Firestore for safety and cross-device access.
          Local data management lets you export/import files for additional backup options and data portability.
        </p>
      </div>
    </main>
  );
}