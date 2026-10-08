/**
 * What each agent is asked. Every answer ends in one marker line the
 * supervisor reads — RESULT for the developer, VERDICT for the reviewer. An
 * answer without one is treated as no answer, never guessed at.
 */

const DEVELOPER_RULES = `Правила — CLAUDE.md и audit/HANDOFF_CLAUDE.md (метод, планка, «красное до»): исправляй причину, а не симптом; тест сначала должен упасть на старом коде.
Ты в рабочем дереве супервизора, ветка auto/main. Коммить сам: сообщения по-английски, как в репозитории, последней строкой «Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>». Не пушь и не переключай ветки — это делает супервизор.
Не трогай: production, rehearsly.me, server/.env и любые ключи, миграции и схему БД, авторизацию, деплой, tools/autodev, .claude. Если задача без этого не решается — остановись и ответь BLOCKED с причиной.
Механические проверки после тебя запустит супервизор: npm run check:secrets, type-check, npm test; при изменениях клиента — npm run e2e; при изменениях сервера — PG-проверки. Запускай их и сам, пока работаешь.`;

const DEVELOPER_END = `В конце ответа — короткий отчёт для владельца по-русски: что сделано, какие коммиты, чем проверено. Последней строкой ровно одно из:
RESULT: DONE
RESULT: BLOCKED: <причина>`;

export function developTask(task) {
  return `Задача ${task.id}: ${task.title}

${task.body}

${DEVELOPER_RULES}

${DEVELOPER_END}`;
}

export function fixChecks(task, steps) {
  const failed = steps.filter((step) => !step.ok);
  return `Задача ${task.id}: проверки супервизора упали.

${failed.map((step) => `### ${step.name} (код ${step.code})\n\`\`\`\n${step.tail}\n\`\`\``).join('\n\n')}

Найди причину и исправь. ${DEVELOPER_END}`;
}

export function fixReview(task, review) {
  return `Задача ${task.id}: ревьюер (Астра) вернул замечания.

${review}

Исправь то, что выше планки, по причине; что ниже — исправь, если то же правило покрывает, иначе объясни в отчёте. ${DEVELOPER_END}`;
}

export const CONTINUE = `Сессию прервал лимит подписки или сбой. Продолжай ровно с того места, где остановился, ничего не повторяя. ${DEVELOPER_END}`;

export function review(task, { base, head, devReport, checks, round }) {
  return `Ты — ревьюер (Астра) в автономном цикле разработки Rehearsly. Это ${round === 1 ? 'первый' : 'второй и последний'} круг ревью задачи ${task.id} «${task.title}».

Дерево уже стоит на ${head} (detached). Проверяй диапазон ${base}..${head}: git log ${base}..${head}, git diff ${base}..${head}.

Задача:
${task.body}

Отчёт разработчика:
${devReport}

Механические проверки супервизора (их запускал он сам, не разработчик):
${checks.steps.map((step) => `- ${step.name}: ${step.ok ? 'PASS' : `FAIL (код ${step.code})`}`).join('\n')}

Метод и планка — audit/HANDOFF_CLAUDE.md §4: каждой находке — клетка планки. Проверь, что исправлена причина, что «красное до» действительно падало на старом коде, что нет регресса. Код и файлы не меняй, коммитов нет. production, rehearsly.me, server/.env — не трогай.

Ответ по-русски: замечания (или «замечаний нет»). Последней строкой ровно одно из:
VERDICT: ACCEPT
VERDICT: CHANGES`;
}

export const REVIEW_CONTINUE = 'Сессию прервал лимит подписки или сбой. Продолжай ревью с того места, где остановилась. Последней строкой — VERDICT: ACCEPT или VERDICT: CHANGES.';

/** The developer's marker: {done} | {blocked, reason} | null when absent. */
export function readResult(text) {
  const lines = String(text).trim().split('\n').map((line) => line.trim()).filter(Boolean);
  const last = lines.at(-1) ?? '';
  if (/^RESULT:\s*DONE$/i.test(last)) return { done: true };
  const blocked = /^RESULT:\s*BLOCKED:?\s*(.*)$/i.exec(last);
  if (blocked) return { blocked: true, reason: blocked[1] || 'без причины' };
  return null;
}

/** The reviewer's marker: 'accept' | 'changes' | null when absent. */
export function readVerdict(text) {
  const lines = String(text).trim().split('\n').map((line) => line.trim()).filter(Boolean);
  const m = /^VERDICT:\s*(ACCEPT|CHANGES)$/i.exec(lines.at(-1) ?? '');
  return m ? m[1].toLowerCase() : null;
}
