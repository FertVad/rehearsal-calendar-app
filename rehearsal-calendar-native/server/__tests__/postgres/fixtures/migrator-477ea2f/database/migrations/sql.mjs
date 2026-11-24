import { fail } from './errors.mjs';

// A statement-boundary check for our curated PostgreSQL artifacts, not a SQL
// parser/security sandbox. It prevents accidental outer-transaction/session
// commands. Executing arbitrary or adversarial SQL is not supported.
export function validateTransactionalSQL(sql) {
  let position = 0;
  let words = [];
  function finish() {
    const first = words[0];
    if (['BEGIN', 'START', 'COMMIT', 'END', 'ROLLBACK', 'ABORT', 'SAVEPOINT', 'RELEASE',
      'PREPARE', 'SET', 'RESET', 'DISCARD', 'VACUUM', 'CALL', 'COPY'].includes(first)
      || words.includes('CONCURRENTLY')
      || (['CREATE', 'DROP', 'ALTER'].includes(first) && ['DATABASE', 'SYSTEM', 'TABLESPACE'].includes(words[1]))) {
      fail('ARTIFACT_INVALID', 2);
    }
    words = [];
  }
  while (position < sql.length) {
    const char = sql[position];
    if (/\s/.test(char)) { position++; continue; }
    if (sql.startsWith('--', position)) {
      const end = sql.indexOf('\n', position + 2); position = end === -1 ? sql.length : end + 1; continue;
    }
    if (sql.startsWith('/*', position)) {
      position += 2; let depth = 1;
      while (position < sql.length && depth) {
        if (sql.startsWith('/*', position)) { depth++; position += 2; }
        else if (sql.startsWith('*/', position)) { depth--; position += 2; }
        else position++;
      }
      if (depth) fail('ARTIFACT_INVALID', 2);
      continue;
    }
    if (char === "'" || char === '"') {
      const escaped = char === "'" && /(?:^|[^a-z0-9_])e$/i.test(sql.slice(Math.max(0, position - 2), position));
      position++; let closed = false;
      while (position < sql.length) {
        if (escaped && sql[position] === '\\') { position += 2; continue; }
        if (sql[position] === char) {
          if (sql[position + 1] === char) { position += 2; continue; }
          position++; closed = true; break;
        }
        // Ordinary literal backslash interpretation depends on server settings;
        // our curated artifacts do not need that ambiguous spelling.
        if (!escaped && char === "'" && sql[position] === '\\') fail('ARTIFACT_INVALID', 2);
        position++;
      }
      if (!closed) fail('ARTIFACT_INVALID', 2);
      continue;
    }
    if (char === '$') {
      const tag = /^(?:\$\$|\$[a-z_][a-z0-9_]*\$)/i.exec(sql.slice(position))?.[0];
      if (tag) {
        const end = sql.indexOf(tag, position + tag.length);
        if (end === -1) fail('ARTIFACT_INVALID', 2);
        position = end + tag.length; continue;
      }
    }
    if (char === ';') { finish(); position++; continue; }
    const word = /^[a-z_][a-z0-9_$]*/i.exec(sql.slice(position))?.[0];
    if (word) { words.push(word.toUpperCase()); position += word.length; }
    else position++;
  }
  finish();
}
