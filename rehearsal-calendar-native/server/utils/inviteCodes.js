import crypto from 'node:crypto';

// Preserve the short codes and exact-match legacy hexadecimal links.
const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 8;
const CODE_PATTERN = new RegExp(`^(?:[${CODE_ALPHABET}]{${CODE_LENGTH}}|[a-fA-F0-9]{32})$`);

export function isInviteCode(code) {
  return typeof code === 'string' && CODE_PATTERN.test(code);
}

export function isShortCode(code) {
  return typeof code === 'string' && code.length === CODE_LENGTH;
}

export function generateInviteCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return code;
}
