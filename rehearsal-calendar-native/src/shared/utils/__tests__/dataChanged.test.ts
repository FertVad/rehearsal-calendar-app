/**
 * The signal that says "reload if you are showing this".
 *
 * Screens reload when they gain focus, and a screen already in focus never
 * gains it again — so a rehearsal announced by a push while the calendar was
 * open did not appear until the app was restarted. That looked worse once the
 * calendar event itself started arriving straight away: the phone's calendar
 * knew and the app did not.
 */
import { onDataChanged, emitDataChanged } from '../dataChanged';

describe('Telling screens something changed', () => {
  it('reaches a listener', () => {
    const reload = jest.fn();
    onDataChanged('rehearsals', reload);

    emitDataChanged('rehearsals');

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('reaches every listener, not just the first', () => {
    const a = jest.fn();
    const b = jest.fn();
    onDataChanged('rehearsals', a);
    onDataChanged('rehearsals', b);

    emitDataChanged('rehearsals');

    expect(a).toHaveBeenCalled();
    expect(b).toHaveBeenCalled();
  });

  it('stops reaching one that unsubscribed', () => {
    // A screen that has gone away must not be asked to reload, or it sets state
    // on something unmounted.
    const gone = jest.fn();
    const unsubscribe = onDataChanged('rehearsals', gone);

    unsubscribe();
    emitDataChanged('rehearsals');

    expect(gone).not.toHaveBeenCalled();
  });

  it('carries on when one listener throws', () => {
    // One screen failing to reload must not stop the others.
    const second = jest.fn();
    onDataChanged('rehearsals', () => {
      throw new Error('this screen is unhappy');
    });
    onDataChanged('rehearsals', second);

    expect(() => emitDataChanged('rehearsals')).not.toThrow();
    expect(second).toHaveBeenCalled();
  });

  it('is quiet when nobody is listening', () => {
    expect(() => emitDataChanged('rehearsals')).not.toThrow();
  });
});
