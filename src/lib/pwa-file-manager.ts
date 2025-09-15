/**
 * PWA File Manager with native File System Access API support
 * Provides native file picker functionality for better export/import experience
 */

export interface FilePickerOptions {
  suggestedName?: string;
  types?: FilePickerAcceptType[];
  excludeAcceptAllOption?: boolean;
}

export interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string[]>;
}

export interface SaveFileResult {
  success: boolean;
  filename: string;
  size: number;
  location: 'native-picker' | 'download' | 'error';
  error?: string;
}

export interface OpenFileResult {
  success: boolean;
  file: File | null;
  method: 'native-picker' | 'file-input' | 'error';
  error?: string;
}

declare global {
  interface Window {
    showSaveFilePicker?: (options?: {
      suggestedName?: string;
      types?: FilePickerAcceptType[];
      excludeAcceptAllOption?: boolean;
    }) => Promise<FileSystemFileHandle>;

    showOpenFilePicker?: (options?: {
      multiple?: boolean;
      types?: FilePickerAcceptType[];
      excludeAcceptAllOption?: boolean;
    }) => Promise<FileSystemFileHandle[]>;
  }

  interface FileSystemFileHandle {
    createWritable(): Promise<FileSystemWritableFileStream>;
    getFile(): Promise<File>;
  }

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: string | BufferSource | Blob): Promise<void>;
    close(): Promise<void>;
  }
}

export class PWAFileManager {
  /**
   * Check if File System Access API is supported
   */
  static isNativeFileAPISupported(): boolean {
    return typeof window !== 'undefined' && 'showSaveFilePicker' in window;
  }

  /**
   * Save file using native picker or fallback to download
   */
  static async saveFile(
    content: string,
    filename: string,
    mimeType: string = 'application/json'
  ): Promise<SaveFileResult> {
    const blob = new Blob([content], { type: mimeType });
    const size = blob.size;

    // Try native File System Access API first
    if (this.isNativeFileAPISupported()) {
      try {
        return await this.saveWithNativePicker(content, filename, mimeType, size);
      } catch (error) {
        console.log('PWA: Native file picker failed, falling back to download:', error);
        // Fall through to traditional download
      }
    }

    // Fallback to traditional download
    return await this.saveWithDownload(content, filename, size);
  }

  /**
   * Save file using native File System Access API
   */
  private static async saveWithNativePicker(
    content: string,
    filename: string,
    mimeType: string,
    size: number
  ): Promise<SaveFileResult> {
    const fileExtension = filename.split('.').pop() || '';
    const accept: Record<string, string[]> = {};
    accept[mimeType] = [`.${fileExtension}`];

    const options: FilePickerOptions = {
      suggestedName: filename,
      types: [
        {
          description: 'Recipe Tracker Data',
          accept
        }
      ]
    };

    try {
      const fileHandle = await window.showSaveFilePicker!(options);
      const writable = await fileHandle.createWritable();

      await writable.write(content);
      await writable.close();

      console.log('PWA: File saved successfully using native picker');

      return {
        success: true,
        filename,
        size,
        location: 'native-picker'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // User cancelled the dialog
      if (errorMessage.includes('aborted') || errorMessage.includes('cancelled')) {
        return {
          success: false,
          filename,
          size,
          location: 'error',
          error: 'User cancelled file save'
        };
      }

      // Other errors
      throw new Error(`Native file save failed: ${errorMessage}`);
    }
  }

  /**
   * Save file using traditional download method
   */
  private static async saveWithDownload(
    content: string,
    filename: string,
    size: number
  ): Promise<SaveFileResult> {
    try {
      const blob = new Blob([content], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the URL object after a short delay
      setTimeout(() => URL.revokeObjectURL(url), 100);

      console.log('PWA: File saved using traditional download');

      return {
        success: true,
        filename,
        size,
        location: 'download'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        filename,
        size,
        location: 'error',
        error: `Download failed: ${errorMessage}`
      };
    }
  }

  /**
   * Open file using native picker or file input
   */
  static async openFile(
    acceptedTypes: string[] = ['.json']
  ): Promise<OpenFileResult> {
    // Try native File System Access API first
    if (this.isNativeFileAPISupported() && 'showOpenFilePicker' in window) {
      try {
        return await this.openWithNativePicker(acceptedTypes);
      } catch (error) {
        console.log('PWA: Native file picker failed, falling back to file input:', error);
        // Fall through to file input
      }
    }

    // Fallback to file input
    return await this.openWithFileInput(acceptedTypes);
  }

  /**
   * Open file using native File System Access API
   */
  private static async openWithNativePicker(
    acceptedTypes: string[]
  ): Promise<OpenFileResult> {
    const accept: Record<string, string[]> = {};

    // Build accept object for different file types
    if (acceptedTypes.includes('.json')) {
      accept['application/json'] = ['.json'];
    }
    if (acceptedTypes.includes('.csv')) {
      accept['text/csv'] = ['.csv'];
    }
    if (acceptedTypes.includes('.txt')) {
      accept['text/plain'] = ['.txt'];
    }

    const options = {
      types: [
        {
          description: 'Recipe Tracker Files',
          accept
        }
      ],
      multiple: false
    };

    try {
      const [fileHandle] = await window.showOpenFilePicker!(options);
      const file = await fileHandle.getFile();

      console.log('PWA: File opened successfully using native picker');

      return {
        success: true,
        file,
        method: 'native-picker'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // User cancelled
      if (errorMessage.includes('aborted') || errorMessage.includes('cancelled')) {
        return {
          success: false,
          file: null,
          method: 'error',
          error: 'User cancelled file selection'
        };
      }

      throw new Error(`Native file open failed: ${errorMessage}`);
    }
  }

  /**
   * Open file using traditional file input
   */
  private static async openWithFileInput(
    acceptedTypes: string[]
  ): Promise<OpenFileResult> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = acceptedTypes.join(',');
      input.style.display = 'none';

      input.addEventListener('change', (event) => {
        const target = event.target as HTMLInputElement;
        const file = target.files?.[0] || null;

        document.body.removeChild(input);

        if (file) {
          console.log('PWA: File opened using file input');
          resolve({
            success: true,
            file,
            method: 'file-input'
          });
        } else {
          resolve({
            success: false,
            file: null,
            method: 'error',
            error: 'No file selected'
          });
        }
      });

      input.addEventListener('cancel', () => {
        document.body.removeChild(input);
        resolve({
          success: false,
          file: null,
          method: 'error',
          error: 'User cancelled file selection'
        });
      });

      document.body.appendChild(input);
      input.click();
    });
  }

  /**
   * Get user-friendly description of save location
   */
  static getSaveLocationDescription(location: SaveFileResult['location']): string {
    switch (location) {
      case 'native-picker':
        return 'Saved to your chosen location (Google Drive, OneDrive, local folder, etc.)';
      case 'download':
        return 'Downloaded to your default downloads folder';
      case 'error':
        return 'Failed to save file';
      default:
        return 'File saved';
    }
  }

  /**
   * Check what file operations are available
   */
  static getAvailableFeatures() {
    return {
      nativeFilePicker: this.isNativeFileAPISupported(),
      traditionalDownload: true,
      fileInput: true,
      webShare: typeof navigator !== 'undefined' && 'share' in navigator
    };
  }
}