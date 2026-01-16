/**
 * Unit Tests for JWT Middleware
 *
 * Tests token generation, verification, and authentication middleware
 */
import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import {
  generateTokens,
  verifyToken,
  authenticateToken,
  requireAuth,
} from '../../middleware/jwtMiddleware.js';

describe('JWT Middleware', () => {
  // Use same secret as jwtMiddleware.js default
  const TEST_SECRET = process.env.JWT_SECRET || 'dev-only-insecure-secret-change-immediately';
  const userId = 123;

  describe('generateTokens', () => {
    it('should generate both access and refresh tokens', () => {
      const tokens = generateTokens(userId);

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.accessToken).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });

    it('should include userId and correct type in access token', () => {
      const tokens = generateTokens(userId);
      const decoded = jwt.verify(tokens.accessToken, TEST_SECRET);

      expect(decoded.userId).toBe(userId);
      expect(decoded.type).toBe('access');
      expect(decoded).toHaveProperty('exp');
      expect(decoded).toHaveProperty('iat');
    });

    it('should include userId and correct type in refresh token', () => {
      const tokens = generateTokens(userId);
      const decoded = jwt.verify(tokens.refreshToken, TEST_SECRET);

      expect(decoded.userId).toBe(userId);
      expect(decoded.type).toBe('refresh');
      expect(decoded).toHaveProperty('exp');
      expect(decoded).toHaveProperty('iat');
    });

    it('should create different tokens for different users', () => {
      const tokens1 = generateTokens(1);
      const tokens2 = generateTokens(2);

      expect(tokens1.accessToken).not.toBe(tokens2.accessToken);
      expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
    });
  });

  describe('verifyToken', () => {
    it('should verify valid access token', () => {
      const tokens = generateTokens(userId);
      const decoded = verifyToken(tokens.accessToken, 'access');

      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(userId);
      expect(decoded.type).toBe('access');
    });

    it('should verify valid refresh token', () => {
      const tokens = generateTokens(userId);
      const decoded = verifyToken(tokens.refreshToken, 'refresh');

      expect(decoded).toBeTruthy();
      expect(decoded.userId).toBe(userId);
      expect(decoded.type).toBe('refresh');
    });

    it('should return null for invalid token', () => {
      const decoded = verifyToken('invalid-token', 'access');
      expect(decoded).toBeNull();
    });

    it('should return null for expired token', () => {
      // Create an expired token
      const expiredToken = jwt.sign(
        { userId, type: 'access' },
        TEST_SECRET,
        { expiresIn: '-1s' } // Already expired
      );

      const decoded = verifyToken(expiredToken, 'access');
      expect(decoded).toBeNull();
    });

    it('should return null when token type does not match', () => {
      const tokens = generateTokens(userId);

      // Try to verify access token as refresh token
      const decoded = verifyToken(tokens.accessToken, 'refresh');
      expect(decoded).toBeNull();
    });

    it('should return null for malformed token', () => {
      const decoded = verifyToken('malformed.jwt.token', 'access');
      expect(decoded).toBeNull();
    });

    it('should return null for empty token', () => {
      const decoded = verifyToken('', 'access');
      expect(decoded).toBeNull();
    });

    it('should return null for token with wrong secret', () => {
      // Create token with different secret
      const wrongToken = jwt.sign(
        { userId, type: 'access' },
        'wrong-secret',
        { expiresIn: '1h' }
      );

      const decoded = verifyToken(wrongToken, 'access');
      expect(decoded).toBeNull();
    });
  });

  describe('authenticateToken', () => {
    let mockReq;
    let mockRes;
    let nextFunction;

    beforeEach(() => {
      mockReq = {
        headers: {},
      };
      mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      nextFunction = jest.fn();
    });

    it('should authenticate with valid Bearer token', () => {
      const tokens = generateTokens(userId);
      mockReq.headers['authorization'] = `Bearer ${tokens.accessToken}`;

      authenticateToken(mockReq, mockRes, nextFunction);

      expect(mockReq.userId).toBe(userId);
      expect(nextFunction).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should return 401 when authorization header is missing', () => {
      authenticateToken(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access token required',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 when token is missing from header', () => {
      mockReq.headers['authorization'] = 'Bearer ';

      authenticateToken(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Access token required',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 with invalid token', () => {
      mockReq.headers['authorization'] = 'Bearer invalid-token';

      authenticateToken(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 with expired token', () => {
      const expiredToken = jwt.sign(
        { userId, type: 'access' },
        TEST_SECRET,
        { expiresIn: '-1s' }
      );
      mockReq.headers['authorization'] = `Bearer ${expiredToken}`;

      authenticateToken(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 401 when using refresh token instead of access token', () => {
      const tokens = generateTokens(userId);
      mockReq.headers['authorization'] = `Bearer ${tokens.refreshToken}`;

      authenticateToken(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Invalid or expired token',
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should handle authorization header without Bearer prefix', () => {
      const tokens = generateTokens(userId);
      mockReq.headers['authorization'] = tokens.accessToken;

      authenticateToken(mockReq, mockRes, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('requireAuth alias', () => {
    it('should be the same function as authenticateToken', () => {
      expect(requireAuth).toBe(authenticateToken);
    });
  });
});
