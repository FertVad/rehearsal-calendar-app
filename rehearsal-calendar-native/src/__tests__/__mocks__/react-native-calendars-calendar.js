/**
 * The month grid of react-native-calendars for Jest:
 * `react-native-calendars/src/calendar`, the file the app imports it from. The
 * library's entry file requires all its calendars, lodash and moment with
 * them (T-242). Its LocaleConfig is not mocked: profileCalendar.tsx takes the
 * library's own XDate.
 */

const React = require('react');

// Mock Calendar component with proper event handling
const Calendar = React.forwardRef((props, ref) => {
  const {
    onDayPress,
    onDayLongPress,
    onMonthChange,
    markedDates,
    minDate,
    maxDate,
    markingType,
    theme,
    ...otherProps
  } = props;

  // Create a simple mock calendar that renders dates if needed by tests
  return React.createElement(
    'View',
    {
      ...otherProps,
      ref,
      testID: 'calendar',
      'data-marked-dates': markedDates ? JSON.stringify(markedDates) : undefined,
      'data-min-date': minDate,
      'data-max-date': maxDate,
    },
    'Calendar'
  );
});

Calendar.displayName = 'Calendar';

module.exports = { __esModule: true, default: Calendar };
