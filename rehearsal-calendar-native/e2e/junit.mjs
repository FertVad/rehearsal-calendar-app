/**
 * One JUnit report for a run made of several Maestros (run.mjs, "A run past
 * midnight" in docs/e2e.md): the testcases of every Maestro's report, in the
 * order they ran, under one testsuite as a single Maestro writes it. A flow
 * of a Maestro that wrote no report — it died, or the device went away — is a
 * failure with its exit code, not a flow left out.
 */
import path from 'node:path';

const escape = (text) => String(text)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * `parts`: `{ files, xml, code }` for each Maestro run — `files` its flows as
 * Maestro names them (relative to the app), `xml` its report or null, `code`
 * its exit.
 */
export function mergeJunit(parts) {
  const cases = [];
  let device = '';
  let timestamp = '';
  let time = 0;
  let failures = 0;
  for (const { files, xml, code } of parts) {
    const found = xml ? [...xml.matchAll(/<testcase\b[^>]*?(?:\/>|>[\s\S]*?<\/testcase>)/g)].map(([text]) => text) : [];
    if (!found.length) {
      for (const file of files) {
        const name = escape(path.basename(file, '.yaml'));
        cases.push(`    <testcase id="${name}" name="${name}" classname="${name}" file="${escape(file)}" time="0" status="ERROR">\n`
          + `      <failure>Maestro wrote no report for this flow (exit code ${code})</failure>\n    </testcase>`);
        failures += 1;
      }
      continue;
    }
    const suite = /<testsuite\b([^>]*)>/.exec(xml)?.[1] ?? '';
    const attr = (key) => new RegExp(`\\b${key}="([^"]*)"`).exec(suite)?.[1];
    device ||= attr('device') ?? '';
    timestamp ||= attr('timestamp') ?? '';
    time += Number(attr('time')) || 0;
    for (const text of found) {
      cases.push(`    ${text.trim()}`);
      const status = /\bstatus="([^"]*)"/.exec(text)?.[1];
      if (status && status !== 'SUCCESS') failures += 1;
    }
  }
  return '<?xml version=\'1.0\' encoding=\'UTF-8\'?>\n<testsuites>\n'
    + `  <testsuite name="Test Suite" device="${device}" tests="${cases.length}" failures="${failures}" time="${time.toFixed(2)}" timestamp="${timestamp}">\n`
    + `${cases.join('\n')}\n  </testsuite>\n</testsuites>\n`;
}
