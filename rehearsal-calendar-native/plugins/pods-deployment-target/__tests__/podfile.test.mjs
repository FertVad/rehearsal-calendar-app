// T-422: Xcode 27 stops the build on any Pods target below iOS 15.0, and
// React Native's post_install leaves the resource bundles at their podspecs'
// 12.4 and 13.4. app.json's plugin raises every Pods target in post_install.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PLUGIN = './plugins/pods-deployment-target/withPodsDeploymentTarget';

// The end of the Podfile `expo prebuild` makes for SDK 54 (e2e/.native/ios/Podfile).
const PODFILE = `platform :ios, podfile_properties['ios.deploymentTarget'] || '15.1'

target 'Rehearsly' do
  use_expo_modules!

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
      :ccache_enabled => ccache_enabled?(podfile_properties),
    )
  end
end
`;

test('app.json applies the plugin at prebuild', () => {
  const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'));
  assert.ok(app.expo.plugins.includes(PLUGIN), `app.json plugins: ${JSON.stringify(app.expo.plugins)}`);
});

test('post_install raises every Pods target below the platform to it', () => {
  const { raisePodsDeploymentTarget } = require(path.join(ROOT, PLUGIN));
  const podfile = raisePodsDeploymentTarget(PODFILE);
  const postInstall = podfile.slice(podfile.indexOf('post_install do |installer|'), podfile.lastIndexOf('end'));
  assert.match(postInstall, /min_ios = podfile_properties\['ios\.deploymentTarget'\] \|\| '15\.1'/);
  // Every target of the Pods project, resource bundles among them — not only
  // pod_target_installation_results' native targets, as React Native does.
  assert.match(postInstall, /installer\.pods_project\.targets\.each do \|pod_target\|/);
  assert.match(postInstall, /next if current\.nil\? \|\| Gem::Version\.new\(current\) >= Gem::Version\.new\(min_ios\)/);
  assert.match(postInstall, /build_config\.build_settings\['IPHONEOS_DEPLOYMENT_TARGET'\] = min_ios/);
  assert.ok(postInstall.indexOf('min_ios') < postInstall.indexOf('react_native_post_install'));
  assert.equal(podfile.split('\n').filter((line) => line.trim() === 'end').length, 2 + 2, 'two blocks of its own, closed');
});

test('a second prebuild over the same Podfile adds nothing', () => {
  const { raisePodsDeploymentTarget } = require(path.join(ROOT, PLUGIN));
  const once = raisePodsDeploymentTarget(PODFILE);
  assert.equal(raisePodsDeploymentTarget(once), once);
});

test('a Podfile without post_install is an error, not a project left to fail in Xcode', () => {
  const { raisePodsDeploymentTarget } = require(path.join(ROOT, PLUGIN));
  assert.throws(() => raisePodsDeploymentTarget("target 'Rehearsly' do\nend\n"), /post_install/);
});
