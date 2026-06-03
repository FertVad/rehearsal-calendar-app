/**
 * Unit Tests for JWT Middleware
 *
 * Tests token generation, verification, and authentication middleware.
 * The db module is mocked because authenticateToken hits the DB to verify
 * the token's version against the stored version (revocation check).
 */
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';

// Mock the db module before importing the middleware (ESM-style)
const mockDbGet = jest.fn();
jest.unstable_mockModule('../../database/db.js', () => ({
  default: { get: mockDbGet },
}));

const { generateTokens, verifyToken, authenticateToken, requireAuth } =
  await import('../../middleware/jwtMiddleware.js');

describe('JWT Middleware', () => {
  const TEST_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-immediately';
  const userId = 123;

  beforeEach(() => {
    mockDbGet.mockReset();
    // Default: user exists with token_version=1
    mockDbGet.mockResolvedValue({ token_version: 1 });
  });

  describe('generateTokens', () => {
    it('should generate both access and refresh tokens', () => {
      const tokens = generateTokens(userId, 1);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });

    it('should include userId, type and token version in access token', () => {
      const tokens = generateTokens(userId, 5);
      const decoded = jwt.verify(tokens.accessToken, TEST_SECRET);

      expect(decoded.userId).toBe(userId);
      expect(decoded.type).toBe('access');
      expect(decoded.tv).toBe(5);
    });

    it('should include userId, type and token version in refresh token', () => {
      const tokens = generateTokens(userId, 5);
      const decoded = jwt.verify(tokens.refreshToken, TEST_SECRET);

      expect(decoded.userId).toBe(userId);
      expect(decoded.type).toBe('refresh');
      expect(decoded.tv).toBe(5);
    });

    it('should default tv to 1 when not provided', () => {
      const tokens = generateTokens(userId);
      const decoded = jwt.verify(tokens.accessToken, TEST_SECRET);

      expect(decoded.tv).toBe(1);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid access token', () => {
      const tokens = generateTokens(userId, 1);
      const decoded = verifyToken(tokens.accessToken, 'access');

      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(userId);
    });

    it('should return null for invalid token', () => {
      expect(verifyToken('invalid-token', 'access')).toBeNull();
    });

    it('should return null for expired token', () => {
      const expiredToken = jwt.sign(
        { userId, tv: 1, type: 'access' },
        TEST_SECRET,
        { expiresIn: '-1s' }
      );
      expect(verifyToken(expiredToken, 'access')).toBeNull();
    });

    it('should return null when token type does not match', () => {
      const tokens = generateTokens(userId, 1);
      expect(verifyToken(tokens.accessToken, 'refresh')).toBeNull();
    });
  });

  describe('authenticateToken', () => {
    let mockReq;
    let mockRes;
    let nextFunction;

    beforeEach(() => {
      mockReq = { headers: {} };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      nextFunction = jest.fn();
    });

    it('should authenticate with valid Bearer token', async () => {
      const tokens = generateTokens(userId, 1);
      mockReq.headers['authorization'] = `Bearer ${tokens.accessToken}`;

      await authenticateToken(mockReq, mockRes, nextFunction);

      expect(mockReq.userId).toBe(userId);
      expect(nextFunction).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is missing', async () => {
      await authenticateToken(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 with invalid token', async () => {
      mockReq.headers['authorization'] = 'Bearer invalid-token';

      await authenticateToken(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 when user no longer exists in DB', async () => {
      mockDbGet.mockResolvedValueOnce(null);
      const tokens = generateTokens(userId, 1);
      mockReq.headers['authorization'] = `Bearer ${tokens.accessToken}`;

      await authenticateToken(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'User no longer exists' });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 when token version is lower than DB version (session revoked)', async () => {
      mockDbGet.mockResolvedValueOnce({ token_version: 3 });
      const tokens = generateTokens(userId, 2); // token issued with old version
      mockReq.headers['authorization'] = `Bearer ${tokens.accessToken}`;

      await authenticateToken(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Session revoked' });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should accept token when version matches DB version', async () => {
      mockDbGet.mockResolvedValueOnce({ token_version: 7 });
      const tokens = generateTokens(userId, 7);
      mockReq.headers['authorization'] = `Bearer ${tokens.accessToken}`;

      await authenticateToken(mockReq, mockRes, nextFunction);

      expect(mockReq.userId).toBe(userId);
      expect(nextFunction).toHaveBeenCalled();
    });
  });

  describe('requireAuth alias', () => {
    it('should be the same function as authenticateToken', () => {
      expect(requireAuth).toBe(authenticateToken);
    });
  });
});
