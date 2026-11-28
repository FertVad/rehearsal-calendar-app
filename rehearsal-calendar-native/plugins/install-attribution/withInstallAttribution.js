/**
 * Expo config plugin: puts RehearslyAttribution.m into the app target (T-424;
 * what it calls and why in that file). ios/ is made anew by `expo prebuild`,
 * so the source lives here and is copied into the project's own folder, beside
 * AppDelegate, and compiled with the app. StoreKit is a system framework,
 * linked by the file's own import (the project builds with clang modules);
 * nothing else is added — no SKAdNetworkItems, which only an app that shows
 * ads needs.
 */
const fs = require('node:fs');
const path = require('node:path');
const { IOSConfig, withDangerousMod, withXcodeProject } = require('expo/config-plugins');

const FILE = 'RehearslyAttribution.m';
const SOURCE = path.join(__dirname, FILE);

const withSourceCopied = (config) => withDangerousMod(config, ['ios', (mod) => {
  const projectName = IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot);
  fs.copyFileSync(SOURCE, path.join(mod.modRequest.platformProjectRoot, projectName, FILE));
  return mod;
}]);

// Added once: a second prebuild over the same project finds it in the group
// and leaves it.
const withSourceInTarget = (config) => withXcodeProject(config, (mod) => {
  const projectName = IOSConfig.XcodeUtils.getProjectName(mod.modRequest.projectRoot);
  mod.modResults = IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
    filepath: `${projectName}/${FILE}`,
    groupName: projectName,
    project: mod.modResults,
  });
  return mod;
});

const withInstallAttribution = (config) => withSourceInTarget(withSourceCopied(config));

module.exports = withInstallAttribution;
