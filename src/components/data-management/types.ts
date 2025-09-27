export type TabType = 'export' | 'import' | 'verification';

export interface MessageState {
  type: 'success' | 'error' | 'info';
  text: string;
}