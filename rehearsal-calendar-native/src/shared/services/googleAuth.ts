/**
 * Google OAuth Authentication Service
 *
 * This module provides Google Sign-In functionality using expo-auth-session.
 * It handles the OAuth flow and extracts the ID token for backend verification.
 */

import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';

// Complete the browser session on Android
// This is required for the OAuth flow to work properly
WebBrowser.maybeCompleteAuthSession();

/**
 * Google OAuth configuration from app.json extra config
 */
const GOOGLE_IOS_CLIENT_ID = Constants.expoConfig?.extra?.googleIosClientId;
const GOOGLE_ANDROID_CLIENT_ID = Constants.expoConfig?.extra?.googleAndroidClientId;
const GOOGLE_WEB_CLIENT_ID = Constants.expoConfig?.extra?.googleWebClientId;

/**
 * Hook for Google OAuth authentication
 *
 * This hook uses expo-auth-session to handle the Google OAuth flow.
 * It returns the request, response, and promptAsync function.
 *
 * Usage:
 * ```typescript
 * const { request, response, promptAsync } = useGoogleAuth();
 *
 * // Trigger OAuth flow
 * await promptAsync();
 *
 * // Handle response
 * if (response?.type === 'success') {
 *   const idToken = getGoogleIdToken(response);
 *   // Send idToken to backend
 * }
 * ```
 *
 * @returns {Object} { request, response, promptAsync }
 */
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
  });

  return {
    request,
    response,
    promptAsync,
  };
}

/**
 * Extract ID token from Google OAuth response
 *
 * @param {Object} response - The response from Google.useIdTokenAuthRequest
 * @returns {string | null} The ID token if available, null otherwise
 */
export function getGoogleIdToken(response: any): string | null {
  if (response?.type === 'success' && response.params?.id_token) {
    return response.params.id_token;
  }
  return null;
}

/**
 * Check if Google OAuth is properly configured
 *
 * @returns {boolean} True if all required client IDs are set
 */
export function isGoogleAuthConfigured(): boolean {
  return !!(GOOGLE_WEB_CLIENT_ID && (GOOGLE_IOS_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID));
}

/**
 * Get human-readable error message from OAuth response
 *
 * @param {Object} response - The response from Google.useIdTokenAuthRequest
 * @returns {string} Error message
 */
export function getGoogleAuthError(response: any): string {
  if (response?.type === 'error') {
    return response.error?.message || 'Google Sign-In failed';
  }

  if (response?.type === 'dismiss' || response?.type === 'cancel') {
    return 'Google Sign-In was cancelled';
  }

  return 'Unknown Google Sign-In error';
}
