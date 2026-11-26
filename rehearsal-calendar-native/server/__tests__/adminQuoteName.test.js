import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { quoteNameScript, scriptPath, sourcePath } from '../scripts/admin-quote-name.mjs';
import { quoteName } from '../../shared/quoteName.cjs';

// The admin page's copy of shared/quoteName.cjs (T-419) is the module itself,
// regenerated after every change to it, and quotes as the app does.
test('public/admin/quoteName.js is shared/quoteName.cjs as it is now', () => {
  expect(readFileSync(scriptPath, 'utf8')).toBe(quoteNameScript(readFileSync(sourcePath, 'utf8')));
});

test('the browser copy quotes project names as the app does in Russian', () => {
  const window = {};
  vm.runInNewContext(readFileSync(scriptPath, 'utf8'), { window });
  for (const name of ['Гамлет', '«Вишнёвый сад»', '"Вишнёвый сад"', 'Прогон «Чайки»', '<b>"quotes"</b>']) {
    expect(window.adminQuoteName(name, 'ru')).toBe(quoteName(name, 'ru'));
  }
  expect(window.adminQuoteName('Прогон «Чайки»', 'ru')).toBe('«Прогон „Чайки“»');
});
