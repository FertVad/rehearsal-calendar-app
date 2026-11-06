/**
 * The versions every environment runs are fixed in the repository and agree,
 * so a disagreement fails here, before a merge, and not on a deployment.
 *
 * How it went wrong once: engines.node ">=18.0.0" let Vercel pick Node 26 on
 * the deployment, better-sqlite3 did not build for it, and the release fell
 * after the merge (PR #2 -> #3 -> #4). CI, Vercel and autodev each read Node
 * from their own file; nothing compared them.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const serverFile = path => fileURLToPath(new URL(`../${path}`, import.meta.url));
const repoFile = path => fileURLToPath(new URL(`../../../${path}`, import.meta.url));
const read = file => readFileSync(file, 'utf8');

// CI: actions/setup-node reads node-version-file .nvmrc at the repository root.
function ciMajor() {
  const version = read(repoFile('.nvmrc')).trim();
  const match = /^v?(\d+)\.\d+\.\d+$/.exec(version);
  if (!match) throw new Error(`.nvmrc must hold one exact version, got "${version}".`);
  return Number(match[1]);
}

// Vercel: engines.node. A range (">=18") lets the platform choose; only one
// major — "26.x" — keeps the choice in the repository.
function vercelMajor() {
  const { engines } = JSON.parse(read(serverFile('package.json')));
  const range = engines?.node ?? '';
  const match = /^(\d+)\.x$/.exec(range);
  if (!match) throw new Error(`server engines.node must name one major as "N.x", got "${range}".`);
  return Number(match[1]);
}

// autodev: the Node launchd starts the supervisor with unless AUTODEV_NODE says otherwise.
function autodevMajor() {
  const script = read(repoFile('tools/autodev/launchd.sh'));
  const match = /^NODE=\$\{AUTODEV_NODE:-[^}]*\/node\/v(\d+)\.\d+\.\d+\/bin\/node\}$/m.exec(script);
  if (!match) throw new Error('tools/autodev/launchd.sh has no default NODE=${AUTODEV_NODE:-.../node/vN.N.N/bin/node}.');
  return Number(match[1]);
}

describe('environment versions', () => {
  it('CI, Vercel and autodev run one Node major', () => {
    const majors = { ci: ciMajor(), vercel: vercelMajor(), autodev: autodevMajor() };
    // The diff names the place that disagrees with CI.
    expect(majors).toEqual({ ci: majors.ci, vercel: majors.ci, autodev: majors.ci });
  });

  it('Vercel installs exactly the lock file', () => {
    const { installCommand } = JSON.parse(read(serverFile('vercel.json')));
    expect(installCommand).toBe('npm ci');
  });
});
