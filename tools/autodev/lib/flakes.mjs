/**
 * A test that fails and then passes on the same commits is flaky: not the
 * task's failure, and not something to fix inside it. The task goes on, and
 * the test becomes a task of its own, queued right after the one it hit —
 * with what failed, so its developer starts from the evidence (owner,
 * 2026-10-10: three in one day, none of them T-109's).
 */

const MARKS = [
  /^FAIL\s+\S/,               // Jest: the suite
  /^\s*●\s+\S/,               // Jest: the test
  /^not ok \d+ - /,           // node:test
  /^\s*(error|location|code):/, // node:test details
  /^\s*\[Failed\]\s/,         // Maestro
  /^\s*(Expected|Received):/, // Jest assertion
];

/** The lines of a check's output that say what failed; the last ones when nothing does. */
export function failureExcerpt(tail, max = 24) {
  const lines = String(tail).split('\n');
  const marked = [...new Set(lines.filter((line) => MARKS.some((mark) => mark.test(line))).map((line) => line.trimEnd()))];
  return (marked.length ? marked : lines.slice(-30)).slice(0, max).join('\n');
}

/** What to call the flaky test: the first failing test's own name. */
export function flakeName(steps) {
  for (const step of steps) {
    for (const line of String(step.tail).split('\n')) {
      const name = /^\s*●\s+(.+)$/.exec(line)?.[1] ?? /^not ok \d+ - (.+)$/.exec(line)?.[1]
        ?? /^\s*\[Failed\]\s+(.+?)(\s+\(.*\))?$/.exec(line)?.[1];
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

/** The task's markdown, "## T-2NN Нестабильный тест: …" and what to do. */
export function flakeTask({ id, task, head, steps, log, when }) {
  const excerpt = steps.map((step) => `### ${step.name} (код ${step.code})\n${failureExcerpt(step.tail)}`).join('\n\n');
  return `## ${id} ${flakeTitle(steps)}

Источник: проверки супервизора на задаче ${task.id}, коммит ${head.slice(0, 7)}, ${when}. Тест упал, а повторный прогон тех же коммитов прошёл: он нестабилен, задача ${task.id} тут ни при чём.

Что упало:
\`\`\`
${excerpt}
\`\`\`
Полный вывод — ${log}.

Найди причину нестабильности и устрани её по причине: не поднимай лимиты наугад и не добавляй повторы. «Красное до» — воспроизведи падение (повтор в цикле, нагрузка, тот же порядок файлов) и сохрани вывод в audit/evidence. Если тест охраняет исправленный баг — проверь, что сам баг не вернулся, и напиши это в отчёте.
`;
}

/** Puts a task block right after task `afterId`'s block — next in the queue. */
export function insertAfter(tasksMarkdown, afterId, block) {
  const start = tasksMarkdown.search(new RegExp(`^## ${afterId}\\b`, 'm'));
  if (start < 0) return `${tasksMarkdown.trimEnd()}\n\n${block}`;
  const rest = tasksMarkdown.slice(start + 1);
  const next = rest.search(/^## T-\d{3,}\b/m);
  if (next < 0) return `${tasksMarkdown.trimEnd()}\n\n${block}`;
  const at = start + 1 + next;
  return `${tasksMarkdown.slice(0, at)}${block}\n${tasksMarkdown.slice(at)}`;
}
