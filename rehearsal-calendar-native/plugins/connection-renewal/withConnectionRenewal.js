/**
 * Expo config plugin: puts RehearslyConnections.m into the app target (T-240;
 * why and how in that file). ios/ is made anew by `expo prebuild`, so the
 * source lives here and is copied into the project's own folder, beside
 * AppDelegate, and compiled with the app.
 */
const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const FILE = 'RehearslyConnections.m';
const SOURCE = path.join(__dirname, FILE);

const withSourceCopied = (config) => withDangerousMod(config, ['ios', (mod) => {
  const projectName = IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot);
  fs.copyFileSync(SOURCE, path.join(mod.modRequest.platformProjectRoot, projectName, FILE));
  return mod;
}]);

// Added once: a second prebuild over the same project finds it in the group
// and leaves it.
function addSource(project, projectName) {
  return IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
    filepath: `${projectName}/${FILE}`,
    groupName: projectName,
    project,
  });
}

const withSourceInTarget = (config) => withXcodeProject(config, (mod) => {
  const projectName = IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot);
  mod.modResults = addSource(mod.modResults, projectName);
  return mod;
});

const withConnectionRenewal = (config) => withSourceInTarget(withSourceCopied(config));

module.exports = withConnectionRenewal;
