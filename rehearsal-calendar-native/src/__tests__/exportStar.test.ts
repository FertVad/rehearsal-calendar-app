/**
 * `export * from` never points at a module with no named exports (T-245).
 *
 * `export *` carries named exports only, never `export default`. The editor's
 * index.ts re-exported TimeSlotsEditor and ModeSelector that way: both had only
 * a default export, so nothing came out of the line — and yet knip counted both
 * files as used through it, and two components that no screen drew stayed in
 * the app with their tests. shared/components/index.ts did the same with an
 * empty animations/index.ts. Such a line passes the module along to no one and
 * hides it from the dead-code check, so it is an error here.
 */
import { readdirSync, statSync } from 'fs';
import { dirname, join, relative } from 'path';
import ts from 'typescript';

const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : sources(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

function compilerOptions(): ts.CompilerOptions {
  const configPath = join(ROOT, 'tsconfig.json');
  const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
  return ts.parseJsonConfigFileContent(config, ts.sys, dirname(configPath)).options;
}

function findings(): string[] {
  const program = ts.createProgram(sources(SRC), { ...compilerOptions(), noEmit: true });
  const checker = program.getTypeChecker();
  const out: string[] = [];
  for (const file of program.getSourceFiles()) {
    if (!file.fileName.startsWith(SRC + '/') || file.fileName.includes('/__tests__/')) continue;
    for (const statement of file.statements) {
      if (!ts.isExportDeclaration(statement) || statement.exportClause || !statement.moduleSpecifier) continue;
      const target = (statement.moduleSpecifier as ts.StringLiteral).text;
      const where = `${relative(SRC, file.fileName)}:${file.getLineAndCharacterOfPosition(statement.getStart()).line + 1}`;
      const module = checker.getSymbolAtLocation(statement.moduleSpecifier);
      if (!module) {
        out.push(`${where} — export * from '${target}': the module has no exports at all`);
        continue;
      }
      const named = checker.getExportsOfModule(module).filter((s) => s.escapedName !== 'default');
      if (named.length === 0) {
        out.push(`${where} — export * from '${target}': nothing but a default export (or nothing), so nothing is re-exported`);
      }
    }
  }
  return out;
}

it('every export * re-exports something', () => {
  expect(findings()).toEqual([]);
}, 120000);
