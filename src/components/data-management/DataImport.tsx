import { useState } from 'react';
import { ImportManager, type ImportOptions, type ImportPreview } from '@/lib/import-manager';
import type { MessageState } from './types';

interface DataImportProps {
  onMessage: (message: MessageState | null) => void;
}

export default function DataImport({ onMessage }: DataImportProps) {
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importFileContent, setImportFileContent] = useState<string | null>(null);

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
  };

  return (
    <div className="import-section">
      <h3>Import Data</h3>
      <p>Upload a previously exported JSON file to restore your data.</p>

      <div className="import-actions">
        <div className="file-input-wrapper">
          <input
            type="file"
            accept=".json,.backup"
            onChange={handleFileSelect}
            disabled={importing}
            className="file-input"
            id="import-file-input"
          />
          <label htmlFor="import-file-input" className="file-input-label">
            {importing ? 'Processing...' : 'Choose File'}
          </label>
        </div>
      </div>

      {importPreview && (
        <div className="import-preview">
          <h4>Import Preview</h4>
          <div className="preview-summary">
            <div className="preview-item">
              <span className="preview-label">Format:</span>
              <span className="preview-value">{importPreview.format}</span>
            </div>
            <div className="preview-item">
              <span className="preview-label">Total Meals:</span>
              <span className="preview-value">{importPreview.summary.totalMeals}</span>
            </div>
            <div className="preview-item">
              <span className="preview-label">New Meals:</span>
              <span className="preview-value">{importPreview.summary.newMeals}</span>
            </div>
            <div className="preview-item">
              <span className="preview-label">Existing Meals:</span>
              <span className="preview-value">{importPreview.summary.existingMeals}</span>
            </div>
          </div>

          <div className="preview-actions">
            <button
              onClick={handleImport}
              disabled={importing}
              className="import-button primary"
            >
              {importing ? 'Importing...' : 'Confirm Import'}
            </button>
            <button
              onClick={clearPreview}
              disabled={importing}
              className="cancel-button secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="import-info">
        <p className="info-text">
          💡 <strong>Supported formats:</strong> JSON exports from this app or compatible backup files.
        </p>
      </div>
    </div>
  );
}