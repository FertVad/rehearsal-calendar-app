import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fail } from './errors.mjs';
import { validateTransactionalSQL } from './sql.mjs';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const freeze = value => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
// Optional table groups, each installed whole by one forward step and
// recorded in the frontier as present. 007-009 are the rate-limit budgets
// (hence the frontier key "budgets"); 010 is email address proof (R3).
export const tableGroups = Object.freeze(['007', '008', '009', '010']);
const idValid = value => typeof value === 'string' && /^[a-z0-9][a-z0-9-]{0,99}$/.test(value);
const artifactValid = value => value && typeof value.file === 'string'
  && /^[a-zA-Z0-9_./-]+$/.test(value.file) && !path.posix.isAbsolute(value.file)
  && !value.file.split('/').some(part => !part || part === '.' || part === '..')
  && /^[0-9a-f]{64}$/.test(value.sha256);
const assertArtifact = condition => { if (!condition) fail('ARTIFACT_INVALID', 2); };
const validated = new WeakSet();
export const assertValidatedArtifacts = value => assertArtifact(validated.has(value));

// Curated, reviewed SQL only. Hash validation is artifact integrity, not a SQL
// sandbox or permission to execute arbitrary input. Transaction-control and
// nontransactional SQL must not be admitted to the reviewed manifest.
export function validateArtifacts(manifest, filesByPath) {
  assertArtifact(manifest?.formatVersion === 1 && idValid(manifest.currentProfile)
    && Array.isArray(manifest.profiles)
    && manifest.profiles.length > 0 && manifest.profiles.length <= 100
    && Array.isArray(manifest.steps) && manifest.steps.length <= 100
    && Array.isArray(manifest.legacyFilenames) && manifest.legacyFilenames.length <= 1000
    && Array.isArray(manifest.lockTables) && manifest.lockTables.length <= 100
    && manifest.lockTables.every(name => /^native_[a-z0-9_]+$/.test(name))
    && new Set(manifest.lockTables).size === manifest.lockTables.length);
  const usedFiles = new Map();
  function snapshot(entry, sql = false) {
    assertArtifact(artifactValid(entry));
    assertArtifact(!usedFiles.has(entry.file) || usedFiles.get(entry.file) === entry.sha256);
    usedFiles.set(entry.file, entry.sha256);
    const bytes = filesByPath instanceof Map ? filesByPath.get(entry.file) : filesByPath?.[entry.file];
    assertArtifact(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= 4 * 1024 * 1024);
    if (sha256(bytes) !== entry.sha256) fail('CHECKSUM_MISMATCH', 2);
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { fail('ARTIFACT_INVALID', 2); }
    assertArtifact(!text.includes('\0'));
    if (sql) validateTransactionalSQL(text);
    return { file: entry.file, sha256: entry.sha256, ...(sql ? { sql: text } : { text }) };
  }
  const profiles = manifest.profiles.map(profile => {
    assertArtifact(idValid(profile?.id) && typeof profile.fresh === 'boolean'
      && typeof profile.adopt === 'boolean' && (!profile.fresh || profile.bootstrap));
    const descriptor = snapshot(profile.descriptor);
    const inspector = snapshot(profile.inspector);
    const completion = manifest.profiles.find(item => item.id === profile.completionProfile);
    assertArtifact(completion && artifactValid(completion.descriptor) && artifactValid(completion.inspector));
    const bootstrap = profile.bootstrap ? snapshot(profile.bootstrap, true) : undefined;
    let definition;
    try { definition = JSON.parse(descriptor.text); }
    catch { fail('ARTIFACT_INVALID', 2); }
    assertArtifact(definition && typeof definition === 'object' && !Array.isArray(definition));
    if (profile.fresh) assertArtifact(definition.bootstrapSha256 === bootstrap.sha256);
    const identity = { id: profile.id, descriptor: descriptor.sha256, inspector: inspector.sha256,
      completion: { id: completion.id, descriptor: completion.descriptor.sha256, inspector: completion.inspector.sha256 },
      fresh: profile.fresh, adopt: profile.adopt, bootstrap: bootstrap?.sha256 ?? null };
    return { id: profile.id, descriptor, inspector, bootstrap, fresh: profile.fresh, adopt: profile.adopt,
      completionProfile: completion.id, definitionSha256: sha256(canonical(identity)) };
  });
  assertArtifact(new Set(profiles.map(profile => profile.id)).size === profiles.length
    && profiles.some(profile => profile.id === manifest.currentProfile && profile.fresh));
  const steps = manifest.steps.map(step => {
    assertArtifact(idValid(step?.id) && profiles.some(profile => profile.id === step.verifyProfile)
      && Array.isArray(step.roots) && step.roots.length > 0 && new Set(step.roots).size === step.roots.length
      && step.roots.every(id => profiles.some(profile => profile.id === id)));
    const when = step.when;
    assertArtifact(when && Object.keys(when).length === 1
      && (when.missingAvailabilityKey === true || tableGroups.includes(when.missingBudget)));
    const sql = snapshot(step.sql, true);
    const profile = profiles.find(profile => profile.id === step.verifyProfile);
    return { id: step.id, sql, when: { ...when }, roots: [...step.roots], verifyProfile: step.verifyProfile,
      definitionSha256: sha256(canonical({ id: step.id, sql: sql.sha256, when,
        roots: step.roots, profile: profile.definitionSha256 })) };
  });
  assertArtifact(new Set(steps.map(step => step.id)).size === steps.length);
  for (const profile of profiles) {
    const stepKeys = steps.filter(step => step.roots.includes(profile.id)).map(step => step.when.missingBudget ?? 'availability');
    const ordered = ['availability', ...tableGroups].filter(key => stepKeys.includes(key));
    assertArtifact(new Set(stepKeys).size === stepKeys.length && canonical(stepKeys) === canonical(ordered));
  }
  assertArtifact(manifest.legacyFilenames.every(file => typeof file === 'string'
    && /^[a-zA-Z0-9_-]+\.sql$/.test(file))
    && new Set(manifest.legacyFilenames).size === manifest.legacyFilenames.length);
  const result = freeze({ currentProfile: manifest.currentProfile, profiles, steps,
    legacyFilenames: [...manifest.legacyFilenames].sort(), lockTables: [...manifest.lockTables].sort() });
  validated.add(result);
  return result;
}

export async function loadArtifacts(manifest, root) {
  if (!path.isAbsolute(root)) fail('ARTIFACT_INVALID', 2);
  const references = [
    ...(manifest?.profiles ?? []).flatMap(profile => [profile.descriptor, profile.bootstrap, profile.inspector].filter(Boolean)),
    ...(manifest?.steps ?? []).map(step => step.sql)];
  const files = new Map();
  for (const ref of references) {
    assertArtifact(artifactValid(ref));
    try { files.set(ref.file, await readFile(path.join(root, ref.file))); }
    catch { fail('ARTIFACT_INVALID', 2); }
  }
  return validateArtifacts(manifest, files);
}

export function validateFrontier(value) {
  if (!value || value.domain !== 'v1' || typeof value.availabilityConflictKey !== 'boolean'
    || !Array.isArray(value.budgets) || value.budgets.some(key => !tableGroups.includes(key))
    || new Set(value.budgets).size !== value.budgets.length
    || Object.keys(value).sort().join(',') !== 'availabilityConflictKey,budgets,domain') fail('HISTORY_INVALID');
  return { domain: 'v1', availabilityConflictKey: value.availabilityConflictKey, budgets: [...value.budgets].sort() };
}
export const needsStep = (step, frontier) => step.when.missingAvailabilityKey
  ? !frontier.availabilityConflictKey : !frontier.budgets.includes(step.when.missingBudget);
export const stepsForRoot = (artifacts, rootId) => artifacts.steps.filter(step => step.roots.includes(rootId));
export function advance(step, frontier) {
  if (!needsStep(step, frontier)) fail('HISTORY_INVALID');
  return validateFrontier({ ...frontier, availabilityConflictKey: step.when.missingAvailabilityKey
    ? true : frontier.availabilityConflictKey,
  budgets: step.when.missingBudget ? [...frontier.budgets, step.when.missingBudget] : [...frontier.budgets] });
}
