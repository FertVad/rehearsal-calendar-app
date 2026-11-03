import contract from '../../../shared/contracts/inviteCode.json';

// The invite code format is the server's (shared/contracts/inviteCode.json):
// short codes from its alphabet, or legacy 32-digit hexadecimal ones. The
// legacy branch goes first so a hex code is never cut to its first 8 digits.
// The server finds a code exactly. A short code is its alphabet's capitals
// however it was written - typed in lowercase, or in a link - so it is read
// case-blind and sent in capitals (T-025); a legacy code is sent as it is.
const SHORT = `[${contract.alphabet}]{${contract.length}}`;
const CODE = `[a-fA-F0-9]{${contract.legacyHexLength}}|${SHORT}`;
const INVITE_PATH = new RegExp(`/invite/(${CODE})(?=$|[/?#])`, 'i');
const WHOLE_CODE = new RegExp(`^(?:${CODE})$`, 'i');

/** A code as the server issued it: a short one in capitals, a legacy one untouched. */
function asIssued(code: string): string {
  return code.length === contract.length ? code.toUpperCase() : code;
}

/** The whole invite code in an invite link, or null when the link has none. */
export function inviteCodeFromUrl(url: string): string | null {
  const match = url.match(INVITE_PATH);
  return match ? asIssued(match[1]) : null;
}

/**
 * The code to send for what someone typed or pasted: the code of a link, a
 * code by the same rule, or - when it is neither - the text as typed, for the
 * server to say it knows no such invitation.
 */
export function inviteCodeFromInput(text: string): string {
  const entered = text.trim();
  const fromLink = inviteCodeFromUrl(entered);
  if (fromLink) return fromLink;
  return WHOLE_CODE.test(entered) ? asIssued(entered) : entered;
}
