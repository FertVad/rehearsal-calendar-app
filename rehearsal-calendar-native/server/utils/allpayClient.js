/**
 * AllPay API Client
 * Handles signature generation, API requests, and webhook verification for AllPay payment provider
 *
 * Pattern based on:
 * - crypto usage from server/routes/native/invites.js
 * - fail-fast validation from server/middleware/jwtMiddleware.js
 */

import crypto from 'crypto';
import { logger } from './logger.js';

// Environment variables (fail-fast pattern)
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ALLPAY_API_LOGIN = process.env.ALLPAY_API_LOGIN;
const ALLPAY_API_KEY = process.env.ALLPAY_API_KEY;
const ALLPAY_TEST_MODE = process.env.ALLPAY_TEST_MODE === 'true';

// Fail-fast validation (pattern from jwtMiddleware.js)
if (!ALLPAY_API_LOGIN || !ALLPAY_API_KEY) {
  if (IS_PRODUCTION) {
    throw new Error(
      'FATAL: ALLPAY_API_LOGIN and ALLPAY_API_KEY are required in production. ' +
      'Add to server/.env from AllPay dashboard'
    );
  } else {
    logger.warn(
      '⚠️  WARNING: AllPay credentials not set. Payments will fail.\n' +
      '   Add to server/.env: ALLPAY_API_LOGIN and ALLPAY_API_KEY from https://www.allpay.co.il'
    );
  }
}

const ALLPAY_BASE_URL = 'https://allpay.to/app/';
const API_MODE = 'api10';

/**
 * Generate SHA256 signature for AllPay API
 * Algorithm from AllPay documentation:
 * 1. Remove 'sign' parameter
 * 2. Remove empty values
 * 3. Sort keys alphabetically (including nested items array)
 * 4. Extract values and join with ':'
 * 5. Append API key
 * 6. SHA256 hash
 *
 * @param {Object} params - API parameters
 * @returns {string} - Hex-encoded SHA256 signature
 */
export function generateAllPaySignature(params) {
  // Remove sign parameter and empty values
  const filteredParams = Object.entries(params)
    .filter(([key, value]) =>
      key !== 'sign' &&
      value !== '' &&
      value !== null &&
      value !== undefined
    )
    .sort(([a], [b]) => a.localeCompare(b)); // Sort alphabetically

  // Process values
  const values = filteredParams.map(([_, value]) => {
    if (Array.isArray(value)) {
      // For items array - stringify each object and join
      return value.map(item => {
        if (typeof item === 'object' && item !== null) {
          // Sort object keys alphabetically before stringifying
          const sortedItem = Object.entries(item)
            .sort(([a], [b]) => a.localeCompare(b))
            .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});
          return JSON.stringify(sortedItem);
        }
        return String(item);
      }).join(':');
    }

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }

    return String(value);
  });

  // Join with ':' and append API key
  const signatureBase = values.join(':') + ':' + ALLPAY_API_KEY;

  // Generate SHA256 hash
  return crypto.createHash('sha256').update(signatureBase).digest('hex');
}

/**
 * Verify webhook signature from AllPay callback
 * Uses timing-safe comparison to prevent timing attacks
 *
 * @param {Object} payload - Webhook payload
 * @param {string} receivedSignature - Signature from AllPay header
 * @returns {boolean} - Signature is valid
 */
export function verifyWebhookSignature(payload, receivedSignature) {
  if (!receivedSignature) {
    logger.warn('[AllPay] Webhook signature missing');
    return false;
  }

  try {
    const expectedSignature = generateAllPaySignature(payload);

    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    );
  } catch (error) {
    logger.error('[AllPay] Signature verification error:', error);
    return false;
  }
}

/**
 * Make request to AllPay API
 *
 * @param {string} endpoint - API endpoint (e.g., 'getpayment', 'gettoken')
 * @param {Object} params - Request parameters
 * @returns {Promise<Object>} - API response
 */
export async function allpayRequest(endpoint, params) {
  const requestParams = {
    login: ALLPAY_API_LOGIN,
    ...params,
  };

  // Add test mode flag if enabled
  if (ALLPAY_TEST_MODE) {
    requestParams.test = '1';
  }

  // Generate signature
  const signature = generateAllPaySignature(requestParams);
  requestParams.sign = signature;

  const url = `${ALLPAY_BASE_URL}?show=${endpoint}&mode=${API_MODE}`;

  logger.debug(`[AllPay] API request: ${endpoint}`, { params: requestParams });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(requestParams).toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error('[AllPay] API error:', data);
      throw new Error(data.error || 'AllPay API request failed');
    }

    logger.debug('[AllPay] API response:', { endpoint, data });
    return data;
  } catch (error) {
    logger.error('[AllPay] Request failed:', error);
    throw error;
  }
}

/**
 * AllPay API methods
 */
export const allpayAPI = {
  /**
   * Create payment with subscription
   *
   * @param {Object} options - Payment options
   * @returns {Promise<Object>} - { payment_url, order_id }
   */
  async createSubscriptionPayment({
    orderId,
    email,
    amount,
    currency = 'ILS',
    description,
    successUrl,
    cancelUrl,
    webhookUrl,
    subscriptionConfig, // { start_type, end_type, period, ... }
    customData = {},
  }) {
    const params = {
      order_id: orderId,
      email: email,
      currency: currency,
      items: [{
        name: description,
        price: amount,
        qty: 1,
        vat: 17, // Israeli VAT
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      webhook_url: webhookUrl,
      custom_data: JSON.stringify(customData),
    };

    // Add subscription configuration if provided
    if (subscriptionConfig) {
      params.subscription = JSON.stringify(subscriptionConfig);
    }

    const response = await allpayRequest('getpayment', params);

    return {
      paymentUrl: response.payment_url,
      orderId: params.order_id,
    };
  },

  /**
   * Tokenize payment after successful first payment
   *
   * @param {string} orderId - Order ID from initial payment
   * @returns {Promise<string>} - allpay_token
   */
  async getToken(orderId) {
    const response = await allpayRequest('gettoken', {
      order_id: orderId
    });

    if (!response.allpay_token) {
      throw new Error('Failed to retrieve AllPay token');
    }

    return response.allpay_token;
  },

  /**
   * Charge existing token (recurring payment)
   *
   * @param {Object} options - Charge options
   * @returns {Promise<Object>} - Payment result
   */
  async chargeToken({
    allpayToken,
    amount,
    currency = 'ILS',
    description,
    orderId,
  }) {
    const params = {
      allpay_token: allpayToken,
      order_id: orderId,
      currency: currency,
      items: [{
        name: description,
        price: amount,
        qty: 1,
        vat: 17,
      }],
    };

    return await allpayRequest('getpayment', params);
  },

  /**
   * Get payment status
   *
   * @param {string} orderId - AllPay order ID
   * @returns {Promise<Object>} - { status: 0|1|3|4, ... }
   * 0=unpaid, 1=paid, 3=refunded, 4=partially_refunded
   */
  async getPaymentStatus(orderId) {
    return await allpayRequest('paymentstatus', {
      order_id: orderId
    });
  },

  /**
   * Cancel subscription
   *
   * @param {string} subscriptionId - AllPay subscription ID
   * @returns {Promise<Object>}
   */
  async cancelSubscription(subscriptionId) {
    return await allpayRequest('cancelsubscription', {
      subscription_id: subscriptionId,
    });
  },

  /**
   * Get subscription status
   *
   * @param {string} subscriptionId - AllPay subscription ID
   * @returns {Promise<Object>}
   */
  async getSubscriptionStatus(subscriptionId) {
    return await allpayRequest('subscriptionstatus', {
      subscription_id: subscriptionId,
    });
  },

  /**
   * Get all subscriptions for a user
   *
   * @param {string} customerEmail - User email
   * @returns {Promise<Array>}
   */
  async getUserSubscriptions(customerEmail) {
    return await allpayRequest('getsubscriptions', {
      customer_email: customerEmail,
    });
  },

  /**
   * Create refund (full or partial)
   *
   * @param {string} orderId - Original payment order ID
   * @param {Array} items - Items to refund (null for full refund)
   * @returns {Promise<Object>}
   */
  async createRefund(orderId, items = null) {
    const params = { order_id: orderId };

    if (items) {
      params.items = items; // Partial refund
    }

    return await allpayRequest('refund', params);
  },

  /**
   * Check API credentials validity (for debugging)
   *
   * @returns {Promise<Object>}
   */
  async checkKeys() {
    return await allpayRequest('checkkeys', {});
  },
};
