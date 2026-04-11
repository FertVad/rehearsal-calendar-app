import { logger } from '../../../shared/utils/logger';
/**
 * AllPay WebView Handler
 * Handles postMessage events from AllPay Hosted Fields HTML
 */

export type AllPayMessageType =
  | 'PAYMENT_READY'
  | 'PAYMENT_LOADED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_ERROR'
  | 'PAYMENT_INIT_ERROR';

export interface AllPayMessage {
  type: AllPayMessageType;
  data: {
    orderId: string;
    message?: string;
    errorCode?: string | number;
    errorMessage?: string;
  };
  timestamp: string;
}

export interface AllPayWebViewHandlerCallbacks {
  onSuccess?: (message: AllPayMessage) => void;
  onError?: (message: AllPayMessage) => void;
  onReady?: (message: AllPayMessage) => void;
  onLoaded?: (message: AllPayMessage) => void;
}

/**
 * Parse and handle postMessage from AllPay Hosted Fields
 *
 * @param event - Raw postMessage event data (JSON string)
 * @param callbacks - Callback functions for different event types
 */
export const handleAllPayMessage = (
  event: string,
  callbacks: AllPayWebViewHandlerCallbacks
): void => {
  try {
    const message: AllPayMessage = JSON.parse(event);

    logger.debug('[AllPay Handler] Received message:', message);

    switch (message.type) {
      case 'PAYMENT_SUCCESS':
        logger.debug('[AllPay Handler] Payment successful!', message.data);
        callbacks.onSuccess?.(message);
        break;

      case 'PAYMENT_ERROR':
      case 'PAYMENT_INIT_ERROR':
        console.error('[AllPay Handler] Payment error:', message.data);
        callbacks.onError?.(message);
        break;

      case 'PAYMENT_READY':
        logger.debug('[AllPay Handler] Payment form ready');
        callbacks.onReady?.(message);
        break;

      case 'PAYMENT_LOADED':
        logger.debug('[AllPay Handler] iframe loaded');
        callbacks.onLoaded?.(message);
        break;

      default:
        console.warn('[AllPay Handler] Unknown message type:', message.type);
    }
  } catch (error) {
    console.error('[AllPay Handler] Failed to parse message:', error);
  }
};
