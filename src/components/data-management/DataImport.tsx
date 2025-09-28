import { useRef, useState } from 'react';
import { ImportManager, type ImportOptions, type ImportPreview } from '@/lib/import-manager';
import type { MessageState } from './types';

interface DataImportProps {
  onMessage: (message: MessageState | null) => void;
}

export default function DataImport({ onMessage }: DataImportProps) {
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importFileContent, setImportFileContent] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    onMessage(null);
    setImportPreview(null);
    setImportFileContent(null);

    try {
      // Validate file
      const validation = ImportManager.validateImportFile(file);
      if (!validation.valid) {
        onMessage({
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
        onMessage({
          type: 'error',
          text: `Invalid import data: ${preview.errors.join(', ')}`
        });
      }
    } catch (error) {
      onMessage({
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
    onMessage(null);

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

        const successText = successParts.length > 0
          ? `✅ Import successful! ${successParts.join(', ')}`
          : `✅ Import completed successfully!`;

        onMessage({
          type: 'success',
          text: successText
        });

        // Clear the preview and content
        setImportPreview(null);
        setImportFileContent(null);
      } else {
        onMessage({
          type: 'error',
          text: `Import failed: ${result.errors.join(', ')}`
        });
      }
    } catch (error) {
      console.error('Import error:', error);
      onMessage({
        type: 'error',
        text: `Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setImporting(false);
    }
  };

  const clearPreview = () => {
    setImportPreview(null);
    setImportFileContent(null);
    onMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <div
        className="file-drop-zone"
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="file-icon">📁</div>
        <p className="file-drop-title">Click to browse or drag files here</p>
        <p className="file-drop-subtitle">Supports JSON, CSV, and backup files</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv,.backup"
          onChange={handleFileSelect}
          disabled={importing}
          className="file-input-hidden"
        />
      </div>

      {importing && <div className="import-status">Reading file...</div>}

      {importPreview && (
        <div className="import-preview">
          <h4 className="preview-title">Import Preview</h4>
          <div className="preview-stats">
            <div className="stat-item">
              <span className="stat-value">{importPreview.format.toUpperCase()}</span>
              <span className="stat-label">Format</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{importPreview.summary.totalMeals}</span>
              <span className="stat-label">Total Sessions</span>
            </div>
            <div className="stat-item">
              <span className="stat-value">{importPreview.summary.newMeals}</span>
              <span className="stat-label">New Sessions</span>
            </div>
            <div className="stat-item">
              <span className={`stat-value ${importPreview.conflicts.length > 0 ? 'warning' : 'success'}`}>
                {importPreview.conflicts.length}
              </span>
              <span className="stat-label">Conflicts</span>
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
              onClick={clearPreview}
              disabled={importing}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}