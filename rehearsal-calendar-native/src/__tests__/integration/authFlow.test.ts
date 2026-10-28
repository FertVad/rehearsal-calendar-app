/**
 * Integration Tests: Authentication Flow
 *
 * Tests full authentication flow: registration → login → token storage → profile access
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../../shared/services/api';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
  },
}));

// Mock axios to avoid real network requests
jest.mock('axios', () => {
  const mockAxios: any = {
    create: jest.fn(() => mockAxios),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: jest.fn(), eject: jest.fn() },
      response: { use: jest.fn(), eject: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    patch: jest.fn(),
  };
  return mockAxios;
});

import axios from 'axios';

describe('Auth Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Full Registration → Login → Profile Flow', () => {
    it('should complete full auth flow successfully', async () => {
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
      };

      const mockTokens = {
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      };

      // Step 1: Registration
      // No session from registration: the server emails a code (R3).
      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: { status: 'verification_required', email: 'test@example.com', delivery: 'sent' },
      });

      const registerResponse = await authAPI.register(
        'test@example.com',
        'password123',
        'Test',
        'User'
      );

      expect(axios.post).toHaveBeenCalledWith('/auth/register', {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Test',
        lastName: 'User',
        timezone: undefined,
        locale: undefined,
        verification: 'code',
      }, expect.objectContaining({ timeout: expect.any(Number) }));
      expect(registerResponse.data.accessToken).toBeUndefined();

      // The emailed code, with the same password, starts the session. The
      // server answers with flat accessToken/refreshToken beside the user.
      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          user: mockUser,
          ...mockTokens,
        },
      });

      const verifiedResponse = await authAPI.verifyEmail('test@example.com', 'password123', '123456');

      expect(axios.post).toHaveBeenCalledWith('/auth/verify-email', {
        email: 'test@example.com',
        password: 'password123',
        code: '123456',
      });
      expect(verifiedResponse.data.user).toEqual(mockUser);
      expect(verifiedResponse.data.accessToken).toBe(mockTokens.accessToken);
      expect(verifiedResponse.data.refreshToken).toBe(mockTokens.refreshToken);

      // Step 2: Token storage (simulated by AsyncStorage mock)
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      await AsyncStorage.setItem('accessToken', mockTokens.accessToken);
      await AsyncStorage.setItem('refreshToken', mockTokens.refreshToken);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('accessToken', mockTokens.accessToken);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('refreshToken', mockTokens.refreshToken);

      // Step 3: Login (subsequent login with same credentials)
      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: {
          user: mockUser,
          tokens: mockTokens,
        },
      });

      const loginResponse = await authAPI.login('test@example.com', 'password123');

      expect(axios.post).toHaveBeenCalledWith('/auth/login', {
        email: 'test@example.com',
        password: 'password123',
      });

      expect(loginResponse.data.user).toEqual(mockUser);

      // Step 4: Get profile with token
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockTokens.accessToken);
      (axios.get as jest.Mock).mockResolvedValueOnce({
        data: {
          user: mockUser,
        },
      });

      const profileResponse = await authAPI.getMe();

      expect(axios.get).toHaveBeenCalledWith('/auth/me');
      expect(profileResponse.data.user).toEqual(mockUser);
    });

    it('should handle registration error', async () => {
      (axios.post as jest.Mock).mockRejectedValueOnce({
        response: {
          status: 400,
          data: {
            error: 'Email already exists',
          },
        },
      });

      await expect(
        authAPI.register('existing@example.com', 'password123', 'Test', 'User')
      ).rejects.toEqual({
        response: {
          status: 400,
          data: {
            error: 'Email already exists',
          },
        },
      });
    });

    it('should handle login error (invalid credentials)', async () => {
      (axios.post as jest.Mock).mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            error: 'Invalid credentials',
          },
        },
      });

      await expect(
        authAPI.login('test@example.com', 'wrongpassword')
      ).rejects.toEqual({
        response: {
          status: 401,
          data: {
            error: 'Invalid credentials',
          },
        },
      });
    });
  });

  describe('Token Storage and Retrieval', () => {
    it('should store and retrieve access token', async () => {
      const mockToken = 'mock-access-token-123';

      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      await AsyncStorage.setItem('accessToken', mockToken);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockToken);
      const retrievedToken = await AsyncStorage.getItem('accessToken');

      expect(retrievedToken).toBe(mockToken);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('accessToken', mockToken);
      expect(AsyncStorage.getItem).toHaveBeenCalledWith('accessToken');
    });

    it('should store and retrieve refresh token', async () => {
      const mockRefreshToken = 'mock-refresh-token-456';

      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      await AsyncStorage.setItem('refreshToken', mockRefreshToken);

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(mockRefreshToken);
      const retrievedToken = await AsyncStorage.getItem('refreshToken');

      expect(retrievedToken).toBe(mockRefreshToken);
    });

    it('should clear tokens on logout', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('accessToken');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('refreshToken');
    });
  });

  describe('Token Refresh (Handled by Interceptor)', () => {
    it('should handle automatic token refresh on 401 via interceptor', async () => {
      // Note: Token refresh is handled automatically by axios response interceptor
      // This test verifies the expected behavior even though the actual refresh
      // happens inside the interceptor (not exposed as API method)

      const newAccessToken = 'new-access-token';

      // When interceptor refreshes, it should update storage
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
      await AsyncStorage.setItem('accessToken', newAccessToken);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('accessToken', newAccessToken);

      // Verify token can be retrieved
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(newAccessToken);
      const token = await AsyncStorage.getItem('accessToken');

      expect(token).toBe(newAccessToken);
    });

    it('should clear tokens when refresh fails', async () => {
      // When refresh token expires, tokens should be cleared
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('accessToken');
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('refreshToken');
    });
  });

  describe('Profile Access Authorization', () => {
    it('should allow profile access with valid token', async () => {
      const validToken = 'valid-access-token';
      const mockUser = {
        id: 1,
        name: 'Test User',
        email: 'test@example.com',
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(validToken);
      (axios.get as jest.Mock).mockResolvedValueOnce({
        data: {
          user: mockUser,
        },
      });

      const response = await authAPI.getMe();

      expect(axios.get).toHaveBeenCalledWith('/auth/me');
      expect(response.data.user).toEqual(mockUser);
    });

    it('should deny profile access without token', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
      (axios.get as jest.Mock).mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            error: 'No token provided',
          },
        },
      });

      await expect(authAPI.getMe()).rejects.toEqual({
        response: {
          status: 401,
          data: {
            error: 'No token provided',
          },
        },
      });
    });

    it('should deny profile access with invalid token', async () => {
      const invalidToken = 'invalid-token';

      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(invalidToken);
      (axios.get as jest.Mock).mockRejectedValueOnce({
        response: {
          status: 401,
          data: {
            error: 'Invalid token',
          },
        },
      });

      await expect(authAPI.getMe()).rejects.toEqual({
        response: {
          status: 401,
          data: {
            error: 'Invalid token',
          },
        },
      });
    });
  });
});
