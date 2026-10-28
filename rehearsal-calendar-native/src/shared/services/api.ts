import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { logger } from '../utils/logger';
import { currentSession, isCurrentSession, reportSessionExpired, SessionEndedError, SessionStamp } from './session';

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

// Production backend URL — set EXPO_PUBLIC_API_URL in .env to override.
// The fallback must stay on rehearsly.me: invite links, the AASA file and the
// app all have to share one origin for Universal Links to resolve, and the
// project's vercel.app address changes if the project is ever renamed.
const PRODUCTION_API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://rehearsly.me/api';

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

const REQUEST_TIMEOUT_MS = 10000;
// A request that sends email answers only after the provider does: the server
// sends each email inside the request, one after another, giving each up to
// SEND_TIMEOUT_MS in server/services/email/transport.js. A client that gives
// up sooner drops the answer while the codes are already issued — the person
// is told it failed and gets no fields for the codes in their mailbox (review
// of T-130). Such a request waits for every email it sends, and then as long
// as any other request.
const EMAIL_SEND_TIMEOUT_MS = 8000;
const sendsEmails = (count: number) => ({ timeout: REQUEST_TIMEOUT_MS + count * EMAIL_SEND_TIMEOUT_MS });

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: REQUEST_TIMEOUT_MS,
});

// Request interceptor - add access token to requests. A request carries the
// session it was sent in (shared/services/session.ts): its 401 is refreshed and
// retried only while that session lasts, never under the next person's pair.
// Work of a session (the calendar sync) names its own with `session`: such a
// request goes out with that session's token or not at all (ES01). The check
// follows the read, and a change of owner ends the session before it writes
// the next person's pair, so a token read while the session lasts is its own.
const inSession = (session?: SessionStamp) =>
  session === undefined ? undefined : ({ session } as Record<string, unknown>);

api.interceptors.request.use(
  async (config) => {
    const session = (config as any).session ?? currentSession();
    (config as any).session = session;
    const token = await AsyncStorage.getItem('accessToken');
    if (!isCurrentSession(session)) throw new SessionEndedError();
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

// The server's answers to a refresh that end the session: the refresh token
// itself is missing, invalid, revoked or its account cannot sign in.
const refusesSession = (status?: number) => status === 400 || status === 401 || status === 403;

/**
 * A new pair for the session, one refresh at a time. The server rotates the
 * pair, so two 401s refreshing at once spent the same refresh token twice.
 *
 * Only the server's refusal ends the session (AC02): it is reported, and the
 * AuthContext signs the person out and opens the sign-in screen. No network, a
 * timeout or a server error says nothing about the session — the tokens stay,
 * and the request fails with that error, which the caller treats as offline
 * (AC01). An answer for a session that has meanwhile ended writes nothing.
 */
let refreshing: Promise<string> | null = null;

async function refreshSession(): Promise<string> {
  const session = currentSession();
  const refreshToken = await AsyncStorage.getItem('refreshToken');
  if (!refreshToken) {
    if (isCurrentSession(session)) reportSessionExpired();
    throw new Error('No refresh token');
  }
  let response;
  try {
    response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken }, { timeout: REQUEST_TIMEOUT_MS });
  } catch (error: any) {
    if (refusesSession(error?.response?.status) && isCurrentSession(session)) reportSessionExpired();
    throw error;
  }
  if (!isCurrentSession(session)) throw new SessionEndedError();
  const { accessToken, refreshToken: newRefreshToken } = response.data;
  await AsyncStorage.multiSet([
    ['accessToken', accessToken],
    ['refreshToken', newRefreshToken],
  ]);
  return accessToken;
}

function refreshOnce(): Promise<string> {
  if (!refreshing) {
    refreshing = refreshSession().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => {
    logger.debug(`Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;
    const url = originalRequest?.url || '';
    logger.error(`Response Error: ${status || 'Network Error'} ${originalRequest?.method?.toUpperCase()} ${url}`, error.response?.data);

    // Only a request sent with a session has one to refresh: a refused
    // password at sign-in is a 401 too.
    const sentWith = originalRequest?.headers?.Authorization;
    if (status === 401 && sentWith && !originalRequest._retry) {
      originalRequest._retry = true;
      if (!isCurrentSession(originalRequest.session)) return Promise.reject(new SessionEndedError());

      // Refreshed by another request since this one went out: its pair is the
      // one to use.
      const stored = await AsyncStorage.getItem('accessToken');
      const accessToken = stored && `Bearer ${stored}` !== sentWith ? stored : await refreshOnce();
      if (!isCurrentSession(originalRequest.session)) return Promise.reject(new SessionEndedError());

      originalRequest.headers.Authorization = `Bearer ${accessToken}`;
      return api(originalRequest);
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  // The account starts unconfirmed: the server emails a code and issues no
  // session until verifyEmail (R3). `verification: 'code'` tells the server
  // this app can enter one; `locale` picks the language of that email.
  register: (email: string, password: string, firstName: string, lastName?: string, timezone?: string, locale?: string) =>
    api.post('/auth/register', { email, password, firstName, lastName, timezone, locale, verification: 'code' }, sendsEmails(1)),

  verifyEmail: (email: string, password: string, code: string) =>
    api.post('/auth/verify-email', { email, password, code }),

  resendVerification: (email: string, password: string) =>
    api.post('/auth/verify-email/resend', { email, password }, sendsEmails(1)),

  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),

  // A forgotten password, with a code emailed to the address (R3). The request
  // answers alike with and without an account; the confirmation answers with
  // a session.
  requestPasswordReset: (email: string) =>
    api.post('/auth/password-reset/request', { email }, sendsEmails(1)),

  confirmPasswordReset: (email: string, code: string, newPassword: string) =>
    api.post('/auth/password-reset/confirm', { email, code, newPassword }),

  // A new sign-in address: a code to it and one to the current address, and
  // the password when the account has one (R3: HP01). The confirmation revokes
  // every session and answers with the pair that works now, after a notice to
  // the old address.
  requestEmailChange: (newEmail: string, currentPassword?: string) =>
    api.post('/auth/me/email/change', { newEmail, currentPassword }, sendsEmails(2)),

  confirmEmailChange: (code: string, currentCode: string) =>
    api.post('/auth/me/email/change/confirm', { code, currentCode }, sendsEmails(1)),

  getMe: () => api.get('/auth/me'),

  // No email: the server refuses a new one here (requestEmailChange instead).
  // An empty lastName clears it; undefined leaves it.
  updateMe: (data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    password?: string;
    timezone?: string;
    locale?: string;
    weekStartDay?: 'monday' | 'sunday';
    notificationsEnabled?: boolean;
    emailNotifications?: boolean;
    onboardingCompleted?: boolean;
  }) => api.put('/auth/me', data),

  deleteMe: () => api.delete('/auth/me'),

  logout: () => api.post('/auth/logout'),

  // OAuth Authentication
  loginWithGoogle: (idToken: string) =>
    api.post('/auth/google', { idToken }),

  loginWithApple: (idToken: string, user?: any) =>
    api.post('/auth/apple', { idToken, user }),

  // Auth Provider Management
  getAuthProviders: () =>
    api.get('/auth/me/providers'),

  unlinkAuthProvider: (provider: 'google' | 'apple' | 'email') =>
    api.delete(`/auth/me/providers/${provider}`),

  // Push Notification Tokens
  //
  // Given longer than the 10s default because it runs unattended on app start,
  // which is exactly when the serverless function is most likely to be cold. A
  // timeout here costs the user their notifications until the next launch, and
  // nobody is waiting on the response, so patience is free.
  registerPushToken: (token: string, deviceType: string, deviceName: string) =>
    api.post(
      '/native/push-tokens',
      { deviceToken: token, deviceType, deviceName },
      { timeout: 30000 }
    ),

  unregisterPushToken: (token: string) =>
    api.delete('/native/push-tokens', { data: { deviceToken: token } }),
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
  getMembersAvailability: (projectId: string, date: string, userIds?: string[], excludeRehearsalId?: string) =>
    api.get(`/native/projects/${projectId}/members/availability`, {
      params: {
        date,
        userIds: userIds?.join(','),
        excludeRehearsalId,
      },
    }),

  // Get members availability for a date range (for Smart Planner)
  getMembersAvailabilityRange: (projectId: string, startDate: string, endDate: string, userIds?: string[], excludeRehearsalId?: string) =>
    api.get(`/native/projects/${projectId}/members/availability`, {
      params: {
        startDate,
        endDate,
        userIds: userIds?.join(','),
        excludeRehearsalId,
      },
    }),

  // Create new project. A repeat with the same key gets the same project
  // (useIdempotencyKey).
  createProject: (data: { name: string; description?: string; timezone?: string }, idempotencyKey: string) =>
    api.post('/native/projects', data, { headers: { 'Idempotency-Key': idempotencyKey } }),

  // Delete project
  deleteProject: (projectId: string) =>
    api.delete(`/native/projects/${projectId}`),

  // Remove member from project
  removeMember: (projectId: string, userId: string) =>
    api.delete(`/native/projects/${projectId}/members/${userId}`),

  // Update member role (admin/member)
  updateMemberRole: (projectId: string, userId: string, role: 'admin' | 'member') =>
    api.put(`/native/projects/${projectId}/members/${userId}/role`, { role }),
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

  // Create rehearsal. A repeat with the same key gets the same rehearsal
  // (useIdempotencyKey).
  create: (projectId: string, data: any, idempotencyKey: string) =>
    api.post(`/native/projects/${projectId}/rehearsals`, data, { headers: { 'Idempotency-Key': idempotencyKey } }),

  // Update rehearsal
  update: (projectId: string, rehearsalId: string, data: any) =>
    api.put(`/native/projects/${projectId}/rehearsals/${rehearsalId}`, data),

  // Delete rehearsal
  delete: (projectId: string, rehearsalId: string) =>
    api.delete(`/native/projects/${projectId}/rehearsals/${rehearsalId}`),

  // Get RSVP responses for rehearsal
  // One rehearsal, for the details screen — which is reached by id and so
  // cannot rely on the caller already holding the object.
  getById: (rehearsalId: string) =>
    api.get(`/native/rehearsals/${rehearsalId}`),

  getResponses: (rehearsalId: string) =>
    api.get(`/native/rehearsals/${rehearsalId}/responses`),

  // RSVP - Submit response ('yes' = accepted, 'no' = declined)
  respond: (rehearsalId: string, status: 'yes' | 'no', notes?: string) =>
    api.post(`/native/rehearsals/${rehearsalId}/respond`, { response: status, notes }),

  // RSVP - Get my response
  getMyResponse: (rehearsalId: string) =>
    api.get(`/native/rehearsals/${rehearsalId}/my-response`),
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

  // The editor's save: each named day is replaced by exactly its entries, []
  // clearing it; days not named are left alone (R6: CC05).
  saveDays: (days: { date: string; entries: { startsAt: string; endsAt: string; type: 'available' | 'busy'; isAllDay: boolean }[] }[]) =>
    api.put('/native/availability/days', { days }),

  // Imported calendar events (and older app versions' saves). Replaces the
  // hand-entered rows of every date its manual entries name.
  bulkSet: (entries: { startsAt: string; endsAt: string; type: 'available' | 'busy' | 'tentative'; isAllDay?: boolean }[]) =>
    api.post('/native/availability/bulk', { entries }),

  // Delete availability for a specific date
  delete: (date: string) =>
    api.delete(`/native/availability/${date}`),

  // Delete all imported calendar events
  deleteAllImported: (session?: SessionStamp) =>
    api.delete('/native/availability/imported/all', inSession(session)),

  // One device's calendar import, reconciled on the server within the
  // calendars this device names (server/services/availability/importScope.js).
  syncImported: (sync: {
    source: 'apple_calendar' | 'google_calendar';
    window: { from: string; to: string; firstDate: string; lastDate: string };
    deviceCalendars: string[];
    unreadable: string[];
    calendars: { calendarId: string; events: { key: string; startsAt: string; endsAt: string; isAllDay: boolean }[] }[];
  }, session?: SessionStamp) => api.post('/native/availability/imported/sync', sync, inSession(session)),
};

// Calendar Sync API (Native App). The calendar sync is a session's work, and
// each call takes the session it belongs to (`inSession`, ES01).
export const calendarSyncAPI = {
  // Calendar Connections
  getConnections: (session?: SessionStamp) =>
    api.get('/native/calendar-sync/connections', inSession(session)),

  createOrUpdateConnection: (data: {
    provider: 'apple' | 'google';
    deviceCalendarId: string;
    deviceCalendarName?: string;
    syncEnabled?: boolean;
    syncDirection?: 'both' | 'export' | 'import';
  }, session?: SessionStamp) =>
    api.post('/native/calendar-sync/connections', data, inSession(session)),

  deleteConnection: (connectionId: number) =>
    api.delete(`/native/calendar-sync/connections/${connectionId}`),

  updateSyncTime: (connectionId: number) =>
    api.post(`/native/calendar-sync/connections/${connectionId}/update-sync-time`),

  // Event Mappings
  getMappings: (eventType?: 'rehearsal' | 'availability', session?: SessionStamp) =>
    api.get('/native/calendar-sync/mappings', {
      ...inSession(session),
      params: eventType ? { eventType } : {},
    }),


  createOrUpdateMapping: (data: {
    connectionId: number;
    eventType: 'rehearsal' | 'availability';
    internalEventId: string;
    externalEventId: string;
    syncDirection?: 'export' | 'import';
  }, session?: SessionStamp) =>
    api.post('/native/calendar-sync/mappings', data, inSession(session)),

  // Deletes name the calendars of this device: only mappings recorded under
  // them are its own (ES02).
  deleteMappingByEvent: (eventType: 'rehearsal' | 'availability', internalEventId: string, deviceCalendarIds: string[], session?: SessionStamp) =>
    api.delete(`/native/calendar-sync/mappings/by-event/${eventType}/${internalEventId}`, { ...inSession(session), data: { deviceCalendarIds } }),

  deleteMappings: (eventType: 'rehearsal' | 'availability', deviceCalendarIds: string[], session?: SessionStamp) =>
    api.delete('/native/calendar-sync/mappings', { ...inSession(session), data: { eventType, deviceCalendarIds } }),
};

// Notifications API (the inbox — what was sent, and what is still unread)
export const notificationsAPI = {
  // One page, newest first. `cursor` is the `nextCursor` of the page before;
  // the answer's own is null on the last page (cause fix 21: NI01).
  list: (cursor?: string | null) =>
    api.get('/native/notifications', { params: cursor ? { cursor } : {} }),

  unreadCount: () => api.get('/native/notifications/unread-count'),

  // Both answer with the count that remains, so the badge can be set without
  // asking again. A list marks only what it names, an empty one nothing; the
  // whole inbox is asked for by name (NI06).
  markRead: (ids: number[]) =>
    api.post('/native/notifications/read', { ids }),
  markAllRead: () =>
    api.post('/native/notifications/read', { all: true }),

  remove: (id: number) => api.delete(`/native/notifications/${id}`),

  removeAll: () => api.delete('/native/notifications'),
};

// Bug Reports API
export const bugReportsAPI = {
  create: (data: { message: string; screen?: string }) =>
    api.post('/native/bug-reports', data),
};

export default api;
