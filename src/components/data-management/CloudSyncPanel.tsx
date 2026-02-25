import { useEffect, useState } from 'react';
import {
  createAccountWithEmailPassword,
  getSyncStatus,
  sendPasswordReset,
  signInWithEmailPassword,
  signOutAndStopSync,
  syncNow,
  type CloudSyncStatus,
  type SyncNowResult
} from '@/lib/cloud-sync';
import type { MessageState } from './types';

interface CloudSyncPanelProps {
  onMessage: (message: MessageState | null) => void;
}

const initialStatus: CloudSyncStatus = {
  isConfigured: false,
  isAuthenticated: false,
  isAnonymous: false,
  pendingCount: 0,
  lastSyncAt: 0,
  lastError: null,
  isSyncing: false,
  realtimeConnected: false
};

export default function CloudSyncPanel({ onMessage }: CloudSyncPanelProps) {
  const [status, setStatus] = useState<CloudSyncStatus>(initialStatus);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  useEffect(() => {
    let active = true;

    const refreshStatus = async () => {
      try {
        const nextStatus = await getSyncStatus();
        if (active) {
          setStatus(nextStatus);
        }
      } catch (error) {
        if (active) {
          onMessage({
            type: 'error',
            text: `Unable to load sync status: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      }
    };

    void refreshStatus();
    const interval = window.setInterval(() => {
      void refreshStatus();
    }, 5000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [onMessage]);

  const handleSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onMessage(null);
    setIsAuthLoading(true);

    try {
      await signInWithEmailPassword(email.trim(), password);
      setPassword('');
      setStatus(await getSyncStatus());
      onMessage({
        type: 'success',
        text: 'Signed in successfully. Cloud sync is active for this account.'
      });
    } catch (error) {
      onMessage({
        type: 'error',
        text: `Sign-in failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleCreateAccount = async () => {
    onMessage(null);
    setIsAuthLoading(true);

    try {
      await createAccountWithEmailPassword(email.trim(), password);
      setPassword('');
      setStatus(await getSyncStatus());
      onMessage({
        type: 'success',
        text: 'Account created and signed in. Cloud sync is active for this account.'
      });
    } catch (error) {
      onMessage({
        type: 'error',
        text: `Create account failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      onMessage({
        type: 'error',
        text: 'Enter your email first, then click Reset Password.'
      });
      return;
    }

    onMessage(null);
    setIsAuthLoading(true);

    try {
      await sendPasswordReset(normalizedEmail);
      onMessage({
        type: 'success',
        text: `Password reset email sent to ${normalizedEmail}.`
      });
    } catch (error) {
      onMessage({
        type: 'error',
        text: `Reset password failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    onMessage(null);
    setIsAuthLoading(true);

    try {
      await signOutAndStopSync();
      setStatus(await getSyncStatus());
      onMessage({
        type: 'info',
        text: 'Signed out. Local data is kept on this device, and account sync is paused.'
      });
    } catch (error) {
      onMessage({
        type: 'error',
        text: `Sign-out failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleSyncNow = async () => {
    onMessage(null);
    setIsManualSyncing(true);

    try {
      const result: SyncNowResult = await syncNow();
      setStatus(await getSyncStatus());

      if (result.errors.length > 0) {
        onMessage({
          type: 'error',
          text: `Sync completed with issues. Pulled: ${result.pulled}, pushed: ${result.pushed}. ${result.errors.join(', ')}`
        });
      } else {
        onMessage({
          type: 'success',
          text: `Sync complete. Pulled: ${result.pulled}, pushed: ${result.pushed}.`
        });
      }
    } catch (error) {
      onMessage({
        type: 'error',
        text: `Manual sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  const formatLastSync = (timestamp: number): string => {
    if (!timestamp) {
      return 'Never';
    }

    return new Date(timestamp).toLocaleString();
  };

  const statusVariant = !status.isConfigured
    ? 'warning'
    : status.lastError
      ? 'warning'
      : status.isAuthenticated && !status.isAnonymous
        ? 'active'
        : 'warning';

  return (
    <>
      <div className="status-header">
        <h2>Cloud Sync</h2>
        <div className="status-indicator">
          <div className={`status-dot ${statusVariant}`} />
          <span className={`status-text ${statusVariant}`}>
            {!status.isConfigured
              ? 'Firebase Unavailable'
              : !status.isAuthenticated
                ? 'Not Connected'
                : status.isAnonymous
                  ? 'Anonymous Session'
                  : status.realtimeConnected
                    ? 'Realtime Active'
                    : 'Connected'}
          </span>
        </div>
      </div>

      <div className="backup-info-compact">
        <div className="backup-stats">
          <div className="backup-stat">
            <span>👤</span>
            <span>
              <strong>Account:</strong>{' '}
              {status.isAuthenticated
                ? status.isAnonymous
                  ? 'Anonymous'
                  : status.email || 'Signed in'
                : 'Not signed in'}
            </span>
          </div>
          <div className="backup-stat">
            <span>📦</span>
            <span>
              <strong>Pending:</strong> {status.pendingCount}
            </span>
          </div>
          <div className="backup-stat">
            <span>⏰</span>
            <span>
              <strong>Last Sync:</strong> {formatLastSync(status.lastSyncAt)}
            </span>
          </div>
        </div>
      </div>

      {status.lastError ? (
        <p className="error-message" style={{ marginTop: '0.75rem' }}>
          Sync error: {status.lastError}
        </p>
      ) : null}

      {!status.isAuthenticated || status.isAnonymous ? (
        <form className="form" onSubmit={handleSignIn} style={{ marginTop: '1rem' }}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </label>
          <button type="submit" className="backup-button compact" disabled={isAuthLoading || !status.isConfigured}>
            {isAuthLoading ? 'Signing In...' : 'Sign In'}
          </button>
          <div className="sync-actions" style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="backup-button compact"
              onClick={handleCreateAccount}
              disabled={isAuthLoading || !status.isConfigured || !email.trim() || !password}
              style={{ background: '#0f766e' }}
            >
              {isAuthLoading ? 'Working...' : 'Create Account'}
            </button>
            <button
              type="button"
              className="backup-button compact"
              onClick={handleResetPassword}
              disabled={isAuthLoading || !status.isConfigured}
              style={{ background: '#6b7280' }}
            >
              {isAuthLoading ? 'Working...' : 'Reset Password'}
            </button>
          </div>
        </form>
      ) : (
        <div className="sync-actions" style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
          <button
            className="backup-button compact"
            onClick={handleSyncNow}
            disabled={isManualSyncing || !status.isConfigured}
          >
            {isManualSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button
            className="backup-button compact"
            onClick={handleSignOut}
            disabled={isAuthLoading}
            style={{ background: '#4b5563' }}
          >
            {isAuthLoading ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
      )}
    </>
  );
}
