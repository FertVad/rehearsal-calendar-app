/**
 * The client's one log sink.
 *
 * Debug and info are dropped in production; warn and error always go out.
 * Whatever a level gets, it gets after toLogSafe — the journal never carries a
 * credential (AC04). A failed request used to reach console whole: an
 * AxiosError keeps its request config, so the Google ID token sat in
 * config.data and the session's bearer in config.headers, and anything that
 * collects the console — a debugger, a crash reporter — got both.
 *
 * So an error is logged as a typed summary, LoggedError, and nothing else of
 * it; every other value is copied with credential fields and token-shaped
 * strings redacted. No other file calls console (a test scans for it): a call
 * site cannot forget the rule, because it never sees the sink.
 */

const IS_DEV = process.env.NODE_ENV !== 'production';

export const REDACTED = '[redacted]';

/** What the journal keeps of an error. Body, headers and config never. */
export interface LoggedError {
  name: string;
  message: string;
  code?: string;
  /** HTTP status of a failed request. */
  status?: number;
  method?: string;
  /** Request path without its query string. */
  path?: string;
  /** The server's own `error` text, if it sent one. */
  serverError?: string;
  stack?: string;
}

// Keys whose value is a credential however it is spelled: accessToken,
// refresh_token, idToken, pushToken, Authorization, password, set-cookie...
const SECRET_KEY = /token|authorization|password|passwd|secret|cookie|credential|api[-_]?key|otp/i;
// HTTP internals: request config, the native request, raw headers and body.
const DROPPED_KEY = /^(config|request|headers|_headers|_body|_bodyInit|_bodyText)$/;

// Token-shaped text, wherever it turns up — a message, a positional argument,
// a URL's query.
const SECRET_TEXT: [RegExp, string][] = [
  [/\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi, REDACTED],
  [/\beyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]+/g, REDACTED], // JWT
  [/\bExpo(?:nent)?PushToken\[[^\]]*\]/g, REDACTED],
  [/([?&][^=&\s#]*(?:token|code|password|secret|key)[^=&\s#]*=)[^&\s#]+/gi, `$1${REDACTED}`],
];

const MAX_DEPTH = 4;

function redactText(text: string): string {
  return SECRET_TEXT.reduce((out, [pattern, replacement]) => out.replace(pattern, replacement), text);
}

function pathOf(url: unknown): string | undefined {
  if (typeof url !== 'string' || url === '') return undefined;
  return redactText(url.split(/[?#]/)[0]);
}

function isErrorLike(value: object): value is Error {
  return value instanceof Error
    || (typeof (value as any).message === 'string' && typeof (value as any).name === 'string'
      && ('stack' in value || 'isAxiosError' in value));
}

export function toLoggedError(error: Error): LoggedError {
  const anyError = error as any;
  const logged: LoggedError = {
    name: String(error.name || 'Error'),
    message: redactText(String(error.message ?? '')),
  };

  if (typeof anyError.code === 'string' || typeof anyError.code === 'number') {
    logged.code = String(anyError.code);
  }

  const status = anyError.response?.status ?? anyError.status;
  if (typeof status === 'number') logged.status = status;

  const config = anyError.config;
  if (config && typeof config === 'object') {
    if (typeof config.method === 'string') logged.method = config.method.toUpperCase();
    const path = pathOf(config.url);
    if (path) logged.path = path;
  }

  const serverError = anyError.response?.data?.error;
  if (typeof serverError === 'string') logged.serverError = redactText(serverError);

  // Development only: a stack is for the person at the debugger, and its first
  // line repeats the message, which may name more than we would like.
  if (IS_DEV && typeof error.stack === 'string' && !anyError.isAxiosError) {
    logged.stack = redactText(error.stack);
  }

  return logged;
}

/**
 * A copy of `value` fit for the journal: errors become LoggedError,
 * credential fields and token-shaped strings become REDACTED, HTTP internals
 * are dropped, cycles and depth are cut.
 */
export function toLogSafe(value: unknown, depth = 0, seen: WeakSet<object> = new WeakSet()): unknown {
  if (typeof value === 'string') return redactText(value);
  if (value === null || typeof value !== 'object') {
    return typeof value === 'function' ? '[function]' : value;
  }

  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (isErrorLike(value)) return toLoggedError(value);
  if (value instanceof Date) return value.toISOString();
  if (depth >= MAX_DEPTH) return Array.isArray(value) ? '[array]' : '[object]';

  if (Array.isArray(value)) return value.map((item) => toLogSafe(item, depth + 1, seen));

  const copy: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (DROPPED_KEY.test(key)) continue;
    copy[key] = SECRET_KEY.test(key) ? REDACTED : toLogSafe(item, depth + 1, seen);
  }
  return copy;
}

function safeArgs(args: unknown[]): unknown[] {
  return args.map((arg) => toLogSafe(arg));
}

/**
 * Logger with automatic production filtering
 */
export const logger = {
  /**
   * Debug logs - only shown in development
   */
  debug: (message: string, ...args: unknown[]) => {
    if (IS_DEV) {
      console.log(`[DEBUG] ${redactText(message)}`, ...safeArgs(args));
    }
  },

  /**
   * Info logs - only shown in development
   */
  info: (message: string, ...args: unknown[]) => {
    if (IS_DEV) {
      console.info(`[INFO] ${redactText(message)}`, ...safeArgs(args));
    }
  },

  /**
   * Warning logs - always shown
   */
  warn: (message: string, ...args: unknown[]) => {
    console.warn(`[WARN] ${redactText(message)}`, ...safeArgs(args));
  },

  /**
   * Error logs - always shown
   */
  error: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${redactText(message)}`, ...safeArgs(args));
  },
};
