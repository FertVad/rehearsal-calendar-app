// T-215: which modules a first supertest request loads that importing did not.
//
//   node audit/evidence/T-215/lazy-requires.mjs
//
// Plain Node, no Jest: the same packages, and a hook on Module._load that
// prints every CommonJS module first loaded while a request is in flight.
// Under Jest each of those loads goes through its module registry instead.
import Module, { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const server = fileURLToPath(new URL('../../../rehearsal-calendar-native/server/', import.meta.url));
const require = createRequire(`${server}package.json`);
const express = require('express');
const supertest = require('supertest');

const seen = new Set(Object.keys(require.cache));
let phase = null;
const load = Module._load;
Module._load = function (request, parent, isMain) {
  const result = load.apply(this, arguments);
  if (phase) {
    for (const file of Object.keys(require.cache)) {
      if (!seen.has(file)) {
        seen.add(file);
        console.log(`${phase}: ${file.slice(file.indexOf('node_modules'))}`);
      }
    }
  }
  return result;
};

const app = express();
app.use(express.json());
app.get('/ping', (req, res) => res.json({ ok: true, q: req.query }));

for (const label of ['request 1', 'request 2']) {
  phase = label;
  const started = Date.now();
  const res = await supertest(app).get('/ping').query({ startDate: '2026-12-01' }).set('Authorization', 'Bearer x');
  phase = null;
  console.log(`${label}: status ${res.status}, ${Date.now() - started} ms`);
}
