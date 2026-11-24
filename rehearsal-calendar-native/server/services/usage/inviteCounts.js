/**
 * How far each project's invitation gets, by day (T-294): the page opened in
 * a browser, the invitation opened in the app, a join. Counts only — no IP,
 * no device, nothing that ties a count to a person. The day is UTC: a count
 * has no person whose zone it could take.
 */
import { logger } from '../../utils/logger.js';
import { dateIn } from '../../utils/dateIn.js';
import { purgeNowAndThen, statsWritable, statsWriteFailed, statsWriteSucceeded } from './statsStore.js';

const COLUMNS = Object.freeze({ page: 'page_opens', app: 'app_opens', join: 'joins' });
const today = (now) => dateIn(now, 'UTC');
const upsert = (column, from) => `INSERT INTO native_invite_counts (project_id, day, ${column})
  ${from}
  ON CONFLICT (project_id, day) DO UPDATE SET ${column} = native_invite_counts.${column} + 1
  RETURNING project_id`;

/**
 * Count one opening of an invitation, by its code: one INSERT … SELECT, so an
 * unknown code writes nothing and nothing is read first. Never throws.
 * @param {'page'|'app'} kind
 */
export async function countInviteOpen(conn, code, kind, now = Date.now()) {
  if (!statsWritable(now)) return;
  try {
    await conn.all(upsert(COLUMNS[kind], 'SELECT id, $2, 1 FROM native_projects WHERE invite_code = $1'), [code, today(now)]);
  } catch (error) {
    statsWriteFailed('Invitation count', error, now);
    return;
  }
  statsWriteSucceeded();
  await purgeNowAndThen(conn, now);
}

/**
 * Count a join inside the transaction that makes it, so a join that does not
 * happen is not counted. Its own savepoint: a count that fails — 016 not
 * applied — is undone alone and the join commits as it would have.
 */
export async function countJoin(tx, projectId, now = Date.now()) {
  if (!statsWritable(now)) return;
  await tx.run('SAVEPOINT invite_count');
  try {
    await tx.get(upsert(COLUMNS.join, 'VALUES ($1, $2, 1)'), [projectId, today(now)]);
  } catch (error) {
    await tx.run('ROLLBACK TO SAVEPOINT invite_count');
    statsWriteFailed('Join count', error, now);
    return;
  }
  await tx.run('RELEASE SAVEPOINT invite_count');
  statsWriteSucceeded();
}

// Link previews fetch the page to draw a card: a chat showing the link, not a
// person opening it. Telegram, WhatsApp, iMessage (which says
// facebookexternalhit), Facebook, Slack, Discord, X, LinkedIn, Skype, Viber,
// VK, Pinterest, Reddit, embed services, and anything calling itself a bot.
const PREVIEW = /TelegramBot|WhatsApp|facebookexternalhit|Facebot|Slackbot|Slack-ImgProxy|Discordbot|Twitterbot|LinkedInBot|SkypeUriPreview|Viber|vkShare|Pinterest|redditbot|Embedly|Iframely|Google-PageRenderer|bot\b|crawler|spider|preview/i;

/** A person's browser asking for the page: not HEAD, not a preview, not a request without a user agent. */
export function isPersonOpeningPage(req) {
  if (req.method !== 'GET') return false;
  const agent = String(req.get('User-Agent') || '');
  return agent !== '' && !PREVIEW.test(agent);
}

/**
 * After the invitation page has been sent: count it if a person opened it.
 * Nothing waits for this and nothing it does reaches the page — the page goes
 * out even when the database is down. On Vercel the platform is asked to let
 * it finish after the response (the same hook as @vercel/functions' waitUntil).
 */
export function countPageAfterResponse(res, { code, ensureDatabase, conn }) {
  // 'close' comes after the last byte or after the browser gave up; only the
  // first is an opening.
  const work = new Promise((resolve) => res.once('close', resolve)).then(async () => {
    if (!res.writableFinished) return;
    try {
      if (!(await ensureDatabase())) return;
    } catch {
      return;
    }
    await countInviteOpen(conn, code, 'page');
  }).catch((error) => logger.warn(`[Usage] Invitation page count not recorded: ${String(error?.message || error)}`));
  globalThis[Symbol.for('@vercel/request-context')]?.get?.()?.waitUntil?.(work);
  return work;
}
