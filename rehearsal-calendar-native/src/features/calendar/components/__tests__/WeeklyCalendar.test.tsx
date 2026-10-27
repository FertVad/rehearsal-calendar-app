/**
 * "Today" in the week strip selects today, not only today's week (cause fix
 * 22: DD03). The strip scrolled back and left the day picked before selected,
 * so the list under it went on showing that day. The owner of the selection is
 * written as CalendarScreen holds it: until a day is picked, the day is today.
 */
import React, { useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import WeeklyCalendar from '../WeeklyCalendar';

jest.mock('../../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../../i18n/translations').translations.en, language: 'en' }),
}));
jest.mock('../../../../shared/hooks/useClock', () => ({ useToday: () => '2030-01-10' }));
jest.mock('../../../../hooks/useWeekStart', () => ({
  ...jest.requireActual('../../../../hooks/useWeekStart'),
  useWeekStart: () => 'monday',
}));

function Calendar() {
  const [picked, setPicked] = useState<string | null>(null);
  const selectedDate = picked ?? '2030-01-10';
  return (
    <>
      <Text testID="selected">{selectedDate}</Text>
      {/* A day tapped in the strip, two days on. */}
      <TouchableOpacity testID="pick" onPress={() => setPicked('2030-01-12')} />
      <WeeklyCalendar
        rehearsals={[]}
        onDaySelect={setPicked}
        onShowToday={() => setPicked(null)}
        selectedDate={selectedDate}
      />
    </>
  );
}

it('selects today when "Today" is pressed after another day was picked', () => {
  const screen = render(<Calendar />);
  fireEvent.press(screen.getByTestId('pick'));
  expect(screen.getByTestId('selected').props.children).toBe('2030-01-12');

  fireEvent.press(screen.getByText('Today'));

  expect(screen.getByTestId('selected').props.children).toBe('2030-01-10');
});
