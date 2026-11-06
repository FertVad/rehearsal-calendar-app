// T-046: where each dependency knip calls "unlisted" comes from.
// node audit/evidence/T-046/deps-origin.mjs  (from the repository root)
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const app = 'rehearsal-calendar-native';
const server = join(app, 'server');
const pkg = (dir, name) => {
  const file = join(dir, 'node_modules', name, 'package.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
};
const declares = (dir, owner, dep) => {
  const p = pkg(dir, owner);
  if (!p) return `${owner}: not installed`;
  for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
    if (p[field]?.[dep]) return `${owner}@${p.version} ${field}.${dep} = ${p[field][dep]}`;
  }
  return `${owner}@${p.version}: does not declare ${dep}`;
};
const installed = (dir, name) => {
  const p = pkg(dir, name);
  return p ? `${name}@${p.version} installed in ${dir}/node_modules` : `${name}: NOT installed in ${dir}`;
};

const lines = [
  installed(server, '@jest/globals'),
  declares(server, 'jest', '@jest/globals'),
  declares(server, '@jest/core', '@jest/globals'),
  declares(server, 'jest-runtime', '@jest/globals'),
  installed(server, 'node-fetch'),
  declares(server, 'apple-signin-auth', 'node-fetch'),
  declares(server, 'gaxios', 'node-fetch'),
  installed(app, '@react-navigation/routers'),
  installed(app, '@react-navigation/core'),
  declares(app, '@react-navigation/native', '@react-navigation/core'),
  declares(app, '@react-navigation/core', '@react-navigation/routers'),
  installed(app, '@eslint/js'),
  declares(app, 'eslint', '@eslint/js'),
  installed(app, 'metro'),
  installed(app, '@expo/metro-config'),
  declares(app, 'expo', '@expo/metro-config'),
  installed(join(app, 'node_modules', 'expo'), '@expo/metro-config'),
  declares(join(app, 'node_modules', 'expo'), '@expo/metro-config', 'metro'),
  declares(join(app, 'node_modules', 'expo'), '@expo/cli', 'metro'),
  declares(app, '@expo/cli', 'metro'),
  declares(app, '@react-native/community-cli-plugin', 'metro'),
  declares(app, '@react-native/metro-config', 'metro'),
  declares(app, 'metro-transform-worker', 'metro-minify-terser'),
  installed(app, 'metro-minify-terser'),
  installed(app, 'expo-updates'),
  installed(app, 'expo-system-ui'),
];
console.log(lines.join('\n'));
