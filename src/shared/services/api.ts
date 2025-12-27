import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';

/**
 * API Configuration
 *
 * Priority order:
 * 1. EXPO_PUBLIC_API_URL environment variable (if set)
 * 2. Development mode: Auto-detect IP from Expo DevServer
 * 3. Production: Use deployed backend URL
 *
 * Environment variables:
 * - EXPO_PUBLIC_API_URL: Override API URL (e.g., "http://192.168.1.100:3001/api")
 */

// Production backend URL
const PRODUCTION_API_URL = 'https://rehearsal-calendar-app.onrender.com/api';

// Auto-detect local IP from Expo DevServer (for development on physical devices)
const getLocalDevIP = (): string | null => {
  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    (Constants.manifest as any)?.debuggerHost ||
    (Constants.manifest2 as any)?.extra?.expoGo?.debuggerHost;

  if (debuggerHost) {
    // debuggerHost format is "192.168.1.38:8081", extract IP
    const ip = debuggerHost.split(':')[0];
    return ip;
  }

  // No Expo debugger host detected - using localhost
  return null;
};

// Determine API URL based on environment
const getApiUrl = (): string => {
  // Priority 1: Explicit environment variable
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envApiUrl) {
    logger.info(`Using EXPO_PUBLIC_API_URL: ${envApiUrl}`);
    return envApiUrl;
  }

  // Priority 2: Development mode with auto-detection
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const localIP = getLocalDevIP();
    if (localIP) {
      const devUrl = `http://${localIP}:3001/api`;
      logger.info(`Development mode - using: ${devUrl}`);
      return devUrl;
    }

    // Fallback: use platform-specific localhost
    // Android emulator needs 10.0.2.2 to reach host machine
    const localhostUrl = Platform.OS === 'android'
      ? 'http://10.0.2.2:3001/api'
      : 'http://localhost:3001/api';

    logger.info(`Development mode - using: ${localhostUrl}`);
    return localhostUrl;
  }

  // Priority 3: Production
  return PRODUCTION_API_URL;
};

const API_URL = getApiUrl();

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor - add access token to requests
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    logger.debug(`Request: ${config.method?.toUpperCase()} ${config.url}`, config.params);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (refreshToken) {
          // Try to refresh the token
          const response = await axios.post(`${API_URL}/auth/refresh`, {
            refreshToken,
          });

          const { accessToken, refreshToken: newRefreshToken } = response.data;

          // Save new tokens
          await AsyncStorage.multiSet([
            ['accessToken', accessToken],
            ['refreshToken', newRefreshToken],
          ]);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout user
        await AsyncStorage.multiRemove(['accessToken', 'refreshToken']);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (email: string, password: string, firstName: string, lastName?: string) =>
    api.post('/auth/register', { email, password, firstName, lastName }),

  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  loginWithTelegram: (telegramData: any) =>
    api.post('/auth/telegram', telegramData),

  getMe: () => api.get('/auth/me'),

  updateMe: (data: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    password?: string;
    timezone?: string;
    locale?: string;
    notificationsEnabled?: boolean;
    emailNotifications?: boolean;
  }) => api.put('/auth/me', data),

  deleteMe: () => api.delete('/auth/me'),
};

// Projects API (Native App)
export const projectsAPI = {
  // Get all projects for authenticated user
  getUserProjects: () =>
    api.get('/native/projects'),

  // Get single project
  getProject: (projectId: string) =>
    api.get(`/native/projects/${projectId}`),

  // Get project members
  getMembers: (projectId: string) =>
    api.get(`/native/projects/${projectId}/members`),

  // Get members availability for a specific date
  getMembersAvailability: (projectId: string, date: string, userIds?: string[]) =>
    api.get(`/native/projects/${projectId}/members/availability`, {
      params: {
        date,
        userIds: userIds?.join(','),
      },
    }),

  // Get members availability for a date range (for Smart Planner)
  getMembersAvailabilityRange: (projectId: string, startDate: string, endDate: string, userIds?: string[]) =>
    api.get(`/native/projects/${projectId}/members/availability`, {
      params: {
        startDate,
        endDate,
        userIds: userIds?.join(','),
      },
    }),

  // Create new project
  createProject: (data: { name: string; description?: string; timezone?: string }) =>
    api.post('/native/projects', data),
};

// Rehearsals API (Native App)
export const rehearsalsAPI = {
  // Get rehearsals for project
  getAll: (projectId: string) =>
    api.get(`/native/projects/${projectId}/rehearsals`),

  // Get rehearsals for multiple projects (batch - performance optimization)
  getBatch: (projectIds: string[]) =>
    api.get('/native/rehearsals/batch', {
      params: {
        projectIds: projectIds.join(','),
      },
    }),

  // Create rehearsal
  create: (projectId: string, data: any) =>
    api.post(`/native/projects/${projectId}/rehearsals`, data),

  // Update rehearsal
  update: (projectId: string, rehearsalId: string, data: any) =>
    api.put(`/native/projects/${projectId}/rehearsals/${rehearsalId}`, data),

  // Delete rehearsal
  delete: (projectId: string, rehearsalId: string) =>
    api.delete(`/native/projects/${projectId}/rehearsals/${rehearsalId}`),

  // RSVP - Submit response ('yes' = like, null = unlike/delete)
  respond: (rehearsalId: string, status: 'yes' | null, notes?: string) =>
    api.post(`/native/rehearsals/${rehearsalId}/respond`, { response: status, notes }),

  // RSVP - Get my response
  getMyResponse: (rehearsalId: string) =>
    api.get(`/native/rehearsals/${rehearsalId}/my-response`),

  // RSVP - Get all responses (for admin)
  getResponses: (rehearsalId: string) =>
    api.get(`/native/rehearsals/${rehearsalId}/responses`),
};

// Invites API (Native App)
export const invitesAPI = {
  // Create invite link for project
  createInvite: (projectId: string, expiresInDays?: number) =>
    api.post(`/native/projects/${projectId}/invite`, { expiresInDays }),

  // Get current invite link for project
  getInvite: (projectId: string) =>
    api.get(`/native/projects/${projectId}/invite`),

  // Revoke invite link
  revokeInvite: (projectId: string) =>
    api.delete(`/native/projects/${projectId}/invite`),

  // Get invite info by code (public)
  getInviteInfo: (code: string) =>
    api.get(`/native/invite/${code}`),

  // Join project using invite code
  joinProject: (code: string) =>
    api.post(`/native/invite/${code}/join`),
};

// Availability API (Native App)
export const availabilityAPI = {
  // Get all availability for current user
  getAll: () =>
    api.get('/native/availability'),

  // Bulk set availability for multiple dates (ISO timestamp format)
  bulkSet: (entries: { startsAt: string; endsAt: string; type: 'available' | 'busy' | 'tentative'; isAllDay?: boolean }[]) =>
    api.post('/native/availability/bulk', { entries }),

  // Delete availability for a specific date
  delete: (date: string) =>
    api.delete(`/native/availability/${date}`),

  // Delete all imported calendar events
  deleteAllImported: () =>
    api.delete('/native/availability/imported/all'),

  // Batch delete imported events by external_event_id
  batchDeleteImported: (eventIds: string[]) =>
    api.delete('/native/availability/imported/batch', { data: { eventIds } }),

  // Batch update imported events
  batchUpdateImported: (updates: Array<{
    externalEventId: string;
    startsAt: string;
    endsAt: string;
    title?: string;
    isAllDay?: boolean;
  }>) =>
    api.put('/native/availability/imported/batch', { updates }),
};

// Calendar Sync API (Native App)
export const calendarSyncAPI = {
  // Calendar Connections
  getConnections: () =>
    api.get('/native/calendar-sync/connections'),

  createOrUpdateConnection: (data: {
    provider: 'apple' | 'google';
    deviceCalendarId: string;
    deviceCalendarName?: string;
    syncEnabled?: boolean;
    syncDirection?: 'both' | 'export' | 'import';
  }) =>
    api.post('/native/calendar-sync/connections', data),

  deleteConnection: (connectionId: number) =>
    api.delete(`/native/calendar-sync/connections/${connectionId}`),

  updateSyncTime: (connectionId: number) =>
    api.post(`/native/calendar-sync/connections/${connectionId}/update-sync-time`),

  // Event Mappings
  getMappings: (eventType?: 'rehearsal' | 'availability') =>
    api.get('/native/calendar-sync/mappings', {
      params: eventType ? { eventType } : {},
    }),

  getMappingByEvent: (eventType: 'rehearsal' | 'availability', internalEventId: string) =>
    api.get(`/native/calendar-sync/mappings/by-event/${eventType}/${internalEventId}`),

  createOrUpdateMapping: (data: {
    connectionId: number;
    eventType: 'rehearsal' | 'availability';
    internalEventId: string;
    externalEventId: string;
    syncDirection?: 'export' | 'import';
  }) =>
    api.post('/native/calendar-sync/mappings', data),

  deleteMapping: (mappingId: number) =>
    api.delete(`/native/calendar-sync/mappings/${mappingId}`),

  deleteMappingByEvent: (eventType: 'rehearsal' | 'availability', internalEventId: string) =>
    api.delete(`/native/calendar-sync/mappings/by-event/${eventType}/${internalEventId}`),
};

export default api;
