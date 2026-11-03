import { inviteCodeFromInput, inviteCodeFromUrl } from '../inviteCode';

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
    // A short code is the server's in capitals, however it was written (T-025).
    ['rehearsalapp://invite/abcdefgh', 'ABCDEFGH'],
    ['https://example.com/invite/23kmNPqr?utm=1', '23KMNPQR'],
  ])('reads %s as %s', (url, code) => {
    expect(inviteCodeFromUrl(url)).toBe(code);
  });

  it.each([
    'rehearsalapp://invite/ABCDEFG',
    'rehearsalapp://invite/ABCDEFGHJ',
    'rehearsalapp://invite/ABCDEFGI',
    'rehearsalapp://invite/abcdefgi',
    'rehearsalapp://invite/0123456789abcdef',
    'rehearsalapp://invite/',
    'rehearsalapp://projects/ABCDEFGH',
    'ABCDEFGH',
  ])('finds no invite code in %s', (url) => {
    expect(inviteCodeFromUrl(url)).toBeNull();
  });
});

// What someone types or pastes on the join screen (T-025). The server looks a
// code up exactly, and the field typed lowercase: "ab23cdef" found nothing.
describe('inviteCodeFromInput', () => {
  it.each([
    ['AB23CDEF', 'AB23CDEF'],
    ['ab23cdef', 'AB23CDEF'],
    ['  Ab23cDef ', 'AB23CDEF'],
    ['https://example.com/invite/ab23cdef', 'AB23CDEF'],
    ['Join us: https://example.com/invite/AB23CDEF', 'AB23CDEF'],
    // A legacy hex code is compared as it is: never changed.
    ['0123456789abcdef0123456789abcdef', '0123456789abcdef0123456789abcdef'],
    ['0123456789ABCDEF0123456789abcdef', '0123456789ABCDEF0123456789abcdef'],
    // Not a code: sent as typed, for the server to say it knows none.
    ['NOSUCH42', 'NOSUCH42'],
    ['nosuch42', 'nosuch42'],
  ])('sends %s as %s', (typed, code) => {
    expect(inviteCodeFromInput(typed)).toBe(code);
  });
});
