/**
 * Transactions have to hold one connection.
 *
 * Two routes used to issue BEGIN through the ordinary run(), which on
 * PostgreSQL goes through pool.query: a client is checked out, the statement
 * runs, the client goes straight back to the pool — still inside the
 * transaction. The failure that follows is not the obvious one. It is not that
 * the rollback misses; it is that the next request handed that connection joins
 * a transaction it never opened, and the first request's ROLLBACK throws away
 * the bystander's write. Two writes arrive, one vanishes, neither side sees an
 * error.
 *
 * Reproduced against the real pool: BEGIN, an unrelated INSERT, ROLLBACK — the
 * unrelated row was gone.
 *
 * These run on SQLite, so what they can check is the contract every caller
 * depends on: the callback gets a connection-bound handle, a throw undoes the
 * lot, and a return commits it.
 */
import { setupIntegrationDb, closeIntegrationDb } from '../integration/setup.js';

let db;

beforeAll(async () => {
  db = await setupIntegrationDb();
  db.run(`CREATE TABLE IF NOT EXISTS tx_probe (id INTEGER PRIMARY KEY AUTOINCREMENT, note TEXT)`);
});

afterAll(() => closeIntegrationDb());

beforeEach(() => db.run('DELETE FROM tx_probe'));

const notes = () => db.all('SELECT note FROM tx_probe').map((r) => r.note);

describe('db.transaction', () => {
  it('keeps the writes when the callback returns', async () => {
    await db.transaction(async (tx) => {
      await tx.run(`INSERT INTO tx_probe (note) VALUES (?)`, ['первая']);
      await tx.run(`INSERT INTO tx_probe (note) VALUES (?)`, ['вторая']);
    });

    expect(notes()).toEqual(['первая', 'вторая']);
  });

  it('undoes them all when the callback throws', async () => {
    // Half of an account deletion is worse than none: the projects would be
    // gone and the user still there.
    await expect(
      db.transaction(async (tx) => {
        await tx.run(`INSERT INTO tx_probe (note) VALUES (?)`, ['первая']);
        throw new Error('на середине');
      })
    ).rejects.toThrow('на середине');

    expect(notes()).toEqual([]);
  });

  it('passes the failure on rather than swallowing it', async () => {
    await expect(db.transaction(async () => Promise.reject(new Error('вниз')))).rejects.toThrow('вниз');
  });

  it('gives back whatever the callback returned', async () => {
    // The deletion route needs the list of projects it removed, and reading it
    // outside the transaction would be reading after the rows are gone.
    const result = await db.transaction(async (tx) => {
      await tx.run(`INSERT INTO tx_probe (note) VALUES (?)`, ['одна']);
      return tx.all('SELECT note FROM tx_probe');
    });

    expect(result.map((r) => r.note)).toEqual(['одна']);
  });

  it('hands the callback a handle that can read as well as write', async () => {
    // Reading through the outer db instead would be reading from a different
    // connection, which cannot see the transaction's own uncommitted rows.
    const seen = await db.transaction(async (tx) => {
      await tx.run(`INSERT INTO tx_probe (note) VALUES (?)`, ['ещё не зафиксирована']);
      return tx.get('SELECT note FROM tx_probe');
    });

    expect(seen.note).toBe('ещё не зафиксирована');
  });

  it('leaves the connection usable afterwards', async () => {
    // A transaction left open is what holds locks and strands the next caller.
    await expect(
      db.transaction(async () => {
        throw new Error('упало');
      })
    ).rejects.toThrow();

    await db.run(`INSERT INTO tx_probe (note) VALUES (?)`, ['после падения']);
    expect(notes()).toEqual(['после падения']);
  });
});
