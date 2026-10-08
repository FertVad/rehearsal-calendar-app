/**
 * What the supervisor keeps on disk: its state (so a crash, a reboot or a
 * limit picks up exactly where it stopped), the task queue the owner writes,
 * and the files the owner reads — one report per task and a status page.
 */
import fs from 'node:fs';
import path from 'node:path';

/** Written whole or not at all: a crash mid-write leaves the previous state. */
export function writeAtomic(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, file);
}

export function loadState(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) {
    if (error.code === 'ENOENT') return { tasks: {}, current: null, waitUntil: null };
    throw error; // a corrupt state is not an empty one
  }
}

export function saveState(file, state) {
  writeAtomic(file, `${JSON.stringify(state, null, 2)}\n`);
}

/**
 * The queue, as the owner writes it in TASKS.md:
 *
 *   ## T-001 Title
 *   What to do, in as many lines as needed.
 *
 * Order in the file is the order of work.
 */
export function parseTasks(markdown) {
  const tasks = [];
  let current = null;
  for (const line of markdown.split('\n')) {
    const head = /^##\s+(T-\d{3,})\s+(.+?)\s*$/.exec(line);
    if (head) {
      current = { id: head[1], title: head[2], body: [] };
      tasks.push(current);
    } else if (current) {
      current.body.push(line);
    }
  }
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    body: task.body.join('\n').trim(),
    slug: slugify(task.title),
  }));
}

export function slugify(title) {
  const map = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  return title.toLowerCase().split('').map((c) => map[c] ?? c).join('')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'task';
}

/** The owner's decisions for paused tasks: "T-001: продолжить" / "пропустить". */
export function parseDecisions(markdown) {
  const decisions = {};
  for (const line of markdown.split('\n')) {
    // No \b: in JavaScript it knows only Latin letters.
    const m = /^\s*[-*]?\s*(T-\d{3,})\s*:\s*(продолжить|пропустить|continue|skip)(?![\p{L}])/iu.exec(line);
    if (m) decisions[m[1]] = /продолжить|continue/i.test(m[2]) ? 'continue' : 'skip';
  }
  return decisions;
}

/** One line appended to a task's report. */
export function appendReport(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, `${text}\n`);
}
