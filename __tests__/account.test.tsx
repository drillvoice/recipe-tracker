import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import Account from '@/pages/account';

// Mock the async functions that cause state updates
jest.mock('@/lib/offline-storage', () => ({
  getBackupStatus: jest.fn().mockResolvedValue({
    lastBackup: 0,
    mealCount: 5,
    needsBackup: true,
    daysSinceBackup: Infinity
  }),
  isBackupNeeded: jest.fn().mockReturnValue(true),
  getAllMeals: jest.fn().mockResolvedValue([]),
  getCacheMetadata: jest.fn().mockResolvedValue(null),
  updateCacheMetadata: jest.fn().mockResolvedValue(undefined),
  saveMeal: jest.fn().mockResolvedValue(undefined)
}));


jest.mock('@/lib/data-validator', () => ({
  DataValidator: {
    validateAllData: jest.fn().mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      totalMeals: 5,
      validMeals: 5
    })
  }
}));

const mockExportData = jest.fn().mockResolvedValue({
  success: true,
  data: 'mock-export-data',
  filename: 'backup-2024-01-01.json'
});

jest.mock('@/lib/export-manager', () => ({
  ExportManager: {
    exportData: mockExportData
  }
}));

jest.mock('@/lib/import-manager', () => ({
  ImportManager: {
    previewImport: jest.fn().mockResolvedValue({
      totalMeals: 3,
      validMeals: 3,
      conflicts: [],
      duplicates: []
    }),
    processImport: jest.fn().mockResolvedValue({
      success: true,
      processed: 3,
      imported: 3,
      conflicts: []
    })
  }
}));

const mockGetSyncStatus = jest.fn().mockResolvedValue({
  isConfigured: true,
  isAuthenticated: false,
  isAnonymous: false,
  pendingCount: 0,
  lastSyncAt: 0,
  lastError: null,
  isSyncing: false,
  realtimeConnected: false
});

const mockSignInWithEmailPassword = jest.fn().mockResolvedValue(undefined);
const mockSignOutAndStopSync = jest.fn().mockResolvedValue(undefined);
const mockSyncNow = jest.fn().mockResolvedValue({
  pushed: 2,
  pulled: 3,
  errors: []
});

jest.mock('@/lib/cloud-sync', () => ({
  getSyncStatus: () => mockGetSyncStatus(),
  signInWithEmailPassword: (...args: unknown[]) => mockSignInWithEmailPassword(...args),
  signOutAndStopSync: () => mockSignOutAndStopSync(),
  syncNow: () => mockSyncNow()
}));

describe('Data Management Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders data management interface', async () => {
    await act(async () => {
      render(<Account />);
    });

    // Wait for async effects to complete
    await waitFor(() => {
      expect(screen.getByText('Data Management')).toBeInTheDocument();
    });

    expect(screen.getByText('Cloud Sync')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  test('renders sign-in form for cloud sync', async () => {
    await act(async () => {
      render(<Account />);
    });

    await waitFor(() => {
      expect(screen.getByText('Cloud Sync')).toBeInTheDocument();
    });

    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  test('submits email/password sign-in', async () => {
    await act(async () => {
      render(<Account />);
    });

    await waitFor(() => {
      expect(screen.getByText('Sign In')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('you@example.com'), {
      target: { value: 'test@example.com' }
    });
    fireEvent.change(screen.getByPlaceholderText('••••••••'), {
      target: { value: 'password123' }
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Sign In'));
    });

    expect(mockSignInWithEmailPassword).toHaveBeenCalledWith('test@example.com', 'password123');
  });

  test('shows sync and sign-out actions when signed in', async () => {
    mockGetSyncStatus.mockResolvedValueOnce({
      isConfigured: true,
      isAuthenticated: true,
      isAnonymous: false,
      userId: 'user-1',
      email: 'test@example.com',
      pendingCount: 1,
      lastSyncAt: Date.now(),
      lastError: null,
      isSyncing: false,
      realtimeConnected: true
    });

    await act(async () => {
      render(<Account />);
    });

    await waitFor(() => {
      expect(screen.getByText('Sync Now')).toBeInTheDocument();
      expect(screen.getByText('Sign Out')).toBeInTheDocument();
    });
  });

  test('shows enhanced data management section', async () => {
    await act(async () => {
      render(<Account />);
    });

    await waitFor(() => {
      expect(screen.getByText('📁 Local Data Management')).toBeInTheDocument();
    });

    // Should show the tabbed interface
    expect(screen.getByText('Export Data')).toBeInTheDocument();
    expect(screen.getByText('Import Data')).toBeInTheDocument();
    expect(screen.getByText('Data Verification')).toBeInTheDocument();
  });
});
