/**
 * Where a setting is, in the labels the app shows on the way to it:
 * "Профиль → Выходные заняты". One piece that never breaks inside a line —
 * no-break spaces inside each label and around "→" (T-408): "Профиль →" at the
 * end of one line and the switch's name on the next is not a path one finds.
 */
const NBSP = '\u00a0';

export const settingPath = (...labels: string[]): string =>
  labels.map((label) => label.replace(/ /g, NBSP)).join(`${NBSP}→${NBSP}`);
