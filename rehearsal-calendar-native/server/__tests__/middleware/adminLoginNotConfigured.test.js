import { jest } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { adminLogin } from '../../middleware/adminAuth.js';

// The admin page says «Вход не настроен…» only for this answer of adminAuth.js,
// read by its text (dashboard.js, T-419); any other 503 is «Не удалось войти».
// The page and the server are tied by this test: a changed text on either side
// would turn "not configured" into a plain failure without a word.
const saved = { hash: process.env.ADMIN_PASSWORD_HASH, plain: process.env.ADMIN_PASSWORD };
afterEach(() => {
  for (const [name, value] of [['ADMIN_PASSWORD_HASH', saved.hash], ['ADMIN_PASSWORD', saved.plain]]) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

test('without a password the login answers 503 with the text dashboard.js looks for', async () => {
  delete process.env.ADMIN_PASSWORD_HASH;
  delete process.env.ADMIN_PASSWORD;
  const res = { status: jest.fn(() => res), json: jest.fn(() => res) };
  const next = jest.fn();
  await adminLogin({ body: { password: 'anything' } }, res, next);
  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalledWith(503);
  const [[body]] = res.json.mock.calls;
  expect(body).toEqual({ error: 'Admin panel not configured' });

  const page = readFileSync(fileURLToPath(new URL('../../public/admin/dashboard.js', import.meta.url)), 'utf8');
  expect(page).toContain(`data?.error === '${body.error}'`);
});
