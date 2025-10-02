import { useState, useCallback, useRef } from 'react';

export type MessageType = 'success' | 'error' | 'warning' | 'info';

export interface Message {
  id: string;
  text: string;
  type: MessageType;
  timestamp: number;
  autoClose?: boolean;
}

interface UseMessagesOptions {
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export interface UseMessagesReturn {
  messages: Message[];
  addMessage: (text: string, type?: MessageType, autoClose?: boolean) => string;
  addSuccess: (text: string, autoClose?: boolean) => string;
  addError: (text: string, autoClose?: boolean) => string;
  addWarning: (text: string, autoClose?: boolean) => string;
  addInfo: (text: string, autoClose?: boolean) => string;
  clearMessage: (id: string) => void;
  clearAllMessages: () => void;
}

/**
 * Hook for managing temporary messages/notifications
 *
 * @param options - Configuration options
 * @returns Object with messages state and control functions
 *
 * @example
 * ```typescript
 * const { messages, addSuccess, addError, clearMessage } = useMessages({
 *   autoClose: true,
 *   autoCloseDelay: 3000
 * });
 *
 * const handleSubmit = async () => {
 *   try {
 *     await submitData();
 *     addSuccess('Data saved successfully!');
 *   } catch (error) {
 *     addError('Failed to save data');
 *   }
 * };
 *
 * return (
 *   <div>
 *     {messages.map(message => (
 *       <div key={message.id} className={`message message-${message.type}`}>
 *         {message.text}
 *         <button onClick={() => clearMessage(message.id)}>×</button>
 *       </div>
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useMessages(options: UseMessagesOptions = {}): UseMessagesReturn {
  const { autoClose = true, autoCloseDelay = 3000 } = options;
  const [messages, setMessages] = useState<Message[]>([]);
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const clearMessage = useCallback((id: string) => {
    // Clear any existing timeout for this message
    const timeoutId = timeoutRefs.current.get(id);
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutRefs.current.delete(id);
    }

    setMessages(prev => prev.filter(message => message.id !== id));
  }, []);

  const addMessage = useCallback((
    text: string,
    type: MessageType = 'info',
    shouldAutoClose?: boolean
  ): string => {
    const id = `message-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const message: Message = {
      id,
      text,
      type,
      timestamp: Date.now(),
      autoClose: shouldAutoClose ?? autoClose
    };

    setMessages(prev => [...prev, message]);

    // Set up auto-close if enabled
    if (message.autoClose) {
      const timeoutId = setTimeout(() => {
        clearMessage(id);
      }, autoCloseDelay);

      timeoutRefs.current.set(id, timeoutId);
    }

    return id;
  }, [autoClose, autoCloseDelay, clearMessage]);

  const addSuccess = useCallback((text: string, shouldAutoClose?: boolean) => {
    return addMessage(text, 'success', shouldAutoClose);
  }, [addMessage]);

  const addError = useCallback((text: string, shouldAutoClose?: boolean) => {
    return addMessage(text, 'error', shouldAutoClose);
  }, [addMessage]);

  const addWarning = useCallback((text: string, shouldAutoClose?: boolean) => {
    return addMessage(text, 'warning', shouldAutoClose);
  }, [addMessage]);

  const addInfo = useCallback((text: string, shouldAutoClose?: boolean) => {
    return addMessage(text, 'info', shouldAutoClose);
  }, [addMessage]);

  const clearAllMessages = useCallback(() => {
    // Clear all timeouts
    timeoutRefs.current.forEach(timeoutId => clearTimeout(timeoutId));
    timeoutRefs.current.clear();

    setMessages([]);
  }, []);

  return {
    messages,
    addMessage,
    addSuccess,
    addError,
    addWarning,
    addInfo,
    clearMessage,
    clearAllMessages
  };
}