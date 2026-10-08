/**
 * The queue comes from the audit (owner, 2026-10-08): the cause fixes of
 * audit/TRIAGE_R4_R9.md in the order the owner set there —
 *
 *   1. fixes 1–9 (all 16 serious findings, marked ★);
 *   2. the rest of the R3 client: the password reset and address change screens;
 *   3. fixes 10–22
 *
 * — each with its findings, as audit/REMEDIATION_STATUS.md records them and
 * audit/AUDIT_REPORT.md describes them. A fix is done when the triage says
 * "Сделано" or every one of its findings is past TODO/IN_PROGRESS.
 */

const FINDING = /\b([A-Z]{1,4}\d{2,3})\b/g;
const SETTLED = new Set(['VERIFIED', 'READY_FOR_CHECK', 'DEFERRED']);

/** The cause fixes, from the triage tables: {num, text, findings[], done}. */
export function parseTriage(markdown) {
  const fixes = [];
  for (const line of markdown.split('\n')) {
    const row = /^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (!row) continue;
    fixes.push({
      num: Number(row[1]),
      text: row[2],
      findings: [...row[3].matchAll(FINDING)].map((m) => m[1]),
      serious: row[3].includes('★'),
      done: /Сделано в/.test(row[2]),
    });
  }
  return fixes;
}

/** The register: id → {severity, pkg, status, summary}. */
export function parseRegistry(markdown) {
  const findings = {};
  for (const line of markdown.split('\n')) {
    const cells = line.split('|').map((cell) => cell.trim());
    // | ID | Важность | Условный | Пакет | Статус | Краткая суть | Evidence |
    if (cells.length < 8 || !/^[A-Z]{1,4}\d{2,3}$/.test(cells[1])) continue;
    findings[cells[1]] = { severity: cells[2], pkg: cells[4], status: cells[5], summary: cells[6] };
  }
  return findings;
}

const R3_CLIENT = {
  key: 'r3-client',
  id: 'T-130',
  title: 'Остаток клиента R3: экраны сброса пароля и смены адреса',
  findings: ['A01', 'A03', 'A04'],
  text: 'Сервер R3 готов (audit/REMEDIATION_R3.md): сброс пароля по коду из письма (/auth/password-reset/*) и смена адреса двумя кодами (/auth/me/email/change, /confirm). В приложении нет экранов для этого — без них сервер R3 не выпустить. Сделать оба экрана по контракту из REMEDIATION_R3.md и CLAUDE.md (раздел OAuth Implementation), на четырёх языках.',
};

function fixTitle(text) {
  const first = text.split(/(?<=[.!?])\s/)[0].replace(/\[[^\]]*\]\([^)]*\)/g, '').trim();
  return first.length > 90 ? `${first.slice(0, 87)}…` : first;
}

function findingLines(ids, registry) {
  return ids.map((id) => {
    const f = registry[id];
    return f
      ? `- ${id} — ${f.severity}, пакет ${f.pkg}, статус ${f.status}: ${f.summary}. Подробно — audit/AUDIT_REPORT.md, раздел «### ${id}».`
      : `- ${id} — подробно в audit/AUDIT_REPORT.md, раздел «### ${id}».`;
  }).join('\n');
}

function body(source, text, ids, registry) {
  const pkgs = [...new Set(ids.map((id) => registry[id]?.pkg).filter(Boolean))];
  return `Источник: ${source}.
${text}

Находки:
${findingLines(ids, registry)}

Метод — audit/HANDOFF_CLAUDE.md §4: правка причины целиком (правило в одном месте, инвариант в схеме или контракте, один механизм на класс ошибок), планка, «красное до» — тест сначала падает на старом коде. Находки ниже планки, которые покрывает то же правило, закрой этой же правкой.
Документы — как в прошлых правках (образец — audit/REMEDIATION_R9.md, правка №7): раздел в audit/REMEDIATION_${pkgs[0] ?? 'R?'}.md (нет файла — создай по образцу) — причина, правка, проверки, «красное до» файлом в audit/evidence/${pkgs[0] ?? 'R?'}/ с SHA-256; строки находок в audit/REMEDIATION_STATUS.md → READY_FOR_CHECK (нужна проверка на устройстве — укажи DEV-…); отметка «Сделано в <коммит>» в audit/TRIAGE_R4_R9.md.
Если правке нужна миграция базы — напиши её файлом миграции и ответь BLOCKED: применение решает владелец.`;
}

/** Audit tasks still to do, in the owner's order. */
export function auditTasks(triageMd, registryMd) {
  const registry = parseRegistry(registryMd);
  const fixes = parseTriage(triageMd);
  const open = (fix) => !fix.done && !(fix.findings.length && fix.findings.every((id) => SETTLED.has(registry[id]?.status)));
  const asTask = (fix) => ({
    id: `T-${100 + fix.num}`,
    title: `Правка причины №${fix.num}: ${fixTitle(fix.text)}`,
    body: body(`audit/TRIAGE_R4_R9.md, правка причины №${fix.num}${fix.serious ? ' (★ серьёзные находки)' : ''}`, fix.text, fix.findings, registry),
  });
  const tasks = fixes.filter((fix) => fix.num <= 9 && open(fix)).map(asTask);
  const r3Open = R3_CLIENT.findings.some((id) => !SETTLED.has(registry[id]?.status));
  if (r3Open) tasks.push({ id: R3_CLIENT.id, title: R3_CLIENT.title, body: body('audit/TRIAGE_R4_R9.md, порядок работ п. 2; audit/HANDOFF_CLAUDE.md §2', R3_CLIENT.text, R3_CLIENT.findings, registry) });
  tasks.push(...fixes.filter((fix) => fix.num >= 10 && open(fix)).map(asTask));
  return tasks;
}

/** A queue entry as TASKS.md has it. */
export function taskMarkdown(task) {
  return `## ${task.id} ${task.title}\n${task.body}\n`;
}
