import { useState, useEffect } from 'react';
import { backupMealsToCloud, getCloudBackupStatus, type CloudBackupStatus } from '@/lib/firestore-backup';
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

  const statusVariant =
    !cloudBackupStatus?.isAuthenticated || cloudBackupStatus?.syncNeeded ? 'warning' : 'active';

  return (
    <>
      <div className="status-header">
        <h2>Cloud Backup</h2>
        <div className="status-indicator">
          <div className={`status-dot ${statusVariant}`} />
          <span className={`status-text ${statusVariant}`}>
            {!cloudBackupStatus?.isAuthenticated
              ? 'Not Connected'
              : cloudBackupStatus?.syncNeeded
              ? 'Sync Needed'
              : 'Up to Date'}
          </span>
        </div>
      </div>

      {cloudBackupStatus ? (
        <div className="backup-info-compact">
          <div className="backup-stats">
            <div className="backup-stat">
              <span>📊</span>
              <span>
                <strong>Cloud Meals:</strong> {cloudBackupStatus.cloudMealCount}
              </span>
            </div>
            <div className="backup-stat">
              <span>⏰</span>
              <span>
                <strong>Last Backup:</strong> {formatTimeAgo(cloudBackupStatus.lastCloudBackup)}
              </span>
            </div>
            <div className="backup-stat">
              <span>☁️</span>
              <span>
                <strong>Status:</strong> {cloudBackupStatus.isAuthenticated ? '✅ Connected' : '❌ Not Connected'}
              </span>
            </div>
          </div>
          <button
            className="backup-button compact"
            onClick={handleBackupNow}
            disabled={exporting}
          >
            {exporting ? 'Backing Up...' : 'Backup Now'}
          </button>
        </div>
      ) : (
        <div className="loading">Loading cloud backup status...</div>
      )}
    </>
  );
}