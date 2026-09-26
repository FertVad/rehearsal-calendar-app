import type { Translations } from '../../../i18n/translations';

/** What the server said about sending an email: accepted, refused, or no answer. */
export type DeliveryOutcome = 'sent' | 'failed' | 'unknown';

/**
 * A failed auth request, keeping what the server said about it: its `code`
 * decides what the app does next (open the code screen, offer a reset), and
 * the screens turn it into the person's language rather than showing the
 * server's English.
 */
export class AuthFlowError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
    readonly details: { email?: string; retryAfter?: number; field?: string } = {},
  ) {
    super(message);
    this.name = 'AuthFlowError';
  }
}

export function toAuthFlowError(err: any, fallback: string): AuthFlowError {
  const data = err?.response?.data ?? {};
  return new AuthFlowError(
    typeof data.error === 'string' ? data.error : fallback,
    typeof data.code === 'string' ? data.code : undefined,
    err?.response?.status,
    { email: data.email, retryAfter: data.retryAfter, field: data.field },
  );
}

/** The message to show for a failed auth request, in the app's language. */
export function authErrorMessage(t: Translations, error: unknown): string {
  const failure = error instanceof AuthFlowError ? error : undefined;
  switch (failure?.code) {
    case 'CODE_INVALID': return t.auth.codeInvalid;
    case 'CODE_EXPIRED': return t.auth.codeExpired;
    case 'CODE_LOCKED': return t.auth.codeLocked;
    case 'CODE_MISSING': return t.auth.codeMissing;
    case 'ALREADY_VERIFIED': return t.auth.alreadyVerified;
    case 'EMAIL_UNAVAILABLE': return t.auth.emailUnavailable;
    case 'RATE_LIMITED': return t.auth.rateLimited(failure.details.retryAfter ?? 60);
    case 'PASSWORD_POLICY': return t.auth.passwordMinLength;
    case 'EMAIL_INVALID': return t.auth.invalidEmail;
    case 'EMAIL_TAKEN': return t.auth.emailTakenMessage;
    case 'EMAIL_NOT_VERIFIED': return t.auth.emailNotVerified;
    case 'SIGN_IN_AGAIN': return t.auth.signInAgainToConfirm;
    default: break;
  }
  if (failure?.status === 401) return t.auth.invalidCredentials;
  return error instanceof Error && error.message ? error.message : t.common.error;
}
