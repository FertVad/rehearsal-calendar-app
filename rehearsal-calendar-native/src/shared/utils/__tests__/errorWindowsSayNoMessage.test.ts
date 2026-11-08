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

it("the server's own words reach a window only through requestErrorMessage (T-228)", () => {
  const own = sources(SRC).flatMap((file) =>
    calls(readFileSync(file, 'utf8'))
      .filter(({ args }) => /response\??\.data\??\.error/.test(args))
      .map(({ call, line }) => `${relative(SRC, file)}:${line} — ${call} reads response.data.error; use requestErrorMessage`));
  expect(own).toEqual([]);
});
