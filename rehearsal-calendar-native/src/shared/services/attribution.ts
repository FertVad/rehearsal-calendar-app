import { NativeModules, Platform } from 'react-native';
import { logger } from '../utils/logger';

/**
 * Tells iOS the app was opened, for ads of the app (T-424).
 *
 * An install that came from an ad (Meta's, on Facebook or Instagram) is
 * confirmed to the ad network by Apple itself, with SKAdNetwork's install
 * postback — once the advertised app has set a conversion value. The native
 * half is plugins/install-attribution: it sets the value "installed" (fine 0,
 * coarse low, the window left open) once per launch. Nothing is sent by the
 * app and nothing about the phone is read: no SDK, no advertising identifier,
 * no tracking prompt.
 *
 * Every outcome on iOS is logged: taken — debug; refused, or the native module
 * missing from the build — warn, which Release keeps too. A module that never
 * registered would otherwise mean no postbacks at all, and nobody would know.
 * Off iOS there is nothing to call and nothing is logged.
 *
 * Never throws: a failure is only logged, and the next launch tries again.
 */
export async function registerInstall(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  const native = NativeModules.RehearslyAttribution as { install?: () => Promise<void> } | undefined;
  if (typeof native?.install !== 'function') {
    logger.warn('[Attribution] the native module RehearslyAttribution is missing; no install postback');
    return;
  }
  try {
    await native.install();
    logger.debug('[Attribution] the install conversion value was taken');
  } catch (error) {
    logger.warn('[Attribution] the install conversion value was not taken:', error);
  }
}
