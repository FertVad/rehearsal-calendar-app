import { NativeModules, Platform } from 'react-native';
import { logger } from '../utils/logger';

/**
 * Sends the next requests down new connections (T-240).
 *
 * After the phone changes network — LTE to 5G, Wi-Fi to cellular — iOS keeps
 * the connections it had in the pool of React Native's NSURLSession, and a
 * connection that died with the old network still looks ready: the next
 * request is sent down it and hears nothing. A request that sends something
 * (a POST) iOS does not send again by itself, and on HTTP/2 every request to
 * the host shares that one connection, so the next try took it too
 * (TestFlight 1.0.0 (3), 09.11.2026: two Google sign-ins on connection 7, both
 * "no connection", with the network working).
 *
 * The native half is plugins/connection-renewal: `renew` flushes that
 * session's pool — `-[NSURLSession flushWithCompletionHandler:]`, after which
 * Apple's documentation promises future requests a new connection; requests
 * on their way are not touched. It also flushes it by itself whenever iOS
 * reports the network path changed, so most requests never meet a dead
 * connection at all. This is for the ones that did: api.ts calls it when a
 * request got no answer, before the try that follows.
 *
 * Resolves whether a pool was flushed: false off iOS, in Jest, or before
 * React Native has made its session — then there is nothing to flush.
 */
export async function renewConnections(): Promise<boolean> {
  const native = NativeModules.RehearslyConnections as { renew?: () => Promise<boolean> } | undefined;
  if (Platform.OS !== 'ios' || typeof native?.renew !== 'function') return false;
  try {
    const flushed = Boolean(await native.renew());
    logger.debug(`[Network] connections renewed (flushed: ${flushed})`);
    return flushed;
  } catch (error) {
    logger.warn('[Network] renewing the connections failed:', error);
    return false;
  }
}
