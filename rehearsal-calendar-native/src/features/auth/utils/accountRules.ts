/**
 * The server's rules for an address and a password (R3: A03), said once for
 * every form that sends one — registration, the password reset, the address
 * change — so a form stops what the server would refuse, and no form lets
 * through what it would refuse either. The server's own copy is
 * `server/utils/accountInput.js`.
 */

/** Addresses are compared and stored trimmed and lower-cased. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

const utf8Length = (value: string) => new TextEncoder().encode(value).length;

/**
 * At least 8 characters — counted as the server counts them, by code point, so
 * four emoji are four, not eight — and at most 72 bytes of UTF-8: bcrypt reads
 * no further, so a longer password would silently lose its tail. Not only
 * spaces, no NUL.
 */
export function meetsPasswordRule(password: string): boolean {
  return [...password].length >= 8 && utf8Length(password) <= 72 && password.trim() !== '' && !password.includes('\0');
}
