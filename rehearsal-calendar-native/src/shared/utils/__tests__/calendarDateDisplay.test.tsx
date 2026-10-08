/**
 * A calendar date is shown as that date, wherever the reader is.
 *
 * `new Date('2026-09-10')` is midnight UTC — the evening of the 9th in New
 * York — so three places showed the day before west of UTC: the availability
 * editor's header, the period picker's From/To, and the rehearsal dates on a
 * project's page (which also knew only Russian and English). They read the
 * date with parseDateString now (CLAUDE.md, Timezone Handling).
 */
import React from 'react';
import { render } from '@testing-library/react-native';
import { EditorHeader } from '../../../features/availability/components/editor/EditorHeader';
import { DateRangePicker } from '../../components/DateRangePicker';
import { formatDate } from '../../../features/projects/screens/ProjectDetailScreen';

jest.mock('../../../contexts/I18nContext', () => ({
  useI18n: () => ({ t: require('../../../i18n/translations').translations.en, language: 'en' }),
}));

// jest.config.js runs every test in New York for this reason.
it('runs where the date and the instant disagree', () => {
  expect(new Date('2026-09-10').getDate()).toBe(9);
});

it('the availability editor names the day that was picked', () => {
  const { getByText } = render(<EditorHeader selectedCount={1} selectedDate="2026-09-10" onClear={jest.fn()} />);

  expect(getByText('September 10')).toBeTruthy();
});

it('the period picker shows the days of the period', () => {
  const { getByText } = render(
    <DateRangePicker visible onClose={jest.fn()} onConfirm={jest.fn()}
      initialStartDate={new Date(2026, 8, 10)} initialEndDate={new Date(2026, 8, 12)} />,
  );

  expect(getByText('Sep 10')).toBeTruthy();
  expect(getByText('Sep 12')).toBeTruthy();
});

it('a project page shows a rehearsal on its own date, in the reader\'s language', () => {
  expect(formatDate('2026-09-10', 'en')).toBe('Sep 10');
  expect(formatDate('2026-09-10', 'de')).toBe(
    new Date(2026, 8, 10).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }).replace(/\.$/, ''));
});
