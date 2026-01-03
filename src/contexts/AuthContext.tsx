import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../shared/services/api';
import { logger } from '../shared/utils/logger';

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
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, firstName: string, lastName?: string) => Promise<void>;
  loginWithTelegram: (telegramData: any) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      // Sync language preference from database
      if (user.locale) {
        await AsyncStorage.setItem('userLanguage', user.locale);
      }
      // Sync week start preference from database
      if (user.weekStartDay) {
        await AsyncStorage.setItem('weekStartDay', user.weekStartDay);
      }
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
      // Sync language preference from database
      if (user.locale) {
        await AsyncStorage.setItem('userLanguage', user.locale);
      }
      // Sync week start preference from database
      if (user.weekStartDay) {
        await AsyncStorage.setItem('weekStartDay', user.weekStartDay);
      }

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

      const response = await authAPI.register(email, password, firstName, lastName);
      const { user, accessToken, refreshToken } = response.data;

      // Save tokens, cache user, and clear any stale logout timestamp
      await AsyncStorage.multiSet([
        ['accessToken', accessToken],
        ['refreshToken', refreshToken],
        ['cachedUser', JSON.stringify(user)],
      ]);
      await AsyncStorage.removeItem('lastLogoutTime');
      // Sync language preference from database
      if (user.locale) {
        await AsyncStorage.setItem('userLanguage', user.locale);
      }
      // Sync week start preference from database
      if (user.weekStartDay) {
        await AsyncStorage.setItem('weekStartDay', user.weekStartDay);
      }

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

  const logout = useCallback(async () => {
    try {
      setLoading(true);

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
      // Sync language preference if locale was updated
      if (data.locale) {
        await AsyncStorage.setItem('userLanguage', data.locale);
      }
      // Sync week start preference if weekStartDay was updated
      if (data.weekStartDay) {
        await AsyncStorage.setItem('weekStartDay', data.weekStartDay);
      }
      // Update cached user data
      await AsyncStorage.setItem('cachedUser', JSON.stringify(updatedUser));
    } catch (err: any) {
      const message = err.response?.data?.error || 'Update failed';
      setError(message);
      throw new Error(message);
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
        logout,
        updateUser,
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
