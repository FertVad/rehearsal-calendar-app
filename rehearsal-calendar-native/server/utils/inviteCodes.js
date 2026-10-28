import crypto from 'node:crypto';
import contract from '../../shared/contracts/inviteCode.json' with { type: 'json' };

// Preserve the short codes and exact-match legacy hexadecimal links. The format
// lives in the shared contract, so the app reads links by the same rule.
const CODE_ALPHABET = contract.alphabet;
const CODE_LENGTH = contract.length;
const CODE_PATTERN = new RegExp(
  `^(?:[${CODE_ALPHABET}]{${CODE_LENGTH}}|[a-fA-F0-9]{${contract.legacyHexLength}})$`
);

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
