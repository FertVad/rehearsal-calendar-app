/**
 * The identities recorded by existing migration histories never change (T-294).
 *
 * Production was created by `migrate --fresh` on 2026-10-28 (release 8a6dd5e;
 * the same manifest as 477ea2f). Its history root is `fresh`
 * rehearsly-pg-current-v1 with the bootstrap hash and profile definition below,
 * and database/migrations/history.mjs compares every later run against them: a
 * changed v1 artifact or definition makes `--dry` and `--apply` answer
 * HISTORY_INVALID there, and no step can ever be applied again. The values are
 * those of 477ea2f's manifest, computed by the real loader.
 *
 * A new schema takes a new profile (server/database/schema/README.md,
 * "Immutable artifacts and future profiles"): migration 016 is version 2, and
 * a v1 root receives it by --apply. The real PostgreSQL proof — a database
 * created by 477ea2f's own CLI, then --dry/--apply with this code — is
 * __tests__/postgres/t294Upgrade.mjs.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifest } from '../../database/schema/manifest.mjs';
import { loadArtifacts } from '../../database/migrations/artifacts.mjs';
import { buildPlan } from '../../database/migrations/core.mjs';

const serverRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const V1 = 'rehearsly-pg-current-v1';

// 477ea2f (= 8a6dd5e, production's --fresh): [bootstrap, definition].
const recordedProfiles = {
  'rehearsly-pg-current-v1': ['48284687247da9559e196a0175f427fd39c997fab04f2356de2f7ab204217cf9',
    '8bf276976bdc5863e45e2dd511cb042e9d2b448402717e1db4e27735f622ca6f'],
  'rehearsly-pg-domain13-v1': [null, 'ee4070df312183f4085f26674165fd20b00a2530e6255688e041d0b06337d53e'],
  'rehearsly-pg-domain13-pre-import-key-v1': [null, '7b9ebd3229829d93e68cd1e11bd7749577c55c7298bf76351a2432ccb4334691'],
};
const recordedSteps = {
  'availability-conflict-key-v1': '8c22ec9013689ba94f8d2fff38aff89fb651affbd6f63ffe947a04d8eb37bdd9',
  '007-member-availability-rate-limit': 'f3859db459f298ed9e430ab07499417b1d858bea7d8902a16736b315f3cb4ccd',
  '008-invite-rate-limits': 'b74460fe1c415e1244226b1f8279b33fc0450cc0ab0b172e62b0d13865437dea',
  '009-operation-ip-rate-limits': '91194ef28fc23b3e4aaf53e7b3b6713d0aa574f612cbc791a1a8509f6641c5a3',
  '010-email-verification': 'c9889b65fab7696a6f74034c96e7bd18a70860618cd770a3a3e77ae32332228c',
  '011-push-tickets': '2b22d9e827e40227ac7c578abd55e21a1e8917ef7fab74fc74001065320e3cd7',
  '012-idempotency-keys': 'aec7039c93fc96182a74ac8e93a4d7252ce2511d3dfebc80c30c20c8a0cbce22',
  '013-push-token-owner': 'b722a304c952d1841bcde61bee9606a3da9c5ed33d7b09778342ba91223ec0b3',
};

describe('migration history identities (T-294)', () => {
  let artifacts;
  beforeAll(async () => { artifacts = await loadArtifacts(manifest, serverRoot); });

  it('keeps every v1 profile exactly as recorded: bootstrap bytes and definition', () => {
    for (const [id, [bootstrap, definition]] of Object.entries(recordedProfiles)) {
      const profile = artifacts.profiles.find((item) => item.id === id);
      expect([profile.bootstrap?.sha256 ?? null, profile.definitionSha256]).toEqual([bootstrap, definition]);
    }
  });

  it('keeps every step before 016 exactly as recorded', () => {
    for (const [id, definition] of Object.entries(recordedSteps)) {
      expect(artifacts.steps.find((step) => step.id === id).definitionSha256).toBe(definition);
    }
  });

  it('creates new databases as version 2, from its own artifacts', () => {
    const v1 = artifacts.profiles.find((item) => item.id === V1);
    const v2 = artifacts.profiles.find((item) => item.id === artifacts.currentProfile);
    expect(v2.id).toBe('rehearsly-pg-current-v2');
    expect(v2.fresh).toBe(true);
    for (const kind of ['bootstrap', 'descriptor', 'inspector']) expect(v2[kind].file).not.toBe(v1[kind].file);
  });

  it('plans 016 alone for production\'s root: fresh v1 with 007–013', () => {
    const plan = buildPlan({ artifacts, request: { mode: 'dry' }, observations: {
      history: { root: { id: V1 }, frontier: { domain: 'v1', availabilityConflictKey: true,
        budgets: ['007', '008', '009', '010', '011', '012', '013'] } }, inspections: {}, empty: false } });
    expect(plan).toMatchObject({ state: 'managed', rootId: V1, stepIds: ['016-usage-statistics'] });
    const step = artifacts.steps.find((item) => item.id === '016-usage-statistics');
    expect(step.verifyProfile).toBe('rehearsly-pg-current-v2');
  });
});
