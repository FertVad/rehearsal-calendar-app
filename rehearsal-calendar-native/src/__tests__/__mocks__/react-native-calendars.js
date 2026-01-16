/**
 * React Native Calendars Mock for Jest
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

// Mock LocaleConfig as a mutable object
const LocaleConfig = {
  locales: {
    en: {
      monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
      monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
      dayNamesShort: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
      today: 'Today',
    },
    ru: {
      monthNames: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
      monthNamesShort: ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'],
      dayNames: ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'],
      dayNamesShort: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'],
      today: 'Сегодня',
    },
  },
  defaultLocale: 'en',
};

module.exports = {
  Calendar,
  LocaleConfig,
  DateData: {},
  CalendarList: Calendar,
  Agenda: Calendar,
  ExpandableCalendar: Calendar,
  WeekCalendar: Calendar,
  Timeline: Calendar,
};
