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
  isBackupNeeded: jest.fn().mockReturnValue(true)
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
    expect(screen.getByText('Enhanced Data Management')).toBeInTheDocument();
    expect(screen.getByText('Backup Now')).toBeInTheDocument();
  });

  test('displays backup status correctly', async () => {
    await act(async () => {
      render(<Account />);
    });

    await waitFor(() => {
      expect(screen.getByText('Backup Recommended')).toBeInTheDocument();
    });

    expect(screen.getByText(/5 meals — last backed up Never/)).toBeInTheDocument();
  });

  test('backup button is clickable', async () => {
    await act(async () => {
      render(<Account />);
    });

    await waitFor(() => {
      expect(screen.getByText('Backup Now')).toBeInTheDocument();
    });

    const backupButton = screen.getByText('Backup Now');
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
      expect(screen.getByText('Enhanced Data Management')).toBeInTheDocument();
    });

    // Should show the expandable section
    expect(screen.getByText('▼')).toBeInTheDocument();
  });
});
