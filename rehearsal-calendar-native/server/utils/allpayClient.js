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

// Environment variables getter functions (to avoid loading before dotenv.config())
const getApiLogin = () => process.env.ALLPAY_API_LOGIN;
const getApiKey = () => process.env.ALLPAY_API_KEY;
const getWebhookSecret = () => process.env.ALLPAY_WEBHOOK_SECRET || process.env.ALLPAY_API_KEY;
const isTestMode = () => process.env.ALLPAY_TEST_MODE === 'true';
const isProduction = () => process.env.NODE_ENV === 'production';

// Validate credentials (called at runtime, not at module load)
function validateCredentials() {
  const login = getApiLogin();
  const key = getApiKey();

  if (!login || !key) {
    const error = 'AllPay credentials not configured. Add ALLPAY_API_LOGIN and ALLPAY_API_KEY to server/.env';
    if (isProduction()) {
      throw new Error(`FATAL: ${error}`);
    }
    throw new Error(error);
  }

  return { login, key };
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
  const { key } = validateCredentials();

  // CRITICAL: Filter empty strings from top-level params only
  // Items array values are NOT filtered (even if "0" or empty)
  const filteredParams = Object.entries(params)
    .filter(([key, value]) =>
      key !== 'sign' &&
      value !== '' &&  // Filter empty strings at top level
      value !== null &&
      value !== undefined
    )
    .sort(([a], [b]) => a.localeCompare(b)); // Sort alphabetically

  // Extract values - simple string conversion (works with indexed params like items[0][price])
  const chunks = [];

  for (const [_, value] of filteredParams) {
    chunks.push(String(value));
  }

  // Join with ':' and append API key
  const signatureBase = chunks.join(':') + ':' + key;

  // Generate SHA256 hash
  return crypto.createHash('sha256').update(signatureBase).digest('hex');
}

/**
 * Verify webhook signature from AllPay callback
 * Uses timing-safe comparison to prevent timing attacks
 * Uses ALLPAY_WEBHOOK_SECRET (or API_KEY as fallback) for verification
 *
 * @param {Object} payload - Webhook payload
 * @param {string} receivedSignature - Signature from AllPay header
 * @returns {boolean} - Signature is valid
 */
export function verifyWebhookSignature(payload, receivedSignature) {
  // Skip verification in test mode if signature is placeholder
  if (receivedSignature === 'test-mode-skip-signature' && isTestMode()) {
    logger.warn('[AllPay] Skipping signature verification in test mode');
    return true;
  }

  if (!receivedSignature) {
    logger.warn('[AllPay] Webhook signature missing');
    return false;
  }

  try {
    const webhookSecret = getWebhookSecret();

    // Generate signature using webhook secret instead of API key
    const filteredParams = Object.entries(payload)
      .filter(([key, value]) =>
        key !== 'sign' &&
        value !== '' &&
        value !== null &&
        value !== undefined
      )
      .sort(([a], [b]) => a.localeCompare(b));

    const chunks = filteredParams.map(([_, value]) => String(value));
    const signatureBase = chunks.join(':') + ':' + webhookSecret;
    const expectedSignature = crypto.createHash('sha256').update(signatureBase).digest('hex');

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
  const { login } = validateCredentials();

  const requestParams = {
    login,
    ...params,
  };

  // Add test mode flag if enabled
  if (isTestMode()) {
    requestParams.test = '1';
  }

  // Generate signature
  const signature = generateAllPaySignature(requestParams);
  requestParams.sign = signature;

  const url = `${ALLPAY_BASE_URL}?show=${endpoint}&mode=${API_MODE}`;

  logger.debug(`[AllPay] API request: ${endpoint}`, { params: requestParams });

  try {
    // Serialize params for URLSearchParams (indexed params are already flat strings)
    const serializedParams = new URLSearchParams();
    for (const [key, value] of Object.entries(requestParams)) {
      serializedParams.append(key, String(value));
    }

    logger.debug(`[AllPay] Request body: ${decodeURIComponent(serializedParams.toString())}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: serializedParams.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      logger.error('[AllPay] API error:', data);
      throw new Error(data.error || 'AllPay API request failed');
    }

    logger.debug('[AllPay] API response:', JSON.stringify({ endpoint, data }));
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
    language = 'en', // User's preferred language (en, ru, he, etc.)
    displayCurrency = 'USD', // Currency to display to user
    clientName, // REQUIRED: Customer's full name
  }) {
    // Use indexed params format for items (AllPay expects items[0][name], items[0][price], etc.)
    const params = {
      order_id: orderId,
      email: email,
      client_email: email, // AllPay requires this field
      client_name: clientName || 'Customer', // REQUIRED field
      currency: currency, // Billing currency (ILS, USD, EUR)
      currency_display: displayCurrency, // Display currency (what user sees)
      lang: language.toUpperCase(), // EN, RU, HE, etc.
      'items[0][name]': description,
      'items[0][price]': String(amount),
      'items[0][qty]': '1',
      'items[0][discount_val]': '0',
      'items[0][discount_type]': 'fixed',
      'items[0][vat]': '17',
      success_url: successUrl,
      cancel_url: cancelUrl,
      webhook_url: webhookUrl,
      custom_data: JSON.stringify(customData),
    };

    logger.debug(`[AllPay] Creating payment: ${amount} ${displayCurrency} (billing in ${currency}), lang: ${language}`);

    // Add subscription configuration if provided
    if (subscriptionConfig) {
      params.subscription = JSON.stringify(subscriptionConfig);
    }

    const response = await allpayRequest('getpayment', params);

    // Debug: Log full response to troubleshoot missing payment_url
    logger.info('[AllPay] Full getpayment response:', JSON.stringify(response, null, 2));

    if (!response.payment_url) {
      logger.error('[AllPay] payment_url is missing from response:', response);
      throw new Error('AllPay API did not return payment_url. Check API credentials and AllPay dashboard.');
    }

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
    // Use indexed params format for items
    const params = {
      allpay_token: allpayToken,
      order_id: orderId,
      currency: currency,
      'items[0][name]': description,
      'items[0][price]': String(amount),
      'items[0][qty]': '1',
      'items[0][discount_val]': '0',
      'items[0][discount_type]': 'fixed',
      'items[0][vat]': '17',
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
