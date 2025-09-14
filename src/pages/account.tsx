import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import { ExportManager, type ExportOptions, type ExportResult } from "@/lib/export-manager";
import { ImportManager, type ImportOptions, type ImportResult, type ImportPreview } from "@/lib/import-manager";
import { DataValidator, type ValidationResult, type IntegrityCheckResult } from "@/lib/data-validator";
import { getBackupStatus, isBackupNeeded } from "@/lib/offline-storage";

interface BackupStatus {
  lastBackup: number;
  mealCount: number;
  needsBackup: boolean;
  daysSinceBackup: number;
}

export default function DataManagement() {
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'backup'>('json');
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    loadBackupStatus();
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
      const options: ExportOptions = {
        format: 'backup',
        includeMeals: true,
        includeSettings: true,
        includeMetadata: true,
        addChecksum: true
      };

      const result = await ExportManager.exportData(options);

      if (result.success) {
        setMessage({
          type: 'success',
          text: `Backup created successfully: ${result.filename} (${formatFileSize(result.size)})`
        });
        await loadBackupStatus();
      } else {
        setMessage({
          type: 'error',
          text: `Backup failed: ${result.errors.join(', ')}`
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
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
        conflictResolution: 'ask', // Could be made configurable
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
      // This would implement clearing all IndexedDB data
      // For now, we'll just show a message
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

      {/* Basic Data Management */}
      <section className="data-section">
        <h2>Cloud Backup</h2>

        <div className="backup-status-card">
          {backupStatus ? (
            <>
              <div className={`backup-indicator ${backupStatus.needsBackup ? 'warning' : 'active'}`}>
                <span className="backup-icon">
                  {backupStatus.needsBackup ? '⚠️' : '☁️'}
                </span>
                <div className="backup-info">
                  <h3>{backupStatus.needsBackup ? 'Backup Recommended' : 'Cloud Backup Active'}</h3>
                  <p>
                    {backupStatus.mealCount} meals — last backed up {formatTimeAgo(backupStatus.lastBackup)}
                  </p>
                  <p className="backup-description">
                    Your training sessions are automatically backed up weekly to secure cloud storage.
                  </p>
                </div>
              </div>

              <button
                className="backup-button"
                onClick={handleBackupNow}
                disabled={exporting}
              >
                {exporting ? 'Creating Backup...' : 'Backup Now'}
              </button>
            </>
          ) : (
            <div className="loading">Loading backup status...</div>
          )}
        </div>

        <div className="backup-description">
          <p>
            Your data is automatically backed up to Firebase Cloud weekly when you're online.
            Manual backups can be triggered anytime from the backup status above.
          </p>
        </div>
      </section>

      {/* Advanced Data Management */}
      <section className="data-section">
        <div className="section-header" onClick={() => setShowAdvanced(!showAdvanced)}>
          <h2>Enhanced Data Management</h2>
          <span className={`expand-icon ${showAdvanced ? 'expanded' : ''}`}>▼</span>
        </div>

        {showAdvanced && (
          <div className="advanced-features">
            <div className="feature-description">
              <p>Enhanced export/import with multiple formats, validation, and backup verification.</p>

              <div className="feature-list">
                <div className="feature-item">✓ Multiple export formats (JSON, CSV, Backup)</div>
                <div className="feature-item">✓ Import validation and conflict resolution</div>
                <div className="feature-item">✓ Backup verification and restore points</div>
                <div className="feature-item">✓ Data integrity checks</div>
              </div>
            </div>

            {/* Export Data */}
            <div className="management-section">
              <h3>Export Data</h3>
              <div className="export-controls">
                <label>
                  Export Format:
                  <select
                    value={exportFormat}
                    onChange={(e) => setExportFormat(e.target.value as any)}
                  >
                    <option value="json">JSON (Complete data with metadata)</option>
                    <option value="csv">CSV (Spreadsheet format)</option>
                    <option value="backup">Backup (Compressed with checksums)</option>
                  </select>
                </label>

                <button
                  className="export-button"
                  onClick={handleExport}
                  disabled={exporting}
                >
                  {exporting ? 'Exporting...' : 'Export & Save Data'}
                </button>
              </div>

              <p className="format-description">
                {exportFormat === 'json' && 'Export all your meal data with settings and metadata in JSON format.'}
                {exportFormat === 'csv' && 'Export meals in CSV format for use in spreadsheet applications.'}
                {exportFormat === 'backup' && 'Create a complete backup with compression and integrity verification.'}
              </p>
            </div>

            {/* Import Data */}
            <div className="management-section">
              <h3>Import Data</h3>
              <div className="import-controls">
                <label className="file-input-label">
                  Choose file to import:
                  <input
                    type="file"
                    accept=".json,.csv,.backup"
                    onChange={handleFileSelect}
                    disabled={importing}
                  />
                </label>

                {importing && (
                  <div className="importing-status">
                    <span>Reading file...</span>
                  </div>
                )}
              </div>

              {importPreview && (
                <div className="import-preview">
                  <h4>Import Preview</h4>
                  <div className="preview-stats">
                    <div className="stat">
                      <label>Format:</label>
                      <span>{importPreview.format.toUpperCase()}</span>
                    </div>
                    <div className="stat">
                      <label>Total meals:</label>
                      <span>{importPreview.summary.totalMeals}</span>
                    </div>
                    <div className="stat">
                      <label>New meals:</label>
                      <span>{importPreview.summary.newMeals}</span>
                    </div>
                    <div className="stat">
                      <label>Conflicts:</label>
                      <span className={importPreview.conflicts.length > 0 ? 'warning' : 'success'}>
                        {importPreview.conflicts.length}
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

            {/* Data Integrity */}
            {validationResult && (
              <div className="management-section">
                <h3>Data Integrity</h3>
                <div className="integrity-score">
                  <div className="score-circle">
                    <span className="score">{validationResult.stats.dataIntegrityScore}</span>
                    <span className="score-label">Integrity Score</span>
                  </div>
                  <div className="integrity-details">
                    <div className="detail">
                      <label>Total meals:</label>
                      <span>{validationResult.stats.totalMeals}</span>
                    </div>
                    <div className="detail">
                      <label>Issues found:</label>
                      <span className={validationResult.errors.length > 0 ? 'warning' : 'success'}>
                        {validationResult.errors.length}
                      </span>
                    </div>
                    <div className="detail">
                      <label>Status:</label>
                      <span className={validationResult.valid ? 'success' : 'warning'}>
                        {validationResult.valid ? 'Healthy' : 'Needs attention'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Clear Local Data */}
            <div className="management-section danger-section">
              <h3>Clear local data</h3>
              <p>Remove all locally stored meal data from this device. Cloud backups will remain unaffected and can be restored later.</p>

              <button
                className="danger-button"
                onClick={handleClearLocalData}
              >
                Clear local data
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Information Note */}
      <div className="info-note">
        <p>
          <strong>Note:</strong> The enhanced data management system above provides comprehensive backup and restore capabilities.
          Your data is now safer with automatic weekly backups and advanced import/export options.
        </p>
      </div>
    </main>
  );
}