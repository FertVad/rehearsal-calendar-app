/**
 * The journal never carries a credential (AC04, cause fix 13).
 *
 * A failed request used to reach console.error whole: an AxiosError keeps the
 * request config, so the Google ID token sat in config.data and the session's
 * bearer in config.headers, and whatever collects the console got both. The
 * rule now lives in the logger: an error is logged as a typed summary — name,
 * message, code, HTTP status, method and path — and anything else passes
 * through redaction. Every client log goes through it; no file but the logger
 * touches console.
 */
import * as fs from 'fs';
import * as path from 'path';
import { logger } from '../logger';

const ID_TOKEN = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJnb29nbGUtdXNlciJ9.c2lnbmF0dXJlLXBhcnQ';
const ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOjQyfQ.YWNjZXNzLXNpZ25hdHVyZQ';
const PUSH_TOKEN = 'ExponentPushToken[xXxSecretPushTokenxXx]';

// The shape axios builds when /auth/google answers 401.
function googleLoginFailure() {
  const error: any = new Error('Request failed with status code 401');
  error.name = 'AxiosError';
  error.isAxiosError = true;
  error.code = 'ERR_BAD_REQUEST';
  error.config = {
    method: 'post',
    url: '/auth/google?state=abc',
    baseURL: 'https://api.example.test/api',
    data: JSON.stringify({ idToken: ID_TOKEN }),
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
  };
  error.request = { _headers: { authorization: `Bearer ${ACCESS_TOKEN}` }, _body: error.config.data };
  error.response = {
    status: 401,
    data: { error: 'Invalid Google token' },
    headers: { 'set-cookie': 'sid=secret' },
    config: error.config,
  };
  return error;
}

function captured(spy: jest.SpyInstance): string {
  return spy.mock.calls
    .map((args) => args.map((a: unknown) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
    .join('\n');
}

describe('logger keeps credentials out of the journal', () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;
  let infoSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(console, 'error').mockImplementation();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    infoSpy = jest.spyOn(console, 'info').mockImplementation();
    logSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs a failed request as a typed summary without its body or headers', () => {
    logger.error('[Auth] Google login error:', googleLoginFailure());

    const out = captured(errorSpy);
    expect(out).not.toContain(ID_TOKEN);
    expect(out).not.toContain(ACCESS_TOKEN);
    expect(out).not.toContain('sid=secret');
    expect(out).not.toContain('state=abc');

    const logged = errorSpy.mock.calls[0][1];
    expect(logged).toEqual({
      name: 'AxiosError',
      message: 'Request failed with status code 401',
      code: 'ERR_BAD_REQUEST',
      status: 401,
      method: 'POST',
      path: '/auth/google',
      serverError: 'Invalid Google token',
    });
  });

  it('applies the same rule to warn, info and debug', () => {
    logger.warn('[Notifications] Could not re-register push token:', googleLoginFailure());
    logger.info('[Notifications] token', PUSH_TOKEN);
    logger.debug('[Auth] header', `Bearer ${ACCESS_TOKEN}`);
    logger.error('Response Error: 400 GET /auth/verify-email?token=opaque-mail-token&lang=ru');

    const out = [captured(warnSpy), captured(infoSpy), captured(logSpy), captured(errorSpy)].join('\n');
    expect(out).not.toContain('opaque-mail-token');
    expect(out).toContain('lang=ru');
    expect(out).not.toContain(ID_TOKEN);
    expect(out).not.toContain(ACCESS_TOKEN);
    expect(out).not.toContain('xXxSecretPushTokenxXx');
  });

  it('keeps an invite code out of a path, in the message and in LoggedError.path', () => {
    // The code is the key to a project: whoever reads it can join.
    const error: any = new Error('Network Error');
    error.name = 'AxiosError';
    error.isAxiosError = true;
    error.code = 'ERR_NETWORK';
    error.config = { method: 'post', url: '/native/invite/ABCD2345/join' };

    logger.error('Response Error: Network Error POST /native/invite/ABCD2345/join', error);
    logger.info('[Linking] open', 'https://rehearsly.me/invite/0123456789abcdef0123456789abcdef?x=1');

    const out = [captured(errorSpy), captured(infoSpy)].join('\n');
    expect(out).not.toContain('ABCD2345');
    expect(out).not.toContain('0123456789abcdef0123456789abcdef');
    expect(errorSpy.mock.calls[0][0]).toBe('[ERROR] Response Error: Network Error POST /native/invite/[redacted]/join');
    expect(errorSpy.mock.calls[0][1]).toMatchObject({ method: 'POST', path: '/native/invite/[redacted]/join' });
  });

  it('redacts credential fields and token-shaped strings anywhere in a plain value', () => {
    logger.error('[Test] state:', {
      user: { id: 7, email: 'a@b.test' },
      accessToken: ACCESS_TOKEN,
      refresh_token: 'opaque-refresh',
      password: 'hunter2',
      nested: [{ note: `token is ${ID_TOKEN}` }, { pushToken: PUSH_TOKEN }],
      headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
    });

    const out = captured(errorSpy);
    expect(out).not.toContain(ACCESS_TOKEN);
    expect(out).not.toContain(ID_TOKEN);
    expect(out).not.toContain('opaque-refresh');
    expect(out).not.toContain('hunter2');
    expect(out).not.toContain('xXxSecretPushTokenxXx');
    expect(errorSpy.mock.calls[0][1]).toMatchObject({ user: { id: 7, email: 'a@b.test' } });
  });

  it('keeps a plain error readable and survives a cycle', () => {
    const cyclic: any = { label: 'loop' };
    cyclic.self = cyclic;

    logger.error('[Test] plain:', new Error('Network error'));
    logger.error('[Test] cyclic:', cyclic);

    expect(errorSpy.mock.calls[0][1]).toMatchObject({ name: 'Error', message: 'Network error' });
    expect(() => JSON.stringify(errorSpy.mock.calls[1][1])).not.toThrow();
  });
});

describe('no client code writes to console but the logger', () => {
  const SRC = path.resolve(__dirname, '../../..');
  const LOGGER = path.resolve(__dirname, '../logger.ts');

  function sources(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sources(full);
      return /\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\.tsx?$/.test(entry.name) ? [full] : [];
    });
  }

  it('finds no direct console call', () => {
    const offenders = sources(SRC)
      .filter((file) => file !== LOGGER)
      .flatMap((file) =>
        fs.readFileSync(file, 'utf8').split('\n')
          .map((line, i) => ({ line, at: `${path.relative(SRC, file)}:${i + 1}` }))
          .filter(({ line }) => /\bconsole\.(log|info|warn|error|debug|trace)\s*\(/.test(line))
          .map(({ at }) => at),
      );

    expect(offenders).toEqual([]);
  });
});
