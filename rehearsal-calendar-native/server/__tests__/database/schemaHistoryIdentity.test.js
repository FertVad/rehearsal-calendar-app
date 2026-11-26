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
 *
 * Migration 017 (T-406) is version 3 the same way. Version 2's profile and
 * step 016 are pinned too, as b8722df's loader computes them: production
 * receives 016 from that release, and a v2 root (any --fresh since T-294)
 * records them. __tests__/postgres/t406Upgrade.mjs is the PostgreSQL proof.
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
  // b8722df (T-294): version 2.
  'rehearsly-pg-current-v2': ['ab086450afd91fb61b5a0dab7c4a14c6306e6b40f714a558c58089783eeeece3',
    '51553bdb1dee7949bdde3ed082b503158602908501b7953b76b5ec033575944b'],
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
  // b8722df (T-294).
  '016-usage-statistics': '985cfde9b162598e98063cbd9229448994ee11d17716799965413d4cf622d836',
};
const PRODUCTION_BUDGETS = ['007', '008', '009', '010', '011', '012', '013'];
const plan = (artifacts, rootId, budgets) => buildPlan({ artifacts, request: { mode: 'dry' }, observations: {
  history: { root: { id: rootId }, frontier: { domain: 'v1', availabilityConflictKey: true, budgets } },
  inspections: {}, empty: false } });

describe('migration history identities (T-294)', () => {
  let artifacts;
  beforeAll(async () => { artifacts = await loadArtifacts(manifest, serverRoot); });

  it('keeps every v1 profile exactly as recorded: bootstrap bytes and definition', () => {
    for (const [id, [bootstrap, definition]] of Object.entries(recordedProfiles)) {
      const profile = artifacts.profiles.find((item) => item.id === id);
      expect([profile.bootstrap?.sha256 ?? null, profile.definitionSha256]).toEqual([bootstrap, definition]);
    }
  });

  it('keeps every step before 017 exactly as recorded', () => {
    for (const [id, definition] of Object.entries(recordedSteps)) {
      expect(artifacts.steps.find((step) => step.id === id).definitionSha256).toBe(definition);
    }
  });

  it('creates new databases as version 3, from its own artifacts', () => {
    const older = artifacts.profiles.filter((item) => ['rehearsly-pg-current-v1', 'rehearsly-pg-current-v2'].includes(item.id));
    const v3 = artifacts.profiles.find((item) => item.id === artifacts.currentProfile);
    expect(v3.id).toBe('rehearsly-pg-current-v3');
    expect(v3.fresh).toBe(true);
    for (const profile of older) {
      for (const kind of ['bootstrap', 'descriptor', 'inspector']) expect(v3[kind].file).not.toBe(profile[kind].file);
    }
  });

  it('plans 017 alone for production\'s root after 016: fresh v1 with 007–013 and 016', () => {
    expect(plan(artifacts, V1, [...PRODUCTION_BUDGETS, '016']))
      .toMatchObject({ state: 'managed', rootId: V1, stepIds: ['017-weekend-defaults'] });
    const step = artifacts.steps.find((item) => item.id === '017-weekend-defaults');
    expect(step.verifyProfile).toBe('rehearsly-pg-current-v3');
  });

  it('plans 016, then 017, for production\'s root before 016', () => {
    expect(plan(artifacts, V1, PRODUCTION_BUDGETS))
      .toMatchObject({ state: 'managed', rootId: V1, stepIds: ['016-usage-statistics', '017-weekend-defaults'] });
    expect(artifacts.steps.find((item) => item.id === '016-usage-statistics').verifyProfile).toBe('rehearsly-pg-current-v2');
  });

  it('plans 017 alone for a version 2 root', () => {
    expect(plan(artifacts, 'rehearsly-pg-current-v2', [...PRODUCTION_BUDGETS, '016']))
      .toMatchObject({ state: 'managed', rootId: 'rehearsly-pg-current-v2', stepIds: ['017-weekend-defaults'] });
  });
});
