/**
 * Whether a person's sign-in address is proven (R3).
 *
 *   no row      an account from before R3: it works as it did, but its address
 *               is not treated as proven, and nothing marks it verified in bulk.
 *   pending     registered, code not yet entered. No session is issued.
 *   verified    proven by a code, or by Google/Apple for that exact address.
 *
 * The row names the address it is about; a verified row only counts for the
 * account's current address.
 */

export async function identityOf(conn, userId) {
  return (await conn.get(
    'SELECT email, status, verified_by FROM native_email_identities WHERE user_id = $1',
    [userId]
  )) ?? null;
}

/** True only for a proven identity of this exact address. */
export function isVerified(identity, email) {
  return identity?.status === 'verified' && identity.email === email;
}

// The table is keyed by user_id and has no id column, so both inserts name
// what they return: the PostgreSQL adapter appends RETURNING id otherwise.
export async function markPending(tx, { userId, email, now = new Date() }) {
  await tx.run(
    `INSERT INTO native_email_identities (user_id, email, status, created_at, updated_at)
     VALUES ($1, $2, 'pending', $3::timestamptz, $3::timestamptz) RETURNING user_id`,
    [userId, email, now.toISOString()]
  );
}

export async function markVerified(tx, { userId, email, by, now = new Date() }) {
  await tx.run(
    `INSERT INTO native_email_identities (user_id, email, status, verified_at, verified_by, created_at, updated_at)
     VALUES ($1, $2, 'verified', $3::timestamptz, $4, $3::timestamptz, $3::timestamptz)
     ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email, status = 'verified',
       verified_at = EXCLUDED.verified_at, verified_by = EXCLUDED.verified_by, updated_at = EXCLUDED.updated_at
     RETURNING user_id`,
    [userId, email, now.toISOString(), by]
  );
}
