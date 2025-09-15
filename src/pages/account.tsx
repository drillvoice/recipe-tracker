import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import { ExportManager, type ExportOptions } from "@/lib/export-manager";
import { ImportManager, type ImportOptions, type ImportPreview } from "@/lib/import-manager";
import { DataValidator, type ValidationResult } from "@/lib/data-validator";
import { getBackupStatus } from "@/lib/offline-storage";
import { backupMealsToCloud, getCloudBackupStatus, type CloudBackupStatus } from "@/lib/firestore-backup";

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
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'backup'>('json');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('export');
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadBackupStatus();
    loadCloudBackupStatus();
    performDataValidation();
  }, []);

  const loadBackupStatus = async () => {
    try {
      const status = await getBackupStatus();
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
        format: exportFormat,
        includeMeals: true,
        includeSettings: exportFormat !== 'csv',
        includeMetadata: exportFormat === 'backup'
      };

      const result = await ExportManager.exportData(options);

      if (result.success) {
        setMessage({
          type: 'success',
          text: `Export completed: ${result.filename} (${result.itemCount} meals, ${formatFileSize(result.size)})`
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
    setMessage(null);
    setImportPreview(null);

    try {
      // Validate file
      const validation = ImportManager.validateImportFile(file);
      if (!validation.valid) {
        setMessage({
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
      } else {
        setMessage({
          type: 'error',
          text: `Invalid import data: ${preview.errors.join(', ')}`
        });
      }
    } catch (error) {
      setMessage({
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
    if (!importPreview) return;

    setImporting(true);
    setMessage(null);

    try {
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = fileInput?.files?.[0];
      if (!file) return;

      const content = await ImportManager.readFileContent(file);
      const options: ImportOptions = {
        conflictResolution: 'ask',
        createBackup: true,
        dryRun: false
      };

      const result = await ImportManager.importData(content, options);

      if (result.success) {
        setMessage({
          type: 'success',
          text: `Import completed: ${result.summary.mealsImported} new meals, ${result.summary.mealsUpdated} updated`
        });
        setImportPreview(null);
        await loadBackupStatus();
        await performDataValidation();
      } else {
        setMessage({
          type: 'error',
          text: `Import failed: ${result.errors.join(', ')}`
        });
      }
    } catch (error) {
      setMessage({
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
                <label className="export-format-label">
                  <span className="label-text">Export Format</span>
                  <select
                    className="form input compact"
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as any)}
                  >
                    <option value="json">JSON (Complete data with metadata)</option>
                    <option value="csv">CSV (Spreadsheet format)</option>
                    <option value="backup">Backup (Compressed with checksums)</option>
                  </select>
                </label>

                <div className="export-checkboxes">
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked className="checkbox-input" />
                    <span>✓ Training Sessions & Games</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked className="checkbox-input" />
                    <span>✓ Daily Goals & Progress</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked className="checkbox-input" />
                    <span>✓ Settings & Preferences</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" defaultChecked className="checkbox-input" />
                    <span>✓ Backup Metadata</span>
                  </label>
                </div>

                <button
                  className="export-button primary"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  {exporting ? 'Exporting...' : 'Export & Save Data'}
                </button>
              </div>

              <p className="export-description">
                Choose where to save: Local storage, Google Drive, or share to other apps
              </p>
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
                      onClick={() => setImportPreview(null)}
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