import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const server = fileURLToPath(new URL('../../', import.meta.url));

// Every cold start (a Vercel instance, each startup fixture child) pays for the
// app's whole import graph. The date-fns barrel is every date-fns function and
// locale index: ~2 s idle and ~10 s under the full-suite load, which crossed the
// startup fixture's start wait. The server needs none of it; date-fns-tz's root
// pulls it in through its format helpers, so only its used parts are imported.
const refuseBarrel = `
export async function resolve(specifier, context, next) {
  const result = await next(specifier, context);
  if (result.url.endsWith('/node_modules/date-fns/index.js')) {
    throw new Error('date-fns barrel imported from ' + context.parentURL);
  }
  return result;
}`;
const observe = `
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(${JSON.stringify(refuseBarrel)}));
try {
  await import(${JSON.stringify(`${server}app.js`)});
  console.log('imported');
} catch (error) {
  console.log(error.message);
}
process.exit(0);
`;

test('importing the app does not load the date-fns barrel', () => {
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', observe], {
    cwd: server, env: { PATH: process.env.PATH }, encoding: 'utf8', timeout: 60000,
  });
  expect(result.stdout.trim().split('\n').at(-1)).toBe('imported');
});
