/**
 * No error window or error state shows an error's own `.message` (T-228).
 *
 * They used to take `err.response?.data?.error || err.message || …`, and a
 * request with no answer — no network, a timeout — has axios's English for a
 * message: the owner's iPhone, its interface in Russian, said "Network Error"
 * when three invite requests timed out on LTE. Every one goes through
 * requestErrorMessage, which says it in the app's language; this keeps
 * `.message` out of `Alert.alert(…)` and `setError(…)`.
 */
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = join(__dirname, '..', '..', '..');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sources(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

/** Each `Alert.alert(…)` and `setError(…)` call of a file — its arguments — with its line. */
function calls(text: string): { call: string; args: string; line: number }[] {
  const found: { call: string; args: string; line: number }[] = [];
  for (const match of text.matchAll(/\b(Alert\.alert|setError)\(/g)) {
    let depth = 1;
    let i = match.index! + match[0].length;
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === '(') depth++;
      else if (text[i] === ')') depth--;
    }
    found.push({
      call: match[1],
      args: text.slice(match.index! + match[0].length, i - 1),
      line: text.slice(0, match.index).split('\n').length,
    });
  }
  return found;
}

it("no error window or error state shows an error's .message (T-228)", () => {
  const raw = sources(SRC).flatMap((file) =>
    calls(readFileSync(file, 'utf8'))
      .filter(({ args }) => /\??\.message\b/.test(args))
      .map(({ call, line }) => `${relative(SRC, file)}:${line} — ${call} shows .message; use requestErrorMessage`));
  expect(raw).toEqual([]);
});

it('no error window says a written-in text instead of the language\'s (T-228)', () => {
  // The bug report's window said "Failed to send report" — English in every
  // interface, and the same offline and with the server down.
  const written = sources(SRC).flatMap((file) =>
    calls(readFileSync(file, 'utf8'))
      .filter(({ call, args }) => call === 'Alert.alert' && /^\s*t\.common\.error\s*,\s*['"`]/.test(args))
      .map(({ line }) => `${relative(SRC, file)}:${line} — error window says a written-in text; use requestErrorMessage`));
  expect(written).toEqual([]);
});

/** The body of each `catch (…) {…}` and `.catch(…)` of a file, with its line. */
function catches(text: string): { body: string; line: number }[] {
  const found: { body: string; line: number }[] = [];
  for (const match of text.matchAll(/\bcatch\s*(\([^)]*\))?\s*\{|\.catch\(/g)) {
    const open = match[0].endsWith('{') ? '{' : '(';
    const close = open === '{' ? '}' : ')';
    let depth = 1;
    let i = match.index! + match[0].length;
    for (; i < text.length && depth > 0; i++) {
      if (text[i] === open) depth++;
      else if (text[i] === close) depth--;
    }
    found.push({
      body: text.slice(match.index! + match[0].length, i - 1),
      line: text.slice(0, match.index).split('\n').length,
    });
  }
  return found;
}

// Review 2 of T-228. A failed request kept as `true` — `setLoadError(true)`,
// `{ failed: true }` — has lost what it failed with before any window is
// reached, and the window can only say its fixed words: "Could not delete"
// with no connection and with the server down alike, as the calendar sync's
// did before. The failure is kept as the error itself, and said through
// requestErrorMessage.
it('a failed request is kept as its error, not as true (T-228)', () => {
  const flags = sources(SRC).flatMap((file) =>
    catches(readFileSync(file, 'utf8'))
      .filter(({ body }) => /\bset\w*(Error|Failed|Failure)\(\s*true\s*\)|\bfailed:\s*true\b/.test(body))
      .map(({ line }) => `${relative(SRC, file)}:${line} — a catch keeps the failure as true; keep the error, say it through requestErrorMessage`));
  expect(flags).toEqual([]);
});

// Fixed words in an error window are for a known answer, not for a request
// that failed: those are the ones listed, each its own case.
const KNOWN_ANSWERS = new Set([
  // Who is on the rehearsal is unknown, so how many will be told is: the
  // question itself, with a retry, not the request's failure (T-228 owner).
  't.rehearsals.deleteNotifiedUnknown',
  // No calendar on the phone to write to: no request at all.
  't.calendarSync.noWritableCalendars',
]);

it('an error window says fixed words only for a known answer (T-228)', () => {
  const fixed = sources(SRC).flatMap((file) =>
    calls(readFileSync(file, 'utf8'))
      .filter(({ call }) => call === 'Alert.alert')
      .map((c) => ({ ...c, said: /^\s*t\.common\.error\s*,\s*(t(?:\.\w+)+)\s*(?:,|$)/.exec(c.args)?.[1] }))
      .filter(({ said }) => said && !KNOWN_ANSWERS.has(said))
      .map(({ line, said }) => `${relative(SRC, file)}:${line} — error window says ${said}; use requestErrorMessage(t, error, ${said})`));
  expect(fixed).toEqual([]);
});

// The places a failed request is said in fixed words beside the failure flag:
// the form's participants row (useAddRehearsalSubmit).
it('a failure flag beside fixed words is said through requestErrorMessage (T-228)', () => {
  const fixed = sources(SRC).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(/\{\s*text:\s*(t(?:\.\w+)+)\s*,\s*failed:\s*true\b/g)].map((m) => {
      const line = readFileSync(file, 'utf8').slice(0, m.index).split('\n').length;
      return `${relative(SRC, file)}:${line} — a failure says ${m[1]}; use requestErrorMessage`;
    }));
  expect(fixed).toEqual([]);
});

it("the server's own words reach a window only through requestErrorMessage (T-228)", () => {
  const own = sources(SRC).flatMap((file) =>
    calls(readFileSync(file, 'utf8'))
      .filter(({ args }) => /response\??\.data\??\.error/.test(args))
      .map(({ call, line }) => `${relative(SRC, file)}:${line} — ${call} reads response.data.error; use requestErrorMessage`));
  expect(own).toEqual([]);
});
