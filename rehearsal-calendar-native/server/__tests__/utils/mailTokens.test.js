/**
 * The tokens that go into an email.
 *
 * A reset link is a credential that travels through a mailbox, a forwarded
 * message and a browser history. What matters is that it stops working the
 * moment it has done its job — and that it cannot be used for anything else.
 *
 * There is no table behind these. A reset link is signed over a fingerprint of
 * the current password hash, so setting a password invalidates every link
 * outstanding, including any the attacker requested in parallel.
 */
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-mail-tokens';

const {
  createPasswordResetToken,
  readPasswordResetToken,
  createEmailVerificationToken,
  readEmailVerificationToken,
} = await import('../../utils/mailTokens.js');

const user = (over = {}) => ({ id: 7, email: 'nina@theatre.example', password_hash: '$2b$10$old', ...over });

describe('A password reset link', () => {
  it('names the person who asked for it', () => {
    const token = createPasswordResetToken(user());

    expect(readPasswordResetToken(token, user())).toBe(7);
  });

  it('stops working once the password has been set', () => {
    // Spent, in other words. The link was signed against the old hash.
    const token = createPasswordResetToken(user());

    expect(readPasswordResetToken(token, user({ password_hash: '$2b$10$new' }))).toBeNull();
  });

  it('kills the other links outstanding at the same time', () => {
    // Somebody asking for three resets, or an attacker racing the owner, must
    // not be left holding a working one after the owner has used theirs.
    const first = createPasswordResetToken(user());
    const second = createPasswordResetToken(user());

    const after = user({ password_hash: '$2b$10$new' });

    expect(readPasswordResetToken(first, after)).toBeNull();
    expect(readPasswordResetToken(second, after)).toBeNull();
  });

  it('is refused for anybody else', () => {
    const token = createPasswordResetToken(user());

    expect(readPasswordResetToken(token, user({ id: 8 }))).toBeNull();
  });

  it('is refused when it is not a reset link at all', () => {
    // A verification link must not be usable to set a password.
    const token = createEmailVerificationToken(user());

    expect(readPasswordResetToken(token, user())).toBeNull();
  });

  it('is refused when it was not signed by us', () => {
    expect(readPasswordResetToken('not.a.token', user())).toBeNull();
    expect(readPasswordResetToken('', user())).toBeNull();
  });
});

describe('An email verification link', () => {
  it('names the person and the address it confirms', () => {
    const token = createEmailVerificationToken(user());

    expect(readEmailVerificationToken(token)).toEqual({
      userId: 7,
      email: 'nina@theatre.example',
    });
  });

  it('may be followed twice, because confirming twice is confirming once', () => {
    const token = createEmailVerificationToken(user());

    expect(readEmailVerificationToken(token)).not.toBeNull();
    expect(readEmailVerificationToken(token)).not.toBeNull();
  });

  it('is refused when it is a reset link', () => {
    const token = createPasswordResetToken(user());

    expect(readEmailVerificationToken(token)).toBeNull();
  });
});
