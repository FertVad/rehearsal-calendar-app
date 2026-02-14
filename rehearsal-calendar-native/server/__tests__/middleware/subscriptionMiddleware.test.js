/**
 * Subscription Middleware Tests
 * Tests requireSubscription and attachSubscription middleware
 */
import { jest } from '@jest/globals';

const mockGetUserActiveSubscription = jest.fn();

jest.unstable_mockModule('../../services/subscriptionService.js', () => ({
  getUserActiveSubscription: mockGetUserActiveSubscription,
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { requireSubscription, attachSubscription } = await import(
  '../../middleware/subscriptionMiddleware.js'
);

describe('subscriptionMiddleware', () => {
  let mockReq;
  let mockRes;
  let nextFn;

  beforeEach(() => {
    mockReq = { userId: 1 };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFn = jest.fn();
    mockGetUserActiveSubscription.mockReset();
  });

  describe('requireSubscription', () => {
    it('should call next and attach subscription when user has active subscription', async () => {
      const mockSub = { id: 1, status: 'active', plan_name: 'monthly' };
      mockGetUserActiveSubscription.mockResolvedValue(mockSub);

      await requireSubscription(mockReq, mockRes, nextFn);

      expect(mockGetUserActiveSubscription).toHaveBeenCalledWith(1);
      expect(mockReq.subscription).toBe(mockSub);
      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 403 when user has no subscription', async () => {
      mockGetUserActiveSubscription.mockResolvedValue(null);

      await requireSubscription(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SUBSCRIPTION_REQUIRED' })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should return 401 when userId is missing', async () => {
      mockReq.userId = undefined;

      await requireSubscription(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'AUTH_REQUIRED' })
      );
      expect(nextFn).not.toHaveBeenCalled();
      expect(mockGetUserActiveSubscription).not.toHaveBeenCalled();
    });

    it('should return 500 when subscription check throws', async () => {
      mockGetUserActiveSubscription.mockRejectedValue(new Error('DB down'));

      await requireSubscription(mockReq, mockRes, nextFn);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'SUBSCRIPTION_CHECK_FAILED' })
      );
      expect(nextFn).not.toHaveBeenCalled();
    });
  });

  describe('attachSubscription', () => {
    it('should attach subscription and call next', async () => {
      const mockSub = { id: 1, status: 'active' };
      mockGetUserActiveSubscription.mockResolvedValue(mockSub);

      await attachSubscription(mockReq, mockRes, nextFn);

      expect(mockReq.subscription).toBe(mockSub);
      expect(nextFn).toHaveBeenCalled();
    });

    it('should set subscription to null when user has none', async () => {
      mockGetUserActiveSubscription.mockResolvedValue(null);

      await attachSubscription(mockReq, mockRes, nextFn);

      expect(mockReq.subscription).toBeNull();
      expect(nextFn).toHaveBeenCalled();
    });

    it('should set subscription to null when userId is missing', async () => {
      mockReq.userId = undefined;

      await attachSubscription(mockReq, mockRes, nextFn);

      expect(mockReq.subscription).toBeNull();
      expect(nextFn).toHaveBeenCalled();
      expect(mockGetUserActiveSubscription).not.toHaveBeenCalled();
    });

    it('should not block request on error — sets null and calls next', async () => {
      mockGetUserActiveSubscription.mockRejectedValue(new Error('DB error'));

      await attachSubscription(mockReq, mockRes, nextFn);

      expect(mockReq.subscription).toBeNull();
      expect(nextFn).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});
