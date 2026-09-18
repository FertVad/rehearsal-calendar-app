import { constants } from 'node:fs';
import { access } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const serverDirectory = fileURLToPath(new URL('../', import.meta.url));
const appDirectory = resolve(serverDirectory, '..');
const requireServer = createRequire(join(serverDirectory, 'package.json'));
const [mode, ...args] = process.argv.slice(2);

// Always use the Node executable that started npm, including for the installer
// and Jest. Mixing Node majors breaks the native better-sqlite3 binding.
function runNode(nodeArgs, cwd = serverDirectory, environment = {}) {
  const result = spawnSync(process.execPath, nodeArgs, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...environment },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Test command failed (${result.signal || `exit ${result.status}`}).`);
  }
}

async function prepareBrowser({ withDeps = false } = {}) {
  const explicitBrowser = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (explicitBrowser !== undefined) {
    if (!explicitBrowser.trim()) throw new Error('PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH must not be empty.');
    const executablePath = resolve(explicitBrowser);
    await access(executablePath, constants.X_OK);
    // Keep relative paths stable when child tests run from the server directory.
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH = executablePath;
    console.log('[browser] Using the explicitly configured Chromium executable.');
    return;
  }

  console.log('[browser] Preparing the Chromium version pinned by Playwright.');
  const playwrightDirectory = dirname(requireServer.resolve('playwright/package.json'));
  // Installation is idempotent: an existing matching browser needs no download.
  // A failed install is an error, never a reason to skip browser assertions.
  runNode([join(playwrightDirectory, 'cli.js'), 'install', ...(withDeps ? ['--with-deps'] : []), 'chromium']);
}

function runJest(cwd, jestArgs, browserCheck) {
  const requirePackage = createRequire(join(cwd, 'package.json'));
  const explicitWorkers = jestArgs.some(arg => /^--(?:runInBand|maxWorkers)(?:=|$)/.test(arg) ||
    arg === '-i' || /^-w/.test(arg));
  runNode(['--experimental-vm-modules', requirePackage.resolve('jest/bin/jest'),
    ...(explicitWorkers ? [] : ['--runInBand']), ...jestArgs], cwd, {
    ADMIN_BROWSER_CHECK: browserCheck ? '1' : '0',
  });
}

try {
  if (!['all', 'backend', 'dashboard', 'stored', 'install'].includes(mode)) {
    throw new Error('Expected test mode: all, backend, dashboard, stored or install.');
  }
  if (mode === 'install' ? args.some(arg => arg !== '--with-deps') :
      !['all', 'backend'].includes(mode) && args.length) {
    throw new Error('Only full test runs accept Jest arguments; install accepts --with-deps.');
  }
  await prepareBrowser({ withDeps: mode === 'install' && args.includes('--with-deps') });
  if (mode === 'all' || mode === 'backend') {
    console.log('[tests] Running Jest. Command-line filters apply only to this stage.');
    runJest(mode === 'all' ? appDirectory : serverDirectory, args, false);
  }
  if (['all', 'backend', 'dashboard'].includes(mode)) {
    console.log('[browser] Running mandatory admin DOM/CSP regression tests.');
    runNode(['--test', '__tests__/browser/adminDashboard.browser.test.mjs']);
  }
  if (['all', 'backend', 'stored'].includes(mode)) {
    console.log('[browser] Running mandatory persisted-content DOM/CSP regression tests.');
    runJest(serverDirectory, [
      '--runInBand', '--runTestsByPath', '__tests__/integration/adminStoredContent.test.js',
    ], true);
  }
} catch (error) {
  console.error(`[tests] ${error.message}`);
  process.exitCode = 1;
}
