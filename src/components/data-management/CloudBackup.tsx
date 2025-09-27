import { useState, useEffect } from 'react';
import { backupMealsToCloud, getCloudBackupStatus, type CloudBackupStatus } from '@/lib/firestore-backup';
import { getAllMeals } from '@/lib/offline-storage';
import type { MessageState } from './types';

interface CloudBackupProps {
  onMessage: (message: MessageState | null) => void;
}

export default function CloudBackup({ onMessage }: CloudBackupProps) {
  const [cloudBackupStatus, setCloudBackupStatus] = useState<CloudBackupStatus | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadCloudBackupStatus();
  }, []);

  const loadCloudBackupStatus = async () => {
    try {
      const status = await getCloudBackupStatus();
      setCloudBackupStatus(status);
    } catch (error) {
      console.error('Failed to load cloud backup status:', error);
    }
  };

  const handleBackupNow = async () => {
    setExporting(true);
    onMessage(null);

    try {
      const result = await backupMealsToCloud();

      if (result.success) {
        onMessage({
          type: 'success',
          text: `Cloud backup successful: ${result.mealsBackedUp} meals backed up to Firestore`
        });
        await loadCloudBackupStatus();
      } else {
        onMessage({
          type: 'error',
          text: `Cloud backup failed: ${result.errors.join(', ')}`
        });
      }
    } catch (error) {
      onMessage({
        type: 'error',
        text: `Cloud backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setExporting(false);
    }
  };

  const formatTimeAgo = (timestamp: number): string => {
    if (timestamp === 0) return 'Never';

    const now = Date.now();
    const diffMs = now - timestamp;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else {
      return 'Less than an hour ago';
    }
  };

  return (
    <div className="backup-section">
      <h3>Cloud Backup</h3>
      <p>Securely backup your data to the cloud for access across devices.</p>

      {cloudBackupStatus && (
        <div className="backup-status">
          <div className="status-grid">
            <div className="status-item">
              <span className="status-label">Status:</span>
              <span className={`status-value ${cloudBackupStatus.isAuthenticated ? 'authenticated' : 'not-authenticated'}`}>
                {cloudBackupStatus.isAuthenticated ? '✅ Connected' : '❌ Not Connected'}
              </span>
            </div>
            {cloudBackupStatus.isAuthenticated && (
              <>
                <div className="status-item">
                  <span className="status-label">Cloud Meals:</span>
                  <span className="status-value">{cloudBackupStatus.cloudMealCount}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Last Backup:</span>
                  <span className="status-value">{formatTimeAgo(cloudBackupStatus.lastCloudBackup)}</span>
                </div>
                <div className="status-item">
                  <span className="status-label">Sync Status:</span>
                  <span className={`status-value ${cloudBackupStatus.syncNeeded ? 'sync-needed' : 'up-to-date'}`}>
                    {cloudBackupStatus.syncNeeded ? '⚠️ Sync Needed' : '✅ Up to Date'}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="backup-actions">
        <button
          onClick={handleBackupNow}
          disabled={exporting}
          className="backup-button primary"
        >
          {exporting ? 'Backing up...' : 'Backup Now'}
        </button>
      </div>
    </div>
  );
}