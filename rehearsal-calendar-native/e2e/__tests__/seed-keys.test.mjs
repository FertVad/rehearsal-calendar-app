/**
 * The e2e seed's object literals have no key twice (T-412). A second `olga:`
 * in PEOPLE silently replaced Olga Prozorova with a new, not onboarded Olga:
 * the flows that sign in as her (42, 66, 78) met onboarding instead of the
 * calendar. `npm run lint` checks only src/, so no-dupe-keys never saw the seed.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Linter } from 'eslint';

const SEEDS = ['e2e/seed.mjs', 'e2e/store/seed.mjs'];

for (const file of SEEDS) {
  test(`${file} has no key twice in an object literal`, () => {
    const code = readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
    const messages = new Linter().verify(code, [{
      languageOptions: { ecmaVersion: 'latest', sourceType: 'module' },
      rules: { 'no-dupe-keys': 'error' },
    }], { filename: file });
    const fatal = messages.filter((message) => message.fatal);
    assert.deepEqual(fatal, [], `${file} does not parse`);
    assert.deepEqual(messages.map((message) => `${file}:${message.line} ${message.message}`), []);
  });
}
