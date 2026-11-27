/**
 * Expo config plugin: no target in the Pods project is built for an iOS older
 * than the app's own (T-422).
 *
 * Xcode 27 refuses a deployment target below iOS 15.0 as an error, where
 * Xcode 26 let it be. React Native's post_install raises the pods' own
 * targets (ReactNativePodsUtils.updateOSDeploymentTarget) but not their
 * resource bundles, which keep the podspec's: RNSVGFilters 12.4,
 * RNCAsyncStorage_resources 13.4. The first build after 1.0.1 (8) made the
 * project anew under Xcode 27.2 and stopped there (xcodebuild 65), before any
 * flow; the App Store build is made of the same Podfile.
 *
 * So the Podfile's post_install raises every target of the Pods project that
 * names a lower one to the platform's — the one the Podfile itself declares,
 * podfile_properties['ios.deploymentTarget'] or 15.1.
 */
const { withPodfile } = require('expo/config-plugins');

const TAG = '# rehearsly: pods-deployment-target (T-422)';
const ANCHOR = /^([ \t]*)post_install do \|installer\|[ \t]*$/m;

const RAISE = [
  `    ${TAG}`,
  "    min_ios = podfile_properties['ios.deploymentTarget'] || '15.1'",
  '    installer.pods_project.targets.each do |pod_target|',
  '      pod_target.build_configurations.each do |build_config|',
  "        current = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']",
  '        next if current.nil? || Gem::Version.new(current) >= Gem::Version.new(min_ios)',
  "        build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios",
  '      end',
  '    end',
].join('\n');

/** The Podfile with the raise at the top of its post_install; once, however many prebuilds run over it. */
function raisePodsDeploymentTarget(podfile) {
  if (podfile.includes(TAG)) return podfile;
  const match = ANCHOR.exec(podfile);
  if (!match) throw new Error('withPodsDeploymentTarget: the Podfile has no `post_install do |installer|`');
  const end = match.index + match[0].length;
  return `${podfile.slice(0, end)}\n${RAISE}${podfile.slice(end)}`;
}

const withPodsDeploymentTarget = (config) => withPodfile(config, (mod) => {
  mod.modResults.contents = raisePodsDeploymentTarget(mod.modResults.contents);
  return mod;
});

module.exports = withPodsDeploymentTarget;
module.exports.raisePodsDeploymentTarget = raisePodsDeploymentTarget;
