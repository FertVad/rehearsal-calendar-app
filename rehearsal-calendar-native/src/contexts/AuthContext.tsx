import React, { createContext, useState, useContext, useEffect, useCallback, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../shared/services/api';
import { logger } from '../shared/utils/logger';
import { syncUserPreferences } from '../shared/utils/storage';
import { unregisterPushToken } from '../shared/services/notifications';

function getDeviceTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

interface User {
  id: number;
  email?: string;
  firstName: string;
  lastName?: string;
  phone?: string;
  telegramId?: number;
  avatarUrl?: string;
  timezone?: string;
  locale?: string;
  weekStartDay?: 'monday' | 'sunday';
  notificationsEnabled?: boolean;
  emailNotifications?: boolean;
  onboardingCompleted?: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName?: string) => Promise<void>;
  loginWithTelegram: (telegramData: any) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<{ linked: boolean }>;
  loginWithApple: (idToken: string, user?: any) => Promise<{ linked: boolean }>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  deleteAccount: () => Promise<{ deletedProjects: number }>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const hasTimezoneSynced = useRef(false);

  const loadUser = useCallback(async () => {
    try {
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (!accessToken) {
        // No token - user needs to login
        setLoading(false);
        return;
      }

      // Verify token and get user
      const response = await authAPI.getMe();
      const user = response.data.user;

      if (!user) {
        throw new Error('User data not found in response');
      }

      setUser(user);
      // Cache user data for offline use
      await AsyncStorage.setItem('cachedUser', JSON.stringify(user));
      // Sync user preferences (timezone, locale, weekStartDay)
      await syncUserPreferences(user);
      setLoading(false);
    } catch (err: any) {
      // Only clear tokens if they are actually invalid (401/403)
      // Don't clear on network errors, timeouts, etc.
      if (err.response?.status === 401 || err.response?.status === 403) {
        logger.info('Invalid or expired token, clearing session');
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
        setUser(null);
        setLoading(false);
      } else {
        // Network error, server restart, etc. - keep user logged in offline
        logger.warn('Failed to load user (non-auth error):', err.message);
        // Try to load cached user data from storage
        try {
          const cachedUser = await AsyncStorage.getItem('cachedUser');
          if (cachedUser) {
            setUser(JSON.parse(cachedUser));
          }
        } catch {
          // No cached user - will show login screen
        }
        setLoading(false);
      }
    }
  }, []);

  // Load user from storage on mount
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Auto-sync device timezone on login/restore
  useEffect(() => {
    if (!user) {
      hasTimezoneSynced.current = false;
      return;
    }
    if (hasTimezoneSynced.current) return;

    hasTimezoneSynced.current = true;

    const deviceTimezone = getDeviceTimezone();
    if (!deviceTimezone || user.timezone === deviceTimezone) return;

    // Silently sync timezone in background
    authAPI.updateMe({ timezone: deviceTimezone })
      .then(response => {
        const updatedUser = response.data.user;
        setUser(updatedUser);
        AsyncStorage.setItem('cachedUser', JSON.stringify(updatedUser));
        syncUserPreferences(updatedUser);
        logger.info(`[Auth] Auto-synced timezone: ${user.timezone || 'none'} → ${deviceTimezone}`);
      })
      .catch(err => {
        logger.warn('[Auth] Failed to auto-sync timezone:', err?.message);
      });
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      setError(null);
      setLoading(true);

      const response = await authAPI.login(email, password);
      const { user, accessToken, refreshToken } = response.data;

      // Save tokens, cache user, and clear any stale logout timestamp
      await AsyncStorage.multiSet([
        ['accessToken', accessToken],
        ['refreshToken', refreshToken],
        ['cachedUser', JSON.stringify(user)],
      ]);
      await AsyncStorage.removeItem('lastLogoutTime');
      // Sync user preferences (timezone, locale, weekStartDay)
      await syncUserPreferences(user);

      setUser(user);
    } catch (err: any) {
      const message = err.response?.data?.error || 'Login failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (email: string, password: string, firstName: string, lastName?: string) => {
    try {
      setError(null);
      setLoading(true);

      const deviceTimezone = getDeviceTimezone();
      const response = await authAPI.register(email, password, firstName, lastName, deviceTimezone);
      const { user, accessToken, refreshToken } = response.data;

      // Save tokens, cache user, and clear any stale logout timestamp
      await AsyncStorage.multiSet([
        ['accessToken', accessToken],
        ['refreshToken', refreshToken],
        ['cachedUser', JSON.stringify(user)],
      ]);
      await AsyncStorage.removeItem('lastLogoutTime');
      // Sync user preferences (timezone, locale, weekStartDay)
      await syncUserPreferences(user);

      setUser(user);
    } catch (err: any) {
      const message = err.response?.data?.error || 'Registration failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithTelegram = useCallback(async (telegramData: any) => {
    try {
      setError(null);
      setLoading(true);

      const response = await authAPI.loginWithTelegram(telegramData);
      const { user, accessToken, refreshToken } = response.data;

      // Save tokens, cache user, and clear any stale logout timestamp
      await AsyncStorage.multiSet([
        ['accessToken', accessToken],
        ['refreshToken', refreshToken],
        ['cachedUser', JSON.stringify(user)],
      ]);
      await AsyncStorage.removeItem('lastLogoutTime');

      setUser(user);
    } catch (err: any) {
      const message = err.response?.data?.error || 'Telegram login failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    try {
      setError(null);
      setLoading(true);

      const response = await authAPI.loginWithGoogle(idToken);
      const { user, accessToken, refreshToken, linked } = response.data;

      // Save tokens, cache user, and clear any stale logout timestamp
      await AsyncStorage.multiSet([
        ['accessToken', accessToken],
        ['refreshToken', refreshToken],
        ['cachedUser', JSON.stringify(user)],
      ]);
      await AsyncStorage.removeItem('lastLogoutTime');
      // Sync user preferences (timezone, locale, weekStartDay)
      await syncUserPreferences(user);

      setUser(user);

      return { linked: linked || false };
    } catch (err: any) {
      console.error('[Auth] Google login error:', err);
      console.error('[Auth] Error response:', err.response?.data);
      console.error('[Auth] Error status:', err.response?.status);
      const message = err.response?.data?.error || 'Google sign-in failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loginWithApple = useCallback(async (idToken: string, user?: any) => {
    try {
      setError(null);
      setLoading(true);

      const response = await authAPI.loginWithApple(idToken, user);
      const { user: userData, accessToken, refreshToken, linked } = response.data;

      // Save tokens, cache user, and clear any stale logout timestamp
      await AsyncStorage.multiSet([
        ['accessToken', accessToken],
        ['refreshToken', refreshToken],
        ['cachedUser', JSON.stringify(userData)],
      ]);
      await AsyncStorage.removeItem('lastLogoutTime');
      // Sync user preferences (timezone, locale, weekStartDay)
      await syncUserPreferences(userData);

      setUser(userData);

      return { linked: linked || false };
    } catch (err: any) {
      const message = err.response?.data?.error || 'Apple sign-in failed';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setLoading(true);

      // Unregister push notifications
      await unregisterPushToken();

      // Set flag to ignore stale deep links
      await AsyncStorage.setItem('lastLogoutTime', Date.now().toString());

      // Clear ALL AsyncStorage data to prevent cache leaking to new users
      await AsyncStorage.clear();

      // Restore the lastLogoutTime flag after clearing everything
      await AsyncStorage.setItem('lastLogoutTime', Date.now().toString());

      setUser(null);
    } catch (err) {
      logger.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateUser = useCallback(async (data: Partial<User>) => {
    try {
      setError(null);
      const response = await authAPI.updateMe(data);
      const updatedUser = response.data.user;
      setUser(updatedUser);
      // Update cached user data
      await AsyncStorage.setItem('cachedUser', JSON.stringify(updatedUser));
      // Sync user preferences (timezone, locale, weekStartDay)
      await syncUserPreferences(updatedUser);
    } catch (err: any) {
      const message = err.response?.data?.error || 'Update failed';
      setError(message);
      throw new Error(message);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);

      // Call delete account API
      const response = await authAPI.deleteMe();
      const { deletedProjects } = response.data;

      // Set flag to ignore stale deep links
      await AsyncStorage.setItem('lastLogoutTime', Date.now().toString());

      // Clear ALL AsyncStorage data
      await AsyncStorage.clear();

      // Restore the lastLogoutTime flag
      await AsyncStorage.setItem('lastLogoutTime', Date.now().toString());

      setUser(null);

      return { deletedProjects: deletedProjects || 0 };
    } catch (err: any) {
      const message = err.response?.data?.error || 'Failed to delete account';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        loginWithTelegram,
        loginWithGoogle,
        loginWithApple,
        logout,
        updateUser,
        deleteAccount,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
