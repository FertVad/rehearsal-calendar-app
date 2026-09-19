import { jest } from '@jest/globals';

// Location-only database substitution with call-through observation, including
// the owned transaction handle. No query result or admission is fabricated.
export function observeDatabase(getAdapter) {
  const statements = [];
  const transactions = [];
  const wrap = (getHandle, scope) => {
    const handle = Object.fromEntries(['get', 'all', 'run'].map(method => [method, jest.fn((sql, params = []) => {
      statements.push({ method, sql, params, scope,
        activeTransactions: transactions.filter(transaction => transaction.state === 'active').length });
      return getHandle()[method](sql, params);
    })]));
    handle.transaction = jest.fn(async callback => {
      const transaction = { state: 'active' };
      transactions.push(transaction);
      try {
        const result = await getHandle().transaction(tx => callback(wrap(() => tx, transaction)));
        transaction.state = 'committed';
        return result;
      } catch (error) {
        transaction.state = 'rolled-back';
        throw error;
      }
    });
    return handle;
  };
  const database = wrap(getAdapter, null);
  return { database, statements, transactions, clear() {
    statements.length = 0;
    transactions.length = 0;
    Object.values(database).forEach(fn => fn.mockClear());
  } };
}

export const operationBudgetTables = new Set([
  'native_operation_ip_rate_limits', 'native_operation_ip_rate_limit_gates',
]);

// Allow only statements whose native tables AND SQL relation references are
// these two tables (plus their local clock CTE). A business query that merely
// mentions a budget table is not exempted from no-business-SQL assertions.
export function isOperationBudgetSql({ sql }) {
  const text = sql.replace(/\s+/g, ' ').trim();
  if (/^SET LOCAL (?:lock_timeout = '1s'|statement_timeout = '2s')$/i.test(text)) return true;
  const nativeNames = [...text.matchAll(/\bnative_[a-z_]+\b/gi)].map(match => match[0].toLowerCase());
  const relations = [...text.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE)\s+([a-z_][a-z_0-9]*)/gi)]
    .map(match => match[1].toLowerCase());
  return nativeNames.length > 0 && nativeNames.every(name => operationBudgetTables.has(name))
    && relations.length > 0 && relations.every(name => name === 'db_clock' || operationBudgetTables.has(name));
}
