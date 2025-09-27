import { useState } from 'react';
import { ExportManager, type ExportOptions } from '@/lib/export-manager';
import type { MessageState } from './types';

interface DataExportProps {
  onMessage: (message: MessageState | null) => void;
}

export default function DataExport({ onMessage }: DataExportProps) {
  const [exporting, setExporting] = useState(false);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleExport = async () => {
    setExporting(true);
    onMessage(null);

    try {
      const options: ExportOptions = {
        format: 'json',
        includeMeals: true,
        includeSettings: true,
        includeMetadata: true
      };

      const result = await ExportManager.exportData(options);

      if (result.success) {
        onMessage({
          type: 'success',
          text: `Export completed: ${result.filename} (${result.itemCount} meals, ${formatFileSize(result.size)}). ${result.saveLocationDescription || 'File saved successfully.'}`
        });
      } else {
        // Check if user cancelled the export
        const errorMessages = result.errors.join(', ');
        const userCancelled = errorMessages.includes('User cancelled') ||
                             errorMessages.includes('cancelled') ||
                             errorMessages.includes('aborted');

        if (userCancelled) {
          // Don't show an error message for user cancellation - just clear any existing message
          onMessage(null);
        } else {
          onMessage({
            type: 'error',
            text: `Export failed: ${errorMessages}`
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const userCancelled = errorMessage.includes('cancelled') ||
                           errorMessage.includes('aborted') ||
                           errorMessage.includes('User cancelled');

      if (!userCancelled) {
        onMessage({
          type: 'error',
          text: `Export failed: ${errorMessage}`
        });
      } else {
        // Clear any existing message for user cancellation
        onMessage(null);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="export-section">
      <h3>Export All Data (JSON)</h3>
      <p>Download all your dishes, settings, and metadata as a JSON file for backup or migration.</p>

      <div className="export-actions">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="export-button primary"
        >
          {exporting ? 'Exporting...' : 'Export All Data (JSON)'}
        </button>
      </div>

      <div className="export-info">
        <p className="info-text">
          💡 <strong>Tip:</strong> Regular exports help protect your data. The exported file can be re-imported on any device.
        </p>
      </div>
    </div>
  );
}