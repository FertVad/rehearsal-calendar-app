/**
 * The shared "seen" store.
 *
 * What matters here is the behaviour that per-screen copies of this state kept
 * getting wrong: the toggle's two vocabularies ('no' on the wire, null in
 * state), an optimistic update that must survive a failure by being undone, and
 * priming a second list without erasing the first.
 */
import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { SeenProvider, useSeen } from '../SeenContext';

const mockRespond = jest.fn();

jest.mock('../../shared/services/api', () => ({
  rehearsalsAPI: {
    respond: (...args: any[]) => mockRespond(...args),
  },
}));

jest.mock('../I18nContext', () => ({
  useI18n: () => ({
    t: { common: { error: 'Error' }, rehearsals: { seenError: 'Could not save' } },
  }),
}));

const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});

/** Renders the store's answers for one rehearsal, with a button that toggles it. */
function Probe({ id = '42' }: { id?: string }) {
  const { responseFor, statsFor, isResponding, toggleSeen, prime } = useSeen();

  return (
    <>
      <Text testID="response">{String(responseFor(id))}</Text>
      <Text testID="stats">{statsFor(id) ? `${statsFor(id)!.confirmed}/${statsFor(id)!.invited}` : 'none'}</Text>
      <Text testID="busy">{String(isResponding(id))}</Text>
      <TouchableOpacity testID="toggle" onPress={() => toggleSeen(id)}>
        <Text>toggle</Text>
      </TouchableOpacity>
      <TouchableOpacity testID="prime-other" onPress={() => prime({ '99': 'yes' })}>
        <Text>prime</Text>
      </TouchableOpacity>
    </>
  );
}

const renderProbe = (id?: string) =>
  render(
    <SeenProvider>
      <Probe id={id} />
    </SeenProvider>
  );

beforeEach(() => {
  mockRespond.mockReset();
  mockRespond.mockResolvedValue({ data: { confirmed: 3, invited: 5 } });
  alertSpy.mockClear();
});

describe('Seen store', () => {
  it('starts with nothing seen', () => {
    const { getByTestId } = renderProbe();
    expect(getByTestId('response').props.children).toBe('null');
    expect(getByTestId('stats').props.children).toBe('none');
  });

  it('marks a rehearsal seen straight away, before the server answers', async () => {
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('toggle'));

    expect(getByTestId('response').props.children).toBe('yes');
    await waitFor(() => expect(mockRespond).toHaveBeenCalled());
  });

  it("sends 'yes' on the wire when marking seen", async () => {
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('toggle'));

    await waitFor(() => expect(mockRespond).toHaveBeenCalledWith('42', 'yes'));
  });

  it("sends 'no', not a deletion, when unmarking", async () => {
    // 'no' means invited and not yet seen. Having a row at all is what puts you
    // on the rehearsal, so unmarking must never remove it.
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('toggle'));
    await waitFor(() => expect(mockRespond).toHaveBeenCalledWith('42', 'yes'));

    fireEvent.press(getByTestId('toggle'));
    await waitFor(() => expect(mockRespond).toHaveBeenLastCalledWith('42', 'no'));
  });

  it('shows null in state for unseen, never the wire value', async () => {
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('toggle'));
    await waitFor(() => expect(getByTestId('response').props.children).toBe('yes'));

    fireEvent.press(getByTestId('toggle'));
    await waitFor(() => expect(getByTestId('response').props.children).toBe('null'));
  });

  it('takes the counts the server reports back', async () => {
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('toggle'));

    await waitFor(() => expect(getByTestId('stats').props.children).toBe('3/5'));
  });

  it('puts it back when the request fails', async () => {
    mockRespond.mockRejectedValueOnce(new Error('offline'));
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('toggle'));
    expect(getByTestId('response').props.children).toBe('yes');

    await waitFor(() => expect(getByTestId('response').props.children).toBe('null'));
    expect(alertSpy).toHaveBeenCalled();
  });

  it('reports the toggle as in flight and then done', async () => {
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('toggle'));
    expect(getByTestId('busy').props.children).toBe('true');

    await waitFor(() => expect(getByTestId('busy').props.children).toBe('false'));
  });

  it('keeps what it knows when another list primes it', async () => {
    // A list covering one project must not erase what is known about another.
    const { getByTestId } = renderProbe();

    fireEvent.press(getByTestId('toggle'));
    await waitFor(() => expect(getByTestId('response').props.children).toBe('yes'));

    await act(async () => {
      fireEvent.press(getByTestId('prime-other'));
    });

    expect(getByTestId('response').props.children).toBe('yes');
  });
});
