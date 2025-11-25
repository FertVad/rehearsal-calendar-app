import format from 'date-fns/format';
import enUS from 'date-fns/locale/en-US';
import ru from 'date-fns/locale/ru';

export function formatActors(actorNames = []) {
  return (actorNames || []).join(', ');
}

const timeTextEn = (start, end) => (start && end ? `from ${start} to ${end}` : 'All day');
const timeTextRu = (start, end) => (start && end ? `с ${start} до ${end}` : 'Весь день');

export function formatDateEn(date) {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'd MMMM yyyy', { locale: enUS });
  } catch {
    return String(date);
  }
}

export function formatDateRu(date) {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return format(d, 'd MMMM yyyy', { locale: ru });
  } catch {
    return String(date);
  }
}

function baseTemplate(title, { date, startTime, endTime, scene, actors }, lang = 'en') {
  const isRu = lang === 'ru';
  const formatDate = isRu ? formatDateRu : formatDateEn;
  const timeText = isRu ? timeTextRu : timeTextEn;

  const lines = [
    title,
    '',
    `📅 ${formatDate(date)}`,
    `⏰ ${timeText(startTime, endTime)}`,
  ];
  const actorsLine = formatActors(actors);
  if (actorsLine) {
    lines.push(`👥 ${actorsLine}`);
  }
  if (scene) {
    lines.push('');
    lines.push(isRu ? `📍 Локация: ${scene}` : `📍 Location: ${scene}`);
  }
  return lines.join('\n');
}

export function formatRehearsalCreated(data, lang = 'en') {
  const title = lang === 'ru' ? '❗ Новая репетиция' : '❗ New Rehearsal';
  return baseTemplate(title, data, lang);
}

export function formatRehearsalUpdated(data, lang = 'en') {
  const title = lang === 'ru' ? '❗ Репетиция обновлена' : '❗ Rehearsal Updated';
  return baseTemplate(title, data, lang);
}

export function formatRehearsalDeleted(data, lang = 'en') {
  const title = lang === 'ru' ? '❗ Репетиция отменена' : '❗ Rehearsal Cancelled';
  return baseTemplate(title, data, lang);
}
