/**
 * The whole e2e set, run apart from the tasks (owner, 27.10.2026). A task's
 * checks run only its own flows (checks.e2eFlowsFor): 37 flows took 46
 * minutes a run, every check of every task. The whole set runs once a night
 * on the reviewed code, and once more when the queue is done — the control
 * run before anything is called finished.
 */
import { failureExcerpt } from './flakes.mjs';

/** Local hours the night run may start in: the owner is asleep, the Mac on power. */
export const NIGHT = { from: 1, to: 6 };
/** One night run a night, however often auto/main moves during it. */
const GAP_MS = 12 * 60 * 60 * 1000;
/** A run the machine spoiled — not ready, asleep, out of time — is tried again after this. */
export const MACHINE_RETRY_MS = 60 * 60 * 1000;

/**
 * Whether the whole set is due now. `last` is the previous run as the
 * supervisor keeps it ({ head, at, ok?, machine? }), `head` the reviewed
 * commit, `hour` the local hour.
 */
export function fullE2eDue({ last, head, now, hour, queueEmpty }) {
  if (!head) return false;
  if (!queueEmpty && !(hour >= NIGHT.from && hour < NIGHT.to)) return false;
  if (last?.machine) return now - Date.parse(last.at) >= MACHINE_RETRY_MS;
  if (last?.head === head) return false;
  return queueEmpty || !last || now - Date.parse(last.at) >= GAP_MS;
}

export function regressionTitle(flows) {
  const first = flows[0]?.name ?? flows[0]?.file ?? 'до сценариев';
  return `Полный e2e красный: ${first}${flows.length > 1 ? ` и ещё ${flows.length - 1}` : ''}`.slice(0, 140);
}

/**
 * Flows red in the whole set and red again on their own: auto/main is broken,
 * not flaky. The task names them by path, so its checks run them.
 */
export function regressionTask({ id, kind, head, lastGreen, flows, failures, evidence, when }) {
  const since = lastGreen ? `Последний зелёный полный прогон — ${lastGreen.slice(0, 7)}: ищи в ${lastGreen.slice(0, 7)}..${head.slice(0, 7)}.` : 'Зелёного полного прогона до него не было.';
  const list = flows.length
    ? `Сценарии e2e этой задачи — супервизор прогонит их в её проверках:\n${flows.map((f) => `- ${f.file} — ${f.name}`).join('\n')}`
    : 'Прогон упал до сценариев — сначала посмотри вывод e2e/run.mjs.';
  return `## ${id} ${regressionTitle(flows)}

Источник: ${kind} полный прогон e2e на auto/main ${head.slice(0, 7)}, ${when}. Сценарии упали и упали снова, когда их прогнали отдельно: это не нестабильность — проверенный код сломан. ${since}

${list}

Что упало:
\`\`\`
${failureExcerpt(failures.join('\n'))}
\`\`\`
${evidence}

Найди коммит, который это сломал (прогон сценария на коммитах диапазона), и исправь причину: в коде приложения — или в сценарии, если он устарел после принятой правки, и тогда напиши в отчёте, какой правкой. Не ослабляй проверку сценария и не поднимай таймауты. «Красное до» — сценарий красный на ${head.slice(0, 7)}, вывод в audit/evidence.
`;
}
