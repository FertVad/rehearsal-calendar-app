/**
 * Expo config plugin: the app target's build phase that puts the dSYMs of
 * React.framework, ReactNativeDependencies.framework and hermes.framework
 * beside the app's own, so an archive carries them (T-237; why and how in
 * dsyms.mjs). ios/ is made anew by `expo prebuild`, so the phase lives here,
 * not in the Xcode project.
 *
 * The phase runs dsyms.mjs from the project root's plugins/ — in e2e's
 * project (e2e/.native) a link to this one — with the Node that .xcode.env
 * names, as the JS bundling phase does. Its inputs are the frameworks the app
 * embeds and the script with its checksums; its outputs the three dSYMs, so
 * Xcode runs it again whenever one of them changed or is gone.
 */
const fs = require('node:fs');
const path = require('node:path');
const { withXcodeProject } = require('expo/config-plugins');

const PHASE_NAME = '[Rehearsly] dSYMs of the prebuilt React Native frameworks';
const SCRIPT = 'plugins/prebuilt-dsyms/dsyms.mjs';
const FRAMEWORKS = [
  ['React', 'React-Core-prebuilt/React.framework/React'],
  ['ReactNativeDependencies', 'ReactNativeDependencies/ReactNativeDependencies.framework/ReactNativeDependencies'],
  ['hermes', 'hermes-engine/Pre-built/hermes.framework/hermes'],
];

const shellScript = [
  'if [ -f "$PODS_ROOT/../.xcode.env" ]; then',
  '  . "$PODS_ROOT/../.xcode.env"',
  'fi',
  'if [ -f "$PODS_ROOT/../.xcode.env.local" ]; then',
  '  . "$PODS_ROOT/../.xcode.env.local"',
  'fi',
  `"$NODE_BINARY" "$PROJECT_DIR/../${SCRIPT}" phase`,
  '',
].join('\\n');

const quoted = (value) => `"${value}"`;

function addPhase(project) {
  const target = project.getFirstTarget();
  const phases = project.hash.project.objects.PBXShellScriptBuildPhase ?? {};
  const exists = Object.values(phases).some((phase) => typeof phase === 'object' && phase.name === quoted(PHASE_NAME));
  if (exists) return project;
  project.addBuildPhase([], 'PBXShellScriptBuildPhase', PHASE_NAME, target.uuid, {
    shellPath: '/bin/sh',
    shellScript,
    inputPaths: [
      ...FRAMEWORKS.map(([, binary]) => quoted(`\${PODS_XCFRAMEWORKS_BUILD_DIR}/${binary}`)),
      quoted(`$(PROJECT_DIR)/../${SCRIPT}`),
      quoted('$(PROJECT_DIR)/../plugins/prebuilt-dsyms/checksums.json'),
    ],
    outputPaths: FRAMEWORKS.map(([name]) => quoted(`$(DWARF_DSYM_FOLDER_PATH)/${name}.framework.dSYM`)),
  });
  return project;
}

const withPrebuiltDsyms = (config) => withXcodeProject(config, (mod) => {
  const script = path.join(mod.modRequest.projectRoot, SCRIPT);
  if (!fs.existsSync(script)) throw new Error(`withPrebuiltDsyms: ${script} is not there, and the build phase runs it`);
  mod.modResults = addPhase(mod.modResults);
  return mod;
});

module.exports = withPrebuiltDsyms;
module.exports.addPhase = addPhase;
module.exports.PHASE_NAME = PHASE_NAME;
