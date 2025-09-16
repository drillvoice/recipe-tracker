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

jest.mock('@/lib/database-migration', () => ({
  migrateLegacyData: jest.fn().mockResolvedValue({
    success: true,
    migratedCount: 0,
    errors: []
  }),
  isMigrationNeeded: jest.fn().mockResolvedValue(false)
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

// Mock the firestore-backup module
jest.mock('@/lib/firestore-backup', () => ({
  backupMealsToCloud: jest.fn().mockResolvedValue({
    success: true,
    mealsBackedUp: 5,
    timestamp: Date.now(),
    errors: [],
    userId: 'test-uid'
  }),
  getCloudBackupStatus: jest.fn().mockResolvedValue({
    isAuthenticated: true,
    userId: 'test-uid',
    lastCloudBackup: Date.now() - 1000 * 60 * 60 * 24, // 1 day ago
    cloudMealCount: 5,
    syncNeeded: false
  })
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

    expect(screen.getByText('Cloud Backup')).toBeInTheDocument();
    expect(screen.getByText('Local Data Management')).toBeInTheDocument();
    expect(screen.getByText('Backup to Cloud')).toBeInTheDocument();
  });

  test('displays backup status correctly', async () => {
    await act(async () => {
      render(<Account />);
    });

    await waitFor(() => {
      expect(screen.getByText('Cloud Backup')).toBeInTheDocument();
    });

    // Check for cloud backup status elements in the new format
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('meals in cloud')).toBeInTheDocument();
    expect(screen.getByText('Last backup:')).toBeInTheDocument();
    expect(screen.getByText('Status:')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  test('backup button is clickable', async () => {
    await act(async () => {
      render(<Account />);
    });

    await waitFor(() => {
      expect(screen.getByText('Backup to Cloud')).toBeInTheDocument();
    });

    const backupButton = screen.getByText('Backup to Cloud');
    expect(backupButton).toBeEnabled();

    // Just ensure clicking doesn't crash
    await act(async () => {
      fireEvent.click(backupButton);
    });
  });

  test('shows enhanced data management section', async () => {
    await act(async () => {
      render(<Account />);
    });

    await waitFor(() => {
      expect(screen.getByText('Local Data Management')).toBeInTheDocument();
    });

    // Should show the tabbed interface
    expect(screen.getByText('Export Data')).toBeInTheDocument();
    expect(screen.getByText('Import Data')).toBeInTheDocument();
    expect(screen.getByText('Backup Verification')).toBeInTheDocument();
  });
});
