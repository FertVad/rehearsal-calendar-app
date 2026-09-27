import React, { createContext, useState, useContext, useEffect, useCallback, useRef, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../shared/services/api';
import { logger } from '../shared/utils/logger';
import { syncUserPreferences } from '../shared/utils/storage';
import { unregisterPushToken, syncPushTokenIfGranted } from '../shared/services/notifications';
import { resetConnectionCache } from '../shared/utils/calendarMappings';
import { AuthFlowError, toAuthFlowError, DeliveryOutcome } from '../features/auth/utils/authErrors';

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
  /** Restoring the session at start; the navigator waits on it. */
  loading: boolean;
  /** A sign-in form's request in flight. The screen stays mounted meanwhile. */
  busy: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Creates an unconfirmed account: no session until confirmEmail (R3). */
  /** null when the person left before the answer came: nothing to show. */
  register: (email: string, password: string, firstName: string, lastName?: string, locale?: string)
    => Promise<{ email: string; delivery: DeliveryOutcome } | null>;
  /** The address waiting for its code, for the confirmation screen. */
  pendingEmail: string | null;
  confirmEmail: (code: string) => Promise<void>;
  resendConfirmation: () => Promise<DeliveryOutcome | null>;
  /** Leave the confirmation: an answer not yet writing writes nothing; one already writing finishes. */
  forgetPendingSignIn: () => void;
  loginWithGoogle: (idToken: string) => Promise<{ linked: boolean }>;
  loginWithApple: (idToken: string, user?: any) => Promise<{ linked: boolean }>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  deleteAccount: () => Promise<{ deletedProjects: number }>;
  /** The last failure, kept whole so the screens can say it in the app's language. */
  error: AuthFlowError | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// What a started session writes, and what a failed write takes back.
const CREDENTIALS = ['accessToken', 'refreshToken', 'cachedUser'];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AuthFlowError | null>(null);
  // Separate from `loading`: the navigator replaces everything with a spinner
  // while `loading` is true, so a form toggling it was unmounted mid-request —
  // a failed registration landed back on Login, and the code screen could
  // never be reached.
  const [busy, setBusy] = useState(false);
  // The credentials of a registration or sign-in waiting for its email code.
  // In memory only: confirming needs the password again, and it is never
  // written anywhere. A restarted app asks to sign in again.
  const pendingSignIn = useRef<{ email: string; password: string } | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  // Each sign-in attempt takes a number. A newer attempt, or leaving the flow,
  // makes older ones stale, and a stale answer writes nothing — no tokens, no
  // user, no pending address (review R3-24; CLAUDE.md 11). Without it a
  // confirmation answered after the person had left the code screen signed
  // them in anyway, over another account's newer sign-in. The number is asked
  // once, when the answer's turn to write comes (see writeSession).
  const signInAttempt = useRef(0);
  const hasTimezoneSynced = useRef(false);
  const hasPushSynced = useRef(false);

  // Calendar sync state lives on the device (export/import mappings, picked
  // calendars, last-sync timestamps). Wipe it only when a *different* user
  // signs in on the same device — otherwise the same user logging back in
  // would see their sync UI reset to defaults.
  // It runs only inside a sign-in that has committed (writeSession), so a wipe
  // is never left behind by an attempt that then does not happen (review R3-31).
  const reconcileDeviceState = useCallback(async (newUser: User) => {
    const newUserId = String(newUser.id);
    const lastOwner = await AsyncStorage.getItem('calendar-sync-owner');
    if (lastOwner && lastOwner !== newUserId) {
      await AsyncStorage.multiRemove([
        'calendar-export-mappings',
        'calendar-import-tracking',
        'calendar-import-count',
        'calendar-sync-settings',
        // The last availability that loaded, kept so a start with no network is
        // not blank. It is the previous person's.
        'availability-cache',
        // And the bell's count, which is theirs too.
        'unread-count',
      ]);

      // Held in memory rather than in storage, so wiping the keys above does
      // not reach it. Left alone, the next person's mappings are posted against
      // this person's connection and silently rejected.
      resetConnectionCache();
    }
    await AsyncStorage.setItem('calendar-sync-owner', newUserId);
  }, []);

  const rememberPendingSignIn = useCallback((email: string, password: string) => {
    pendingSignIn.current = { email, password };
    setPendingEmail(email);
  }, []);

  const forgetPendingSignIn = useCallback(() => {
    signInAttempt.current += 1;
    pendingSignIn.current = null;
    setPendingEmail(null);
    setBusy(false);
  }, []);

  const beginAttempt = useCallback(() => {
    signInAttempt.current += 1;
    setError(null);
    setBusy(true);
    return signInAttempt.current;
  }, []);
  const isCurrent = (attempt: number) => attempt === signInAttempt.current;
  const endAttempt = useCallback((attempt: number) => {
    if (attempt === signInAttempt.current) setBusy(false);
  }, []);

  // Session writes run one at a time: a newer attempt starts writing only after
  // an older one has finished. Interleaved, two sign-ins mixed each other's
  // tokens and calendar state (review R3-29).
  const sessionWrites = useRef<Promise<unknown>>(Promise.resolve());

  // Every way in ends here. The attempt is asked once, when its turn to write
  // comes: that is where the sign-in commits. Before it, leaving cancels the
  // sign-in and nothing is written. After it, the sign-in runs to the end even
  // if the person leaves — the server has already spent the code and issued the
  // session, and a half-done sign-in cannot be undone: the wipe of another
  // account's device state is not reversible (review R3-31). The credentials
  // go last, so a failure at any step leaves no session behind to be restored
  // at the next start (review R3-30). Returns whether the session started.
  const writeSession = useCallback(async (data: { user: User; accessToken: string; refreshToken: string }, attempt: number) => {
    if (attempt !== signInAttempt.current) return false;
    await reconcileDeviceState(data.user);
    // Sync user preferences (timezone, locale, weekStartDay)
    await syncUserPreferences(data.user);
    await AsyncStorage.removeItem('lastLogoutTime');
    try {
      await AsyncStorage.multiSet([
        ['accessToken', data.accessToken],
        ['refreshToken', data.refreshToken],
        ['cachedUser', JSON.stringify(data.user)],
      ]);
    } catch (error) {
      // A write refused part-way may have stored some of them.
      await AsyncStorage.multiRemove(CREDENTIALS).catch(() => undefined);
      throw error;
    }
    pendingSignIn.current = null;
    setPendingEmail(null);
    setUser(data.user);
    return true;
  }, [reconcileDeviceState]);

  const startSession = useCallback((data: { user: User; accessToken: string; refreshToken: string }, attempt: number) => {
    const run = sessionWrites.current.then(() => writeSession(data, attempt));
    sessionWrites.current = run.catch(() => undefined);
    return run;
  }, [writeSession]);

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

      await reconcileDeviceState(user);
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
  }, [reconcileDeviceState]);

  // Load user from storage on mount
  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Re-register this device for push on login/restore.
  //
  // Logging out deletes the token server-side, and until now nothing put it
  // back — registration lived only on the onboarding screen and the profile
  // toggle. Signing out and back in therefore killed notifications for good,
  // without saying so and while the profile still showed them as on. That is
  // how the owner's own account ended up with no device registered.
  //
  // It never prompts: if permission was refused, this does nothing and asking
  // stays where the user expects to be asked.
  useEffect(() => {
    if (!user) {
      hasPushSynced.current = false;
      return;
    }
    if (hasPushSynced.current) return;
    hasPushSynced.current = true;

    syncPushTokenIfGranted()
      .then((token) => {
        if (token) logger.info('[Auth] Push token re-registered for this device');
      })
      .catch((err) => {
        logger.warn('[Auth] Push token sync failed:', err?.message);
      });
  }, [user]);

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
    const attempt = beginAttempt();
    try {
      const response = await authAPI.login(email, password);
      await startSession(response.data, attempt);
    } catch (err: any) {
      if (!isCurrent(attempt)) return;
      const failure = toAuthFlowError(err, 'Login failed');
      if (failure.code === 'EMAIL_NOT_VERIFIED') {
        // The password was right; the address still waits for its code.
        rememberPendingSignIn(failure.details.email ?? email.trim().toLowerCase(), password);
      } else {
        setError(failure);
      }
      throw failure;
    } finally {
      endAttempt(attempt);
    }
  }, [beginAttempt, endAttempt, startSession, rememberPendingSignIn]);

  const register = useCallback(async (email: string, password: string, firstName: string, lastName?: string, locale?: string) => {
    const attempt = beginAttempt();
    try {
      const response = await authAPI.register(email, password, firstName, lastName, getDeviceTimezone(), locale);
      if (!isCurrent(attempt)) return null;
      const created = { email: response.data.email as string, delivery: response.data.delivery as DeliveryOutcome };
      rememberPendingSignIn(created.email, password);
      return created;
    } catch (err: any) {
      if (!isCurrent(attempt)) return null;
      const failure = toAuthFlowError(err, 'Registration failed');
      // A taken address gets its own answer on the screen, not this line.
      if (failure.code !== 'EMAIL_TAKEN') setError(failure);
      throw failure;
    } finally {
      endAttempt(attempt);
    }
  }, [beginAttempt, endAttempt, rememberPendingSignIn]);

  const confirmEmail = useCallback(async (code: string) => {
    const pending = pendingSignIn.current;
    if (!pending) throw new AuthFlowError('Sign in again to confirm your address', 'SIGN_IN_AGAIN');
    const attempt = beginAttempt();
    try {
      const response = await authAPI.verifyEmail(pending.email, pending.password, code);
      await startSession(response.data, attempt);
    } catch (err: any) {
      if (!isCurrent(attempt)) return;
      throw toAuthFlowError(err, 'Confirmation failed');
    } finally {
      endAttempt(attempt);
    }
  }, [beginAttempt, endAttempt, startSession]);

  const resendConfirmation = useCallback(async () => {
    const pending = pendingSignIn.current;
    if (!pending) throw new AuthFlowError('Sign in again to confirm your address', 'SIGN_IN_AGAIN');
    const attempt = beginAttempt();
    try {
      const response = await authAPI.resendVerification(pending.email, pending.password);
      if (!isCurrent(attempt)) return null;
      return response.data.delivery as DeliveryOutcome;
    } catch (err: any) {
      if (!isCurrent(attempt)) return null;
      throw toAuthFlowError(err, 'Could not send the code');
    } finally {
      endAttempt(attempt);
    }
  }, [beginAttempt, endAttempt]);

  const loginWithGoogle = useCallback(async (idToken: string) => {
    const attempt = beginAttempt();
    try {
      const response = await authAPI.loginWithGoogle(idToken);
      const started = await startSession(response.data, attempt);

      return { linked: started && Boolean(response.data.linked) };
    } catch (err: any) {
      if (!isCurrent(attempt)) return { linked: false };
      console.error('[Auth] Google login error:', err);
      console.error('[Auth] Error response:', err.response?.data);
      console.error('[Auth] Error status:', err.response?.status);
      const failure = toAuthFlowError(err, 'Google sign-in failed');
      setError(failure);
      throw failure;
    } finally {
      endAttempt(attempt);
    }
  }, [beginAttempt, endAttempt, startSession]);

  const loginWithApple = useCallback(async (idToken: string, user?: any) => {
    const attempt = beginAttempt();
    try {
      const response = await authAPI.loginWithApple(idToken, user);
      const started = await startSession(response.data, attempt);

      return { linked: started && Boolean(response.data.linked) };
    } catch (err: any) {
      if (!isCurrent(attempt)) return { linked: false };
      const failure = toAuthFlowError(err, 'Apple sign-in failed');
      setError(failure);
      throw failure;
    } finally {
      endAttempt(attempt);
    }
  }, [beginAttempt, endAttempt, startSession]);

  const logout = useCallback(async () => {
    try {
      setLoading(true);

      // Order matters: dropping the push token needs a *valid* access token,
      // and /auth/logout bumps token_version, which invalidates it. Revoking
      // first would leave the token in the database and keep delivering this
      // user's notifications to a signed-out device.
      await unregisterPushToken();

      // Revoke all sessions server-side (best-effort; ignore if offline)
      try {
        await authAPI.logout();
      } catch (err) {
        logger.warn('Server logout failed (continuing with local cleanup):', err);
      }

      // Set flag to ignore stale deep links
      await AsyncStorage.setItem('lastLogoutTime', Date.now().toString());

      // Clear user-bound data but keep device-bound calendar sync state
      // and the language preference. If a *different* user signs back in,
      // reconcileDeviceState wipes the calendar state on the way in.
      await AsyncStorage.multiRemove([
        'accessToken',
        'refreshToken',
        'cachedUser',
        'weekStartDay',
        'timezone',
      ]);

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
      const failure = toAuthFlowError(err, 'Update failed');
      setError(failure);
      throw new Error(failure.message);
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
      const failure = toAuthFlowError(err, 'Failed to delete account');
      setError(failure);
      throw new Error(failure.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        busy,
        isAuthenticated: !!user,
        login,
        register,
        pendingEmail,
        confirmEmail,
        resendConfirmation,
        forgetPendingSignIn,
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
