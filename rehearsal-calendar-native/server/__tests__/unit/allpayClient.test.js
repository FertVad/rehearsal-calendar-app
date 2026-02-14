/**
 * AllPay Client Unit Tests
 * Tests signature generation, webhook verification, and API method parameter formatting
 */
import { jest } from '@jest/globals';
import crypto from 'crypto';

// Set env before importing
process.env.ALLPAY_API_LOGIN = 'test_login';
process.env.ALLPAY_API_KEY = 'TEST_API_KEY_ABC123';
process.env.ALLPAY_WEBHOOK_SECRET = 'TEST_WEBHOOK_SECRET_XYZ';
process.env.ALLPAY_TEST_MODE = 'true';
process.env.NODE_ENV = 'test';

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const {
  generateAllPaySignature,
  verifyWebhookSignature,
  allpayAPI,
} = await import('../../utils/allpayClient.js');

describe('allpayClient', () => {
  describe('generateAllPaySignature', () => {
    it('should generate valid 64-char hex SHA256 hash', () => {
      const sig = generateAllPaySignature({ amount: '100' });
      expect(sig).toMatch(/^[a-f0-9]{64}$/);
    });

    it('should produce same hash regardless of parameter order', () => {
      const sig1 = generateAllPaySignature({ z_param: '1', a_param: '2' });
      const sig2 = generateAllPaySignature({ a_param: '2', z_param: '1' });
      expect(sig1).toBe(sig2);
    });

    it('should exclude "sign" parameter', () => {
      const sig1 = generateAllPaySignature({ amount: '100', sign: 'old_signature' });
      const sig2 = generateAllPaySignature({ amount: '100' });
      expect(sig1).toBe(sig2);
    });

    it('should filter empty string values', () => {
      const sig1 = generateAllPaySignature({ amount: '100', email: '' });
      const sig2 = generateAllPaySignature({ amount: '100' });
      expect(sig1).toBe(sig2);
    });

    it('should filter null and undefined values', () => {
      const sig1 = generateAllPaySignature({ amount: '100', b: null, c: undefined });
      const sig2 = generateAllPaySignature({ amount: '100' });
      expect(sig1).toBe(sig2);
    });

    it('should NOT filter "0" — it is a valid value', () => {
      const sig1 = generateAllPaySignature({ amount: '100', discount: '0' });
      const sig2 = generateAllPaySignature({ amount: '100' });
      expect(sig1).not.toBe(sig2);
    });

    it('should produce expected signature for known input', () => {
      // Sorted keys: [a, b] → values ['1', '2'] → base = '1:2:TEST_API_KEY_ABC123'
      const expected = crypto
        .createHash('sha256')
        .update('1:2:TEST_API_KEY_ABC123')
        .digest('hex');

      const sig = generateAllPaySignature({ b: '2', a: '1' });
      expect(sig).toBe(expected);
    });
  });

  describe('verifyWebhookSignature', () => {
    function computeWebhookSig(payload) {
      const filtered = Object.entries(payload)
        .filter(([k, v]) => k !== 'sign' && v !== '' && v !== null && v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b));
      const base = filtered.map(([, v]) => String(v)).join(':') + ':TEST_WEBHOOK_SECRET_XYZ';
      return crypto.createHash('sha256').update(base).digest('hex');
    }

    it('should return true for valid signature', () => {
      const payload = { order_id: 'ORD-1', status: '1' };
      const sig = computeWebhookSig(payload);
      expect(verifyWebhookSignature(payload, sig)).toBe(true);
    });

    it('should return false for invalid signature', () => {
      const payload = { order_id: 'ORD-1', status: '1' };
      // Create a valid-length but wrong signature
      const wrongSig = crypto.createHash('sha256').update('wrong').digest('hex');
      expect(verifyWebhookSignature(payload, wrongSig)).toBe(false);
    });

    it('should return false when signature is missing', () => {
      expect(verifyWebhookSignature({ order_id: 'ORD-1' }, null)).toBe(false);
      expect(verifyWebhookSignature({ order_id: 'ORD-1' }, '')).toBe(false);
    });

    it('should skip verification in test mode with placeholder signature', () => {
      expect(
        verifyWebhookSignature({ order_id: 'ORD-1' }, 'test-mode-skip-signature')
      ).toBe(true);
    });

    it('should return false for short signature without throwing', () => {
      // timingSafeEqual throws on length mismatch — try/catch should handle it
      expect(verifyWebhookSignature({ order_id: 'X' }, 'short')).toBe(false);
    });
  });

  describe('allpayAPI', () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = global.fetch;
      global.fetch = jest.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    describe('chargeToken', () => {
      it('should send correct parameters', async () => {
        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ status: 1, transaction_id: 'txn_1' }),
        });

        await allpayAPI.chargeToken({
          allpayToken: 'tok_123',
          amount: 9.0,
          currency: 'USD',
          description: 'Monthly plan',
          orderId: 'SUB-1-123',
        });

        expect(global.fetch).toHaveBeenCalledTimes(1);
        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toContain('getpayment');
        expect(options.method).toBe('POST');

        const body = new URLSearchParams(options.body);
        expect(body.get('allpay_token')).toBe('tok_123');
        expect(body.get('order_id')).toBe('SUB-1-123');
        expect(body.get('currency')).toBe('USD');
        expect(body.get('items[0][price]')).toBe('9');
        expect(body.get('test')).toBe('1'); // test mode enabled
      });
    });

    describe('getToken', () => {
      it('should return allpay_token from response', async () => {
        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ allpay_token: 'tok_returned_abc' }),
        });

        const token = await allpayAPI.getToken('ORD-123');
        expect(token).toBe('tok_returned_abc');
      });

      it('should throw when token is missing from response', async () => {
        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({}),
        });

        await expect(allpayAPI.getToken('ORD-123')).rejects.toThrow(
          'Failed to retrieve AllPay token'
        );
      });
    });

    describe('getPaymentStatus', () => {
      it('should call paymentstatus endpoint with order_id', async () => {
        global.fetch.mockResolvedValue({
          ok: true,
          json: async () => ({ status: 1 }),
        });

        const result = await allpayAPI.getPaymentStatus('ORD-456');
        expect(result.status).toBe(1);

        const [url] = global.fetch.mock.calls[0];
        expect(url).toContain('paymentstatus');
      });
    });
  });
});
