/**
 * The app does not promise rehearsal reminders (T-266).
 *
 * Reminders the day before and an hour before are switched off: both
 * schedulers of /api/cron/reminders have stood still since 2026-09-12, and on
 * 2026-11-16 the owner decided to keep them off until the first users are asked
 * whether they want them at all. A string that promises them is false.
 *
 * Every translation file is read as text, so a function's body and every
 * plural branch is covered, in all four languages. When reminders are switched
 * back on, this test goes together with the words coming back.
 */
import fs from 'fs';
import path from 'path';

const DIR = path.join(__dirname, '..', 'translations');
// ru, en, es, de: "напоминание", "reminder", "recordatorio", "Erinnerung".
const PROMISE = /напомин|remind|recordatori|erinnerung/iu;

describe('T-266: no string promises rehearsal reminders while they are off', () => {
  const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.ts'));

  it('reads the translation files', () => {
    expect(files).toContain('notifications.ts');
  });

  it('no line mentions reminders, in any language', () => {
    const found: string[] = [];
    for (const file of files) {
      fs.readFileSync(path.join(DIR, file), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (PROMISE.test(line)) found.push(`${file}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(found).toEqual([]);
  });
});
