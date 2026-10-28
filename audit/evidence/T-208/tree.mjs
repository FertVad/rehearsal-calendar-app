// Prints a Maestro screen-hierarchy dump as an indented tree (T-208).
// node tree.mjs <hierarchy.json> [max depth]
import { readFileSync } from 'node:fs';

const [file, maxDepth = '40'] = process.argv.slice(2);
const root = JSON.parse(readFileSync(file, 'utf8'));
const walk = (node, depth) => {
  const a = node.attributes || {};
  const text = [a.text, a.accessibilityText, a['resource-id'], a.bounds].filter(Boolean).join(' | ');
  console.log(' '.repeat(depth) + text);
  if (depth < Number(maxDepth)) (node.children || []).forEach((child) => walk(child, depth + 1));
};
walk(root, 0);
