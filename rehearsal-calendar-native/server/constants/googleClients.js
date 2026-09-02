/**
 * The Google OAuth client ids this app signs in with.
 *
 * These are not secrets. They ship inside the binary — `app.json` puts them in
 * `expo.extra`, the app reads them from `Constants.expoConfig.extra`, and every
 * installed copy carries them. Anyone can read them out of the IPA.
 *
 * Keeping them only in environment variables therefore bought no security, and
 * cost the one thing that matters here: the server and the app have to name the
 * same ids or no one can sign in. They drifted apart exactly that way — the
 * audience check was disabled with a note blaming expo-auth-session for
 * "tokens with a different audience", when the tokens were fine and the
 * server's list was stale. Turning the check back on failed immediately with
 * `Wrong recipient` against a production environment that had *some* values
 * set, just not these.
 *
 * So the source of truth lives beside the app's, in code, where a mismatch
 * shows up in a diff. Environment variables still add to the list — a rotation
 * can be deployed without a release — but they cannot silently replace it.
 *
 * Keep in step with `expo.extra.google*ClientId` in app.json.
 */
export const GOOGLE_CLIENT_IDS = [
  // iOS
  '187810235800-9pp30fhn7kekvcranjrij9fib5kl8od0.apps.googleusercontent.com',
  // Android
  '187810235800-dqfk1of6ork5c4pqtff7pi4srmlgo6ej.apps.googleusercontent.com',
  // Web — expo-auth-session uses this one for the request on some flows, so a
  // token's audience can legitimately be the web id on a phone.
  '187810235800-q13jtdqimc8qeppacne0ma32i0anm14j.apps.googleusercontent.com',
];

/**
 * Every audience we accept: the ids above, plus anything the environment adds.
 * De-duplicated, because passing the same id twice is merely untidy but reading
 * a list with repeats while debugging is worse.
 */
export function acceptedGoogleAudiences() {
  return [
    ...new Set([
      ...GOOGLE_CLIENT_IDS,
      process.env.GOOGLE_CLIENT_ID_IOS,
      process.env.GOOGLE_CLIENT_ID_ANDROID,
      process.env.GOOGLE_CLIENT_ID_WEB,
    ].filter(Boolean)),
  ];
}
