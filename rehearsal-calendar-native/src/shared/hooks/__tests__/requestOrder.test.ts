/**
 * Reads and changes of one piece of state, in one order (cause fix 12: HN02,
 * NI04, review).
 *
 * A change is on its way from the moment it is sent until the server has
 * answered. A read that answers inside that time, or began before it ended,
 * may hold the state from before the change; the rule drops it. Each order a
 * slow request can produce is pinned here once, for every store that uses it.
 */
import { renderHook } from '@testing-library/react-native';
import { useRequestOrder } from '../useSession';
import { changeOwner, resetSessionForTests } from '../../services/session';

function held<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

const setup = () => renderHook(() => useRequestOrder()).result.current;

beforeEach(() => resetSessionForTests());

describe('a read and a change of the same key', () => {
  it('drops a read that answers while the change is on its way', async () => {
    const order = setup();
    const sent = held();
    const writing = order.write(() => sent.promise);

    const answer = order.beginRead();
    expect(answer()).toBe(false);

    sent.resolve();
    await writing;
  });

  it('drops a read that began while the change was on its way and answers after it', async () => {
    const order = setup();
    const sent = held();
    const writing = order.write(() => sent.promise);
    const answer = order.beginRead();

    sent.resolve();
    await writing;

    expect(answer()).toBe(false);
  });

  it('drops a read that began before the change and answers after it', async () => {
    const order = setup();
    const answer = order.beginRead();
    await order.write(async () => {});

    expect(answer()).toBe(false);
  });

  it('drops a read that began before a change that failed', async () => {
    const order = setup();
    const answer = order.beginRead();
    await expect(order.write(() => Promise.reject(new Error('offline')))).rejects.toThrow('offline');

    expect(answer()).toBe(false);
  });

  it('lands a read that began after the change was answered', async () => {
    const order = setup();
    await order.write(async () => {});

    expect(order.beginRead()()).toBe(true);
  });

  it('lands the change\'s answer after a read answered while it was out', async () => {
    const order = setup();
    const sent = held();
    let landed: boolean | undefined;
    const writing = order.write(async (answer) => { await sent.promise; landed = answer(); });

    expect(order.beginRead()()).toBe(false);
    sent.resolve();
    await writing;

    expect(landed).toBe(true);
  });
});

describe('answers among themselves', () => {
  it('lands the newer read and drops the older that answers after it', () => {
    const order = setup();
    const older = order.beginRead();
    const newer = order.beginRead();

    expect(newer()).toBe(true);
    expect(older()).toBe(false);
  });

  it('lands both reads when they answer in the order they were asked', () => {
    const order = setup();
    const older = order.beginRead();
    const newer = order.beginRead();

    expect(older()).toBe(true);
    expect(newer()).toBe(true);
  });

  it('keeps the answer of the change sent last, whichever answers first', async () => {
    const order = setup();
    const first = held();
    const second = held();
    const landed: string[] = [];
    const one = order.write(async (answer) => { await first.promise; if (answer()) landed.push('first'); });
    const two = order.write(async (answer) => { await second.promise; if (answer()) landed.push('second'); });

    second.resolve();
    await two;
    first.resolve();
    await one;

    expect(landed).toEqual(['second']);
  });

  it('lands the earlier change\'s answer when the later one failed', async () => {
    const order = setup();
    const first = held();
    const landed: string[] = [];
    const one = order.write(async (answer) => { await first.promise; if (answer()) landed.push('first'); });
    await expect(order.write(() => Promise.reject(new Error('offline')))).rejects.toThrow();

    first.resolve();
    await one;

    expect(landed).toEqual(['first']);
  });
});

describe('keys', () => {
  it('lets a read land on a key no change touched', async () => {
    const order = setup();
    const sent = held();
    const writing = order.write(() => sent.promise, 'r1');

    const answer = order.beginRead();
    expect(answer('r1')).toBe(false);
    expect(answer('r2')).toBe(true);

    sent.resolve();
    await writing;
  });
});

describe('sessions', () => {
  it('lands nothing asked in a session that has ended', async () => {
    await changeOwner('u1');
    const order = setup();
    const answer = order.beginRead();
    let landed: boolean | undefined;
    const sent = held();
    const writing = order.write(async (check) => { await sent.promise; landed = check(); });

    await changeOwner('u2');
    sent.resolve();
    await writing;

    expect(answer()).toBe(false);
    expect(landed).toBe(false);
  });
});
