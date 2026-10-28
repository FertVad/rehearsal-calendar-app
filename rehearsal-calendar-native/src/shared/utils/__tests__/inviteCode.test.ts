import { inviteCodeFromUrl } from '../inviteCode';

// Codes below are valid on the server (server/utils/inviteCodes.js reads the
// same contract, shared/contracts/inviteCode.json).
describe('inviteCodeFromUrl', () => {
  it.each([
    ['rehearsalapp://invite/ABCDEFGH', 'ABCDEFGH'],
    ['rehearsalapp://invite/23KMNPQR', '23KMNPQR'],
    ['exp://192.168.1.5:8081/--/invite/XYZ23456', 'XYZ23456'],
    ['https://example.com/invite/23KMNPQR?utm=1', '23KMNPQR'],
    ['https://example.com/invite/23KMNPQR/', '23KMNPQR'],
    ['https://example.com/invite/23KMNPQR#join', '23KMNPQR'],
    ['rehearsalapp://invite/0123456789abcdef0123456789abcdef', '0123456789abcdef0123456789abcdef'],
    ['rehearsalapp://invite/0123456789ABCDEF0123456789ABCDEF', '0123456789ABCDEF0123456789ABCDEF'],
    // A legacy code whose first 8 digits are also a valid short code stays whole.
    ['rehearsalapp://invite/23456789abcdef0123456789abcdef01', '23456789abcdef0123456789abcdef01'],
  ])('reads %s as %s', (url, code) => {
    expect(inviteCodeFromUrl(url)).toBe(code);
  });

  it.each([
    'rehearsalapp://invite/ABCDEFG',
    'rehearsalapp://invite/ABCDEFGHJ',
    'rehearsalapp://invite/ABCDEFGI',
    'rehearsalapp://invite/abcdefgh',
    'rehearsalapp://invite/0123456789abcdef',
    'rehearsalapp://invite/',
    'rehearsalapp://projects/ABCDEFGH',
    'ABCDEFGH',
  ])('finds no invite code in %s', (url) => {
    expect(inviteCodeFromUrl(url)).toBeNull();
  });
});
