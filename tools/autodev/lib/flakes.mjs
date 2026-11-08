/**
 * A test that fails and then passes on the same commits is flaky: not the
 * task's failure, and not something to fix inside it. The task goes on, and
 * the test becomes a task of its own — with what failed, so its developer
 * starts from the evidence (owner, 2026-10-10: three in one day, none of them
 * T-109's). It waits behind the tasks people queued (queueFound).
 */

const MARKS = [
  /^FAIL\s+\S/,               // Jest: the suite
  /^\s*●\s+\S/,               // Jest: the test
  /^not ok \d+ - /,           // node:test
  /^\s*(error|location|code):/, // node:test details
  /^\s*\[Failed\]\s/,         // Maestro
  /^\s*(Expected|Received):/, // Jest assertion
  /^\[e2e\] .*(fail|error|did not|not ready|STOPPED|refus|exited|timed out)/i, // the e2e run itself, before any flow
];

/** A line that says what failed: a suite, a test, an assertion. */
export function isFailureLine(line) {
  return MARKS.some((mark) => mark.test(line));
}

/** What a step's output says failed: its failure lines, gathered over the whole run, else its tail. */
function failureText(step) {
  return step.failures?.length ? step.failures.join('\n') : String(step.tail ?? '');
}

/** The lines of a check's output that say what failed; the last ones when nothing does. */
export function failureExcerpt(text, max = 24) {
  const lines = String(text).split('\n');
  const marked = [...new Set(lines.filter(isFailureLine).map((line) => line.trimEnd()))];
  return (marked.length ? marked : lines.slice(-30)).slice(0, max).join('\n');
}

/** What to call the flaky test: the first failing test's own name. */
export function flakeName(steps) {
  for (const step of steps) {
    for (const line of failureText(step).split('\n')) {
      const name = /^\s*●\s+(.+)$/.exec(line)?.[1] ?? /^not ok \d+ - (.+)$/.exec(line)?.[1]
        ?? /^\s*\[Failed\]\s+(.+?)(\s+\(.*\))?$/.exec(line)?.[1]
        ?? (isFailureLine(line) && /^\[e2e\] (.+)$/.exec(line)?.[1]?.replace(/^/, 'e2e до сценариев: '));
      if (name) return name.trim().slice(0, 100);
    }
  }
  return `проверка ${steps.map((step) => step.name).join(', ')}`;
}

/** The next free id for a flaky-test task: T-201, T-202, … */
export function nextFlakeId(tasksMarkdown) {
  const taken = [...tasksMarkdown.matchAll(/^## T-2(\d{2})\b/gm)].map((match) => Number(match[1]));
  return `T-2${String((taken.length ? Math.max(...taken) : 0) + 1).padStart(2, '0')}`;
}

export function flakeTitle(steps) {
  return `Нестабильный тест: ${flakeName(steps)}`;
}

/**
 * The e2e flows a task's checks must run, listed by path: the supervisor runs
 * those its text names (checks.e2eFlowsFor), so a fix made in the app, not in
 * the flow, is still checked by the flow that failed.
 */
export function flowsSection(flows) {
  return flows.length ? `\nСценарии e2e этой задачи — супервизор прогонит их в её проверках:\n${flows.map((f) => `- ${f.file}${f.name ? ` — ${f.name}` : ''}`).join('\n')}\n` : '';
}

/** The task's markdown, "## T-2NN Нестабильный тест: …" and what to do. */
export function flakeTask({ id, task, head, steps, evidence, when, source, flows = [] }) {
  const excerpt = steps.map((step) => `### ${step.name} (код ${step.code})\n${failureExcerpt(failureText(step))}`).join('\n\n');
  return `## ${id} ${flakeTitle(steps)}

${source ?? `Источник: проверки супервизора на задаче ${task.id}, коммит ${head.slice(0, 7)}, ${when}. Тест упал, а повторный прогон тех же коммитов прошёл: он нестабилен, задача ${task.id} тут ни при чём.`}
${flowsSection(flows)}
Что упало:
\`\`\`
${excerpt}
\`\`\`
${evidence}

Найди причину нестабильности и устрани её по причине: не поднимай лимиты наугад и не добавляй повторы. Единственное исключение — касание, которое теряет сам симулятор (backboardd): оно идёт через e2e/subflows/tap-and-see.yaml, один общий механизм с одним повтором (T-207, docs/e2e.md), и это надо доказать журналом красного прогона, а не предположить. «Красное до» — воспроизведи падение (повтор в цикле, нагрузка, тот же порядок файлов) и сохрани вывод в audit/evidence; потерю касания средой по заказу не получить — для неё доказательство журнал и проверка без этого касания с тем же падением. Если тест охраняет исправленный баг — проверь, что сам баг не вернулся, и напиши это в отчёте.
`;
}

/** A task the supervisor queued itself: a flaky test, or flows red again in the full run (nightly.mjs). */
export function isFoundTask(title) {
  return /^(Нестабильный тест|Полный e2e красный): /.test(title);
}

/**
 * Puts a task the supervisor found into the queue: behind every waiting task
 * a person queued, ahead of the supervisor's own still waiting; at the end
 * when none of those wait. `waiting` is the tasks not yet finished, in file
 * order, the current one left out.
 *
 * Owner, 07.11.2026: «обнаруженные баги поставь в очередь первыми». Queued
 * right after the current task, T-234 — a flaky flow in T-229's checks — was
 * taken at once, ahead of T-232 and T-233, bugs he had found in the app.
 */
export function queueFound(tasksMarkdown, waiting, block) {
  const own = waiting.find((task) => isFoundTask(task.title));
  return own ? insertBefore(tasksMarkdown, own.id, block) : `${tasksMarkdown.trimEnd()}\n\n${block}`;
}

/** Puts a task block right before task `beforeId`'s block. */
function insertBefore(tasksMarkdown, beforeId, block) {
  const at = tasksMarkdown.search(new RegExp(`^## ${beforeId}\\b`, 'm'));
  if (at < 0) return `${tasksMarkdown.trimEnd()}\n\n${block}`;
  return `${tasksMarkdown.slice(0, at)}${block}\n${tasksMarkdown.slice(at)}`;
}
