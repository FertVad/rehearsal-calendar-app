/**
 * What each agent is asked. Every answer ends in one marker line the
 * supervisor reads — RESULT for the developer, VERDICT for the reviewer. An
 * answer without one is treated as no answer, never guessed at.
 *
 * Each developer step — develop, fix the checks, fix the review — is a fresh
 * session given the whole statement: the task, what its branch already holds,
 * and what this step is for. A session resumed after a limit or a crash is
 * told the same task again. T-108 ran one session through every round; it
 * compacted, a bare "continue" reached it after it had finished, and it took
 * up the next audit fix on its own, then the one after.
 */

const DEVELOPER_RULES = `Работай только над этой задачей. Следующие пункты аудита и любую другую работу не начинай — очередь ведёт супервизор, а сделанное вне задачи никто не проверит.
Правила — CLAUDE.md и audit/HANDOFF_CLAUDE.md (метод, планка, «красное до»): исправляй причину, а не симптом; тест сначала должен упасть на старом коде.
Ты в рабочем дереве супервизора, ветка auto/main. Коммить сам: сообщения по-английски, как в репозитории, последней строкой «Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>». Не пушь и не переключай ветки — это делает супервизор.
Не трогай: production, rehearsly.me, server/.env и любые ключи, миграции и схему БД, авторизацию, деплой, tools/autodev, .claude. Если задача без этого не решается — остановись и ответь BLOCKED с причиной.
Исправление, видное на экране, идёт вместе с e2e-сценарием, который это показывает: новый в e2e/flows или дополненный старый, с метками \`tags:\`. Сначала покажи его красным на старом коде (файлы правки — \`git restore --source=<база> -- <файлы>\`, прогон одного сценария, вывод — в audit/evidence, затем \`git restore --source=HEAD -- <файлы>\`). Правила — rehearsal-calendar-native/docs/e2e.md. Сервер, расписание, журнал — без сценария.
Механические проверки после тебя запустит супервизор: npm run check:secrets, type-check, npm test; при изменениях клиента — npm run e2e; при изменениях сервера — PG-проверки. Запускай их и сам, пока работаешь, кроме полного e2e (см. ниже).`;

// In every developer prompt, a resumed session included: it never sees the
// first one's rules again (T-108 stopped twice on this).
const TOOLING = `Как работать с командами (режим без вопросов: что не разрешено — отклоняется молча):
- Рабочий каталог — корень дерева. git вызывай без cd: \`git add …\`, \`git commit -m …\`. Связка «cd <папка> && git …» отклоняется всегда.
- В файлы пиши инструментом Write (каталоги он создаёт сам), не перенаправлением «>» и не mkdir. Вывод теста для доказательства — запусти тест, затем сохрани его вывод через Write.
- Node 22 уже первым в PATH, export не нужен. Свой скрипт запускай как \`node <файл>\`; python не разрешён. Тесты сервера: \`cd rehearsal-calendar-native/server && NODE_OPTIONS=--experimental-vm-modules npx jest …\`; клиента: \`cd rehearsal-calendar-native && npx jest --selectProjects frontend …\`.
- Всё делай на переднем плане: фоновых задач, мониторов и субагентов нет.
- Полный \`npm run e2e\` запускает супервизор: он идёт дольше 10 минут, и твою команду оборвут. Сам — только нужный сценарий: \`npm run e2e -- e2e/flows/<файл>.yaml\` с timeout 600000. Сбой машины (Docker, занятый порт, симулятор; код 75) — не ошибка задачи, его не чини.
- Чтение .env и ключей запрещено самой ОС — это не ошибка твоих команд.
- Отклонили команду — сделай то же другим способом и продолжай. RESULT: BLOCKED — только для решений владельца: миграции, авторизация, production, ключи; не из-за отклонённой команды.`;

const DEVELOPER_END = `В конце ответа — короткий отчёт для владельца по-русски: что сделано, какие коммиты, чем проверено. Последней строкой ровно одно из:
RESULT: DONE
RESULT: BLOCKED: <причина>`;

function statement(task, done) {
  return `Задача ${task.id}: ${task.title}

${task.body}${done ? `

По этой задаче в ветке уже есть коммиты:
${done}` : ''}`;
}

const STEP_GOAL = {
  develop: 'сделать задачу',
  port: 'перенести работу задачи на текущую ветку',
  'fix-checks': 'исправить то, на чём упали проверки супервизора',
  'fix-review': 'исправить замечания ревьюера',
};

/**
 * A task's kept commits that would not cherry-pick by themselves — every task
 * edits the shared tables in audit/, so a task brought back later conflicts
 * there (T-108, 2026-10-10). The developer ports them first, by meaning.
 */
function portFirst(port) {
  if (!port) return '';
  return `

Сначала перенеси на текущую ветку работу этой задачи из ${port.from} — коммиты по порядку:
${port.commits.map((sha) => `- ${sha.slice(0, 7)}`).join('\n')}
Каждый: \`git cherry-pick -x <коммит>\`. Сами они не легли${port.conflicts?.length ? ` (конфликт: ${port.conflicts.join(', ')})` : ''}. Конфликт разреши по смыслу: в общих таблицах audit/ (TRIAGE, REMEDIATION_STATUS) сохрани строки обеих сторон, в коде — сохрани и то, что уже есть в ветке, и то, что несёт задача. Затем \`git add <файлы>\` и \`git commit --no-edit\`. Переноси только эти коммиты.`;
}

export function developTask(task, done, port) {
  return `${statement(task, done)}${portFirst(port)}

${DEVELOPER_RULES}

${TOOLING}

${DEVELOPER_END}`;
}

export function fixChecks(task, steps, done, port) {
  const failed = steps.filter((step) => !step.ok);
  return `${statement(task, done)}${portFirst(port)}

Сейчас: проверки супервизора упали на этих коммитах.

${failed.map((step) => `### ${step.name} (код ${step.code})\n\`\`\`\n${step.tail}\n\`\`\``).join('\n\n')}

Найди причину и исправь — в рамках этой задачи.

${DEVELOPER_RULES}

${TOOLING}

${DEVELOPER_END}`;
}

export function fixReview(task, reviewText, done, port) {
  return `${statement(task, done)}${portFirst(port)}

Сейчас: ревьюер (Астра) вернул замечания к этим коммитам.

${reviewText}

Исправь то, что выше планки, по причине; что ниже — исправь, если то же правило покрывает, иначе объясни в отчёте.

${DEVELOPER_RULES}

${TOOLING}

${DEVELOPER_END}`;
}

/** Only the porting: the task goes to checks and review as it was. */
export function portTask(task, port, done) {
  return `${statement(task, done)}${portFirst(port)}

Больше ничего не меняй: после переноса задача идёт на проверки и ревью как есть.

${DEVELOPER_RULES}

${TOOLING}

${DEVELOPER_END}`;
}

/** A note from the owner, put ahead of the message's closing instructions. */
export function withNote(message, note) {
  if (!note) return message;
  return `Заметка владельца к этой задаче (через супервизор):
${note}

${message}`;
}

/** After a limit or a crash in the middle of a step: the same task, named again. */
export function continueStep(task, step) {
  return `Задача ${task.id}: ${task.title}. Цель этого шага — ${STEP_GOAL[step] ?? STEP_GOAL.develop}.
Сессию прервал лимит или сбой. Продолжи эту задачу с того места, где остановился, ничего не повторяя. Если она уже готова — ничего нового не начинай, просто дай отчёт и итоговую строку.

${TOOLING}

${DEVELOPER_END}`;
}

/** Stopped on a refused command: a tooling hitch, not the owner's decision. */
export function refusedCommand(task, step, reason) {
  return `Задача ${task.id}: ${task.title}. Цель этого шага — ${STEP_GOAL[step] ?? STEP_GOAL.develop}.
Ты остановился на отклонённой команде: ${reason}
Это не решение владельца: сделай то же другим способом и доведи именно эту задачу.

${TOOLING}

${DEVELOPER_END}`;
}

/** The owner read a BLOCKED answer and said to go on. */
export function ownerApproved(task, step, reason) {
  return `Задача ${task.id}: ${task.title}. Цель этого шага — ${STEP_GOAL[step] ?? STEP_GOAL.develop}.
Ты остановился: ${reason}
Владелец прочитал это и решил: продолжить. Доведи эту задачу; другие не начинай.

${TOOLING}

${DEVELOPER_END}`;
}

/**
 * Answered DONE with changes left outside the commits: the checks would test
 * them and the reviewer would never see them.
 */
export function uncommitted(task, status) {
  return `Задача ${task.id}: ${task.title}.
Ты ответил RESULT: DONE, но в дереве остались незакоммиченные изменения:
\`\`\`
${status}
\`\`\`
Проверяется, ревьюится и отправляется только то, что в коммитах. Что относится к задаче — закоммить; что нет — верни \`git restore\` и назови в отчёте. Другие задачи не начинай.

${TOOLING}

${DEVELOPER_END}`;
}

/** An answer came without its marker: asked for it, not told to "continue". */
export function missingMarker(task) {
  return `Задача ${task.id}: ${task.title}.
Твой последний ответ закончился без итоговой строки. Если работа по этой задаче готова и закоммичена — ответь коротким отчётом и строкой RESULT: DONE. Если нет — доделай именно её. Другие задачи не начинай.

${DEVELOPER_END}`;
}

export function review(task, { base, head, devReport, checks, round, earlier = false }) {
  const which = round === 1
    ? (earlier ? 'новый первый круг (владелец продлил работу над задачей; прежние круги и твои замечания — выше в этой беседе)' : 'первый')
    : 'второй и последний';
  return `Ты — ревьюер (Астра) в автономном цикле разработки Rehearsly. Это ${which} круг ревью задачи ${task.id} «${task.title}».

Дерево уже стоит на ${head} (detached). Проверяй диапазон ${base}..${head}: git log ${base}..${head}, git diff ${base}..${head}.

Задача:
${task.body}

Отчёт разработчика:
${devReport}

Механические проверки супервизора (их запускал он сам, не разработчик):
${checks.steps.map((step) => `- ${step.name}: ${step.ok ? 'PASS' : `FAIL (код ${step.code})`}`).join('\n')}

Метод и планка — audit/HANDOFF_CLAUDE.md §4: каждой находке — клетка планки. Проверь, что исправлена причина, что «красное до» действительно падало на старом коде, что нет регресса, и что в диапазоне нет работы вне этой задачи. Если исправление видно на экране — есть ли e2e-сценарий, который его показывает и падал на старом коде (docs/e2e.md); нет — это замечание. Исправление теста, без которого не проходили проверки супервизора (в отчёте — «Исправление упавших проверок»), — не работа вне задачи: оцени его по существу, как остальное. Код и файлы не меняй, коммитов нет. production, rehearsly.me, server/.env — не трогай.

Ответ по-русски: замечания (или «замечаний нет»). Последней строкой ровно одно из:
VERDICT: ACCEPT
VERDICT: CHANGES`;
}

export const REVIEW_CONTINUE = 'Сессию прервал лимит подписки или сбой. Продолжай ревью с того места, где остановилась. Последней строкой — VERDICT: ACCEPT или VERDICT: CHANGES.';

/**
 * The last line that says something. Markdown around the marker is tolerated
 * (bold, code marks, a closing fence or rule); words after it are not — a
 * marker followed by more text is not the end of the answer.
 */
function lastLine(text) {
  const lines = String(text).split('\n')
    .map((line) => line.trim().replace(/^[*_`>\s]+|[*_`\s]+$/g, ''))
    .filter((line) => line && !/^[-=~]+$/.test(line));
  return lines.at(-1) ?? '';
}

/** The developer's marker: {done} | {blocked, reason} | null when absent. */
export function readResult(text) {
  const line = lastLine(text);
  if (/^RESULT:\s*DONE\.?$/i.test(line)) return { done: true };
  const blocked = /^RESULT:\s*BLOCKED:?\s*(.*)$/i.exec(line);
  if (blocked) return { blocked: true, reason: blocked[1] || 'без причины' };
  return null;
}

/**
 * One `claude -p` run can end several times: each background job or
 * notification gets a turn of its own after the real answer. The answer with
 * the marker is the one that counts, not whichever came last.
 */
export function pickResult(texts) {
  for (const text of texts) {
    const result = readResult(text);
    if (result) return { result, text };
  }
  return { result: null, text: texts.at(-1) ?? '' };
}

/** The reviewer's marker: 'accept' | 'changes' | null when absent. */
export function readVerdict(text) {
  const m = /^VERDICT:\s*(ACCEPT|CHANGES)\.?$/i.exec(lastLine(text));
  return m ? m[1].toLowerCase() : null;
}
