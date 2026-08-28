/**
 * The handover between a tapped notification and the calendar.
 *
 * It exists because three navigator-based attempts each failed differently, so
 * what matters here is that it is dull: set it, read it once, and be told when
 * it arrives.
 */
import {
  setPendingRehearsal,
  consumePendingRehearsal,
  hasPendingRehearsal,
  subscribePendingRehearsal,
} from '../pendingRehearsal';

beforeEach(() => {
  consumePendingRehearsal();
});

describe('pendingRehearsal', () => {
  it('hands over the id that was set', () => {
    setPendingRehearsal(42);
    expect(consumePendingRehearsal()).toBe('42');
  });

  it('accepts a number or a string, and always answers with a string', () => {
    setPendingRehearsal('7');
    expect(consumePendingRehearsal()).toBe('7');
  });

  it('gives it up only once — a target is acted on and gone', () => {
    setPendingRehearsal(42);

    expect(consumePendingRehearsal()).toBe('42');
    expect(consumePendingRehearsal()).toBeNull();
  });

  it('answers null when nothing is waiting', () => {
    expect(consumePendingRehearsal()).toBeNull();
    expect(hasPendingRehearsal()).toBe(false);
  });

  it('keeps the newer target when two arrive before either is read', () => {
    setPendingRehearsal(1);
    setPendingRehearsal(2);

    expect(consumePendingRehearsal()).toBe('2');
  });

  it('tells a subscriber, for the calendar already on screen', () => {
    const listener = jest.fn();
    const unsubscribe = subscribePendingRehearsal(listener);

    setPendingRehearsal(42);

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('stops telling one that unsubscribed', () => {
    const listener = jest.fn();
    subscribePendingRehearsal(listener)();

    setPendingRehearsal(42);

    expect(listener).not.toHaveBeenCalled();
  });

  it('tells every subscriber, not just the first', () => {
    const one = jest.fn();
    const two = jest.fn();
    const stopOne = subscribePendingRehearsal(one);
    const stopTwo = subscribePendingRehearsal(two);

    setPendingRehearsal(42);

    expect(one).toHaveBeenCalledTimes(1);
    expect(two).toHaveBeenCalledTimes(1);
    stopOne();
    stopTwo();
  });
});
