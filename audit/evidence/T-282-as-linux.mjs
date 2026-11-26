// T-282: run node:test on this Mac as GitHub's Linux runner sees it —
// process.platform is 'linux', and xcrun, ffmpeg, ffprobe and the compiled
// compose.swift are not there (T-282-no-tools.mjs).
// node --import ../audit/evidence/T-282-as-linux.mjs --test e2e/__tests__/store-compose.test.mjs ...
// (store-seed.test.mjs is left out: with 'linux' bcrypt loads its Linux binary here.)
import './T-282-no-tools.mjs';

Object.defineProperty(process, 'platform', { value: 'linux' });
