import contract from '../../../shared/contracts/inviteCode.json';

// The invite code format is the server's (shared/contracts/inviteCode.json):
// short codes from its alphabet, or legacy 32-digit hexadecimal ones. The
// legacy branch goes first so a hex code is never cut to its first 8 digits.
const CODE = `[a-fA-F0-9]{${contract.legacyHexLength}}|[${contract.alphabet}]{${contract.length}}`;
const INVITE_PATH = new RegExp(`/invite/(${CODE})(?=$|[/?#])`);

/** The whole invite code in an invite link, or null when the link has none. */
export function inviteCodeFromUrl(url: string): string | null {
  const match = url.match(INVITE_PATH);
  return match ? match[1] : null;
}
