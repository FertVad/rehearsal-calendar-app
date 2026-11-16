/**
 * "This build is too old" (T-265).
 *
 * The server refuses an app build older than its MIN_IOS_BUILD with 426
 * UPDATE_REQUIRED (server/middleware/appBuild.js), and the root of the
 * navigation shows UpdateRequiredScreen instead of the navigator while it does.
 * The only writer of the state is the API client's response interceptor
 * (api.ts): a 426 of that code sets it, any answer the server gave this build
 * clears it — the minimum was lowered, and the check on the next return to
 * the foreground says so. Nothing here touches the session: the person is
 * still signed in after the update.
 */
import Constants from 'expo-constants';
import { useSyncExternalStore } from 'react';

/** Rehearsly in the App Store (App Store Connect, id from build 5's upload). */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6830809401';

/**
 * What this build is, from the binary itself: there are no over-the-air
 * updates, so the bundle and the binary are one release. iOS's CFBundleVersion
 * first, the app config's buildNumber where there is no native value.
 */
export const appBuildHeaders: Readonly<Record<'X-App-Version' | 'X-App-Build', string>> = {
  'X-App-Version': String(Constants.expoConfig?.version ?? ''),
  'X-App-Build': String(Constants.platform?.ios?.buildNumber ?? Constants.expoConfig?.ios?.buildNumber ?? ''),
};

let required = false;
const listeners = new Set<() => void>();

/** For api.ts's response interceptor only. */
export function setUpdateRequired(value: boolean): void {
  if (required === value) return;
  required = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const isRequired = () => required;

export function useUpdateRequired(): boolean {
  return useSyncExternalStore(subscribe, isRequired, isRequired);
}
