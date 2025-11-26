import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your backend URL
// For iOS simulator: http://localhost:3001
// For Android emulator: http://10.0.2.2:3001
// For real device: http://YOUR_COMPUTER_IP:3001
const API_URL = __DEV__
  ? 'http://192.168.1.38:3001/api'  // Use IP address for real device support
  : 'https://rehearsal-calendar-app.onrender.com/api';

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

  // Create new project
  createProject: (data: { name: string; description?: string; timezone?: string }) =>
    api.post('/native/projects', data),
};

// Rehearsals API (Native App)
export const rehearsalsAPI = {
  // Get rehearsals for project
  getAll: (projectId: string) =>
    api.get(`/native/projects/${projectId}/rehearsals`),

  // Create rehearsal
  create: (projectId: string, data: any) =>
    api.post(`/native/projects/${projectId}/rehearsals`, data),

  // Update rehearsal
  update: (projectId: string, rehearsalId: string, data: any) =>
    api.put(`/native/projects/${projectId}/rehearsals/${rehearsalId}`, data),

  // Delete rehearsal
  delete: (projectId: string, rehearsalId: string) =>
    api.delete(`/native/projects/${projectId}/rehearsals/${rehearsalId}`),

  // RSVP - Submit response
  respond: (rehearsalId: string, status: 'confirmed' | 'declined' | 'tentative', notes?: string) =>
    api.post(`/native/rehearsals/${rehearsalId}/respond`, { status, notes }),

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
    api.get('/availability'),

  // Set availability for a specific date
  setForDate: (date: string, type: 'available' | 'busy' | 'tentative', slots?: { start: string; end: string }[]) =>
    api.put(`/availability/${date}`, { type, slots }),

  // Bulk set availability for multiple dates
  bulkSet: (entries: { date: string; type: 'available' | 'busy' | 'tentative'; slots?: { start: string; end: string }[] }[]) =>
    api.post('/availability/bulk', { entries }),

  // Delete availability for a specific date
  delete: (date: string) =>
    api.delete(`/availability/${date}`),
};

export default api;
