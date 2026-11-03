// Prints the elements of a Maestro screen hierarchy whose text, label or id
// match a regex, with their bounds. node hierarchy-scan.mjs <file.json> <regex>
import { readFileSync } from 'node:fs';

const [file, pattern] = process.argv.slice(2);
const re = new RegExp(pattern);
const walk = (node, depth) => {
  const a = node.attributes || {};
  const said = [a.text, a.accessibilityText, a['resource-id'], a.hintText].filter(Boolean).join(' | ');
  if (re.test(said)) console.log(depth, a.bounds, JSON.stringify(said).slice(0, 160));
  (node.children || []).forEach((child) => walk(child, depth + 1));
};
walk(JSON.parse(readFileSync(file, 'utf8')), 0);
