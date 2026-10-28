// This reader has no environment-loader or runtime side effects. A missing or
// unusable Apple audience disables this provider, not the rest of the server.
const noAudiences = Object.freeze([]);

export function readAppleAuthConfig(environment = process.env) {
  const configured = environment.APPLE_CLIENT_ID;
  if (configured === undefined) return { enabled: false, audiences: noAudiences, reason: 'missing' };
  if (typeof configured !== 'string') return { enabled: false, audiences: noAudiences, reason: 'invalid' };
  const audience = configured.trim();
  if (!audience) return { enabled: false, audiences: noAudiences, reason: 'empty' };
  // APPLE_CLIENT_ID names one exact ID. Lists, JSON and embedded whitespace
  // are configuration errors; never silently broaden the accepted recipients.
  if (/[\s,;\[\]"']/.test(audience)) return { enabled: false, audiences: noAudiences, reason: 'invalid' };
  return { enabled: true, audiences: Object.freeze([audience]), reason: 'configured' };
}

export class AppleAuthUnavailableError extends Error {
  constructor() {
    super('Apple sign-in is unavailable');
    this.name = 'AppleAuthUnavailableError';
    this.code = 'APPLE_AUTH_UNAVAILABLE';
  }
}

export class AppleTokenVerificationError extends Error {
  constructor() {
    super('Invalid Apple token');
    this.name = 'AppleTokenVerificationError';
    this.code = 'APPLE_TOKEN_INVALID';
  }
}
