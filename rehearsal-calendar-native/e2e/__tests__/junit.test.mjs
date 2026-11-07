// The run's one JUnit report from several Maestros (T-226): every flow is in
// it once, in the order run, and a Maestro that wrote nothing fails its flows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeJunit } from '../junit.mjs';

const report = (cases, { time = '10.5', timestamp = '2026-11-06T23:14:18' } = {}) => `<?xml version='1.0' encoding='UTF-8'?>
<testsuites>
  <testsuite name="Test Suite" device="Rehearsly E2E - iOS 26.5 - X" tests="${cases.length}" failures="0" time="${time}" timestamp="${timestamp}">
${cases.map(([name, file, status, failure]) => `    <testcase id="${name}" name="${name}" classname="${name}" file="${file}" time="5" timestamp="${timestamp}" status="${status}">
${failure ? `      <failure>${failure}</failure>\n` : ''}    </testcase>`).join('\n')}
  </testsuite>
</testsuites>
`;

const testcases = (xml) => [...xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)].map(([, attrs, body = '']) => ({
  file: /\bfile="([^"]*)"/.exec(attrs)?.[1],
  status: /\bstatus="([^"]*)"/.exec(attrs)?.[1],
  failure: /<failure\b[^>]*>\s*([^\n<]*)/.exec(body)?.[1]?.trim() ?? null,
}));

test('the flows of every Maestro, in the order run, under one testsuite', () => {
  const xml = mergeJunit([
    { files: ['e2e/flows/01-login.yaml', 'e2e/flows/41-today-selects-today.yaml'], code: 1, xml: report([
      ['Sign in', 'e2e/flows/01-login.yaml', 'SUCCESS'],
      ['Today selects today', 'e2e/flows/41-today-selects-today.yaml', 'ERROR', 'Assertion is false: ".*Lamp trimming.*" is visible'],
    ]) },
    { files: ['e2e/flows/57-day-strip-centre.yaml'], code: 0, xml: report([['Day strip centres the day', 'e2e/flows/57-day-strip-centre.yaml', 'SUCCESS']],
      { time: '4.25', timestamp: '2026-11-07T00:00:31' }) },
  ]);
  assert.deepEqual(testcases(xml), [
    { file: 'e2e/flows/01-login.yaml', status: 'SUCCESS', failure: null },
    { file: 'e2e/flows/41-today-selects-today.yaml', status: 'ERROR', failure: 'Assertion is false: ".*Lamp trimming.*" is visible' },
    { file: 'e2e/flows/57-day-strip-centre.yaml', status: 'SUCCESS', failure: null },
  ]);
  assert.equal((xml.match(/<testsuite\b/g) ?? []).length, 1);
  assert.match(xml, /<testsuite name="Test Suite" device="Rehearsly E2E - iOS 26\.5 - X" tests="3" failures="1" time="14\.75" timestamp="2026-11-06T23:14:18">/);
});

test('a Maestro that wrote no report fails each of its flows with its exit code', () => {
  const xml = mergeJunit([{ files: ['e2e/flows/55-rehearsal-form-calendar.yaml', 'e2e/flows/56-a&b.yaml'], code: 3, xml: null }]);
  assert.deepEqual(testcases(xml), [
    { file: 'e2e/flows/55-rehearsal-form-calendar.yaml', status: 'ERROR', failure: 'Maestro wrote no report for this flow (exit code 3)' },
    { file: 'e2e/flows/56-a&amp;b.yaml', status: 'ERROR', failure: 'Maestro wrote no report for this flow (exit code 3)' },
  ]);
  assert.match(xml, /tests="2" failures="2"/);
});
