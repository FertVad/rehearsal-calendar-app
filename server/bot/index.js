import { Telegraf } from 'telegraf';
import * as Project from '../database/models/Project.js';
import * as Actor from '../database/models/Actor.js';
import * as Rehearsal from '../database/models/Rehearsal.js';
import db from '../database/db.js';

const DEBUG = process.env.DEBUG === 'true' || process.env.DEBUG === '1';

let bot;

/**
 * Initialize Telegram bot and register handlers.
 */

async function handleRoleChange(ctx) {
  try {
    const chat = ctx.chat || ctx.update?.my_chat_member?.chat || ctx.update?.chat_member?.chat;
    const change = ctx.update?.my_chat_member || ctx.update?.chat_member;
    if (!chat || !change) return;

    const chatId = String(chat.id);
    const user = change.new_chat_member?.user || change.from;
    const status = change.new_chat_member?.status;
    if (!user?.id || user.is_bot) return;

    const project = await Project.findByChatId(chatId);
    if (!project) return;

    const isAdmin = status === 'administrator' || status === 'creator';
    const name =
      [user.first_name, user.last_name].filter(Boolean).join(' ') ||
      user.username ||
      String(user.id);

    await Actor.upsertByTelegramId({
      projectId: project.id,
      telegramId: String(user.id),
      patch: { is_admin: isAdmin, name },
    });

    console.log(
      `admin-sync: chatId=${chatId}, user=${user.id} status=${status} -> is_admin=${isAdmin}`,
    );
  } catch (e) {
    console.error('admin-sync error:', e);
  }
}

export function createBot(token) {
  console.log('=== BOT INITIALIZATION ===');
  console.log('[Bot] createBot called');
  console.log('[Bot] Token provided:', token ? `YES (${String(token).substring(0, 10)}...${String(token).slice(-5)})` : 'NO - CRITICAL ERROR!');

  if (!token) {
    console.error('[Bot] CRITICAL ERROR: No bot token provided!');
    console.error('[Bot] Bot will not work without token! Returning dummy webhook handler.');
    // Return a minimal stub to avoid server crash
    return {
      telegram: {
        async getWebhookInfo() { return { url: '' }; },
        async setWebhook() { /* noop */ },
      },
      webhookCallback() {
        return (req, res, _next) => {
          console.error('[Bot] Webhook called but bot has no token!');
          res.sendStatus(200);
        };
      },
    };
  }

  if (bot) {
    console.log('[Bot] Returning existing bot instance');
    return bot;
  }

  console.log('[Bot] Creating new bot instance with Telegraf');
  bot = new Telegraf(token);
  bot.catch(err => console.error('[Bot] Error', err));

  // Universal middleware: log every event coming to the bot
  bot.use(async (ctx, next) => {
    console.log('[Bot] Event received:', {
      updateType: ctx.updateType,
      chatId: ctx.chat?.id,
      from: ctx.from?.id,
      timestamp: new Date().toISOString(),
    });
    return next();
  });
  console.log('[Bot] Bot instance created, handlers registering...');

  // Removed duplicate early handlers; my_chat_member is handled below with full flow

  // When bot added to group or promoted
  bot.on('my_chat_member', async ctx => {
    console.log('[Bot] my_chat_member RAW:', JSON.stringify(ctx.update, null, 2));
    try {
      const chatId = String(ctx.chat.id);
      const myChatMember = ctx.myChatMember || ctx.update?.my_chat_member;
      const newStatus = myChatMember?.new_chat_member?.status;
      const oldStatus = myChatMember?.old_chat_member?.status;
      console.log('[Bot] my_chat_member PARSED:', {
        chatId,
        chatTitle: ctx.chat?.title,
        oldStatus: oldStatus || 'none',
        newStatus: newStatus || 'none',
        myChatMember_exists: !!myChatMember,
        ctx_chat_exists: !!ctx.chat,
        transition: `${oldStatus || 'none'} -> ${newStatus || 'none'}`,
      });

      const statusCondition = ['restricted', 'member', 'administrator'].includes(newStatus);
      const oldStatusCondition = ['kicked', 'left', '', null, undefined].includes(oldStatus);
      console.log('[Bot] Conditions check:', {
        statusCondition,
        oldStatusCondition,
        willCreateProject: statusCondition && oldStatusCondition,
      });

      // Create project only on first add (from left/kicked/none to restricted/member/admin)
      if (statusCondition && oldStatusCondition) {
        console.log('[Bot] Attempting to create/find project...');
        console.log('[Bot] Looking for existing project with chatId:', chatId);
        let project = await Project.findByChatId(chatId);
        console.log('[Bot] Existing project search result:', project ? `found id=${project.id}` : 'not found');
        if (!project) {
          console.log('[Bot] Creating new project with data:', {
            chat_id: chatId,
            name: ctx.chat?.title || 'Unnamed project',
          });
          try {
            project = await Project.create({ chat_id: chatId, name: ctx.chat?.title || 'Unnamed project' });
            console.log('[Bot] Project created successfully:', project);
          } catch (createError) {
            console.error('[Bot] Failed to create project:', createError);
            throw createError;
          }
        } else {
          console.log('[Bot] Project exists', project.id);
        }

        const admins = await ctx.telegram.getChatAdministrators(ctx.chat.id);
        admins.forEach(async admin => {
          if (!admin.user) return;
          const user = admin.user;
          if (user.is_bot) return;
          const existing = await Actor.findByTelegramId(String(user.id), project.id);
          const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || String(user.id);
          if (!existing) {
            await Actor.create({ telegram_id: String(user.id), name, project_id: project.id, is_admin: true });
            console.log('[Bot] Admin added', name);
          } else if (!existing.is_admin) {
            await Actor.update(existing.id, { is_admin: true });
            console.log('[Bot] Admin updated', name);
          }
        });

        // Auto-send welcome message on first add (only if project was just created)
        try {
          if (!project?.id) {
            // if somehow project is still falsy, skip welcome message
            console.error('[Bot] Project not initialized, skipping welcome message');
            return;
          }
          const chatTitle = ctx.chat?.title || (project?.name || 'Rehearsal Calendar');
          await ctx.replyWithHTML(
            `🎭 <b>${chatTitle}</b>\n\n` +
              '⚠️ <b>Important:</b> make this bot an <b>Admin</b> of the group\n\n' +
              '💡 Click the button below to open the app\n\n' +
              '📌 <b>Tip:</b> pin this message for quick access',
            {
              reply_markup: {
                inline_keyboard: [[{
                  text: '🔗 Open App',
                  url: `https://t.me/rehearsal_calendar_bot/rehearsal_calendar_Tari?startapp=chat_${Math.abs(Number(ctx.chat.id))}`
                }]],
              },
            },
          );
        } catch (error) {
          console.error('Failed to send welcome message:', error);
        }
      }
      // After handling project creation/welcome, also sync roles
      await handleRoleChange(ctx);

    } catch (err) {
      console.error('[Bot] my_chat_member error', err);
    }
  });

  // Separate handler for participant role changes (not bot role)
  bot.on('chat_member', handleRoleChange);

  // New members
  bot.on('new_chat_members', async ctx => {
    try {
      const project = await Project.findByChatId(String(ctx.chat.id));
      if (!project) return;
      ctx.message.new_chat_members.forEach(async member => {
        if (member.is_bot) return;
        const existing = await Actor.findByTelegramId(String(member.id), project.id);
        const name = [member.first_name, member.last_name].filter(Boolean).join(' ') || member.username || String(member.id);
        if (!existing) {
          await Actor.create({ telegram_id: String(member.id), name, project_id: project.id, is_admin: false });
          console.log('[Bot] Member added', name);
        }
      });
    } catch (err) {
      console.error('[Bot] new_chat_members error', err);
    }
  });

  // User left or was removed from chat
  bot.on('left_chat_member', async ctx => {
    try {
      const leftUser = ctx.message.left_chat_member;
      if (!leftUser || leftUser.is_bot) return;

      const chatId = String(ctx.chat.id);
      const telegramId = String(leftUser.id);
      const userName = [leftUser.first_name, leftUser.last_name].filter(Boolean).join(' ') || leftUser.username || telegramId;

      console.log(`[Bot] User left chat: ${userName} (${telegramId}) from chat ${chatId}`);

      const project = await Project.findByChatId(chatId);
      if (!project) {
        console.log('[Bot] Project not found for chat', chatId);
        return;
      }

      const actor = await Actor.findByTelegramId(telegramId, project.id);
      if (!actor) {
        console.log('[Bot] Actor not found', telegramId);
        return;
      }

      // 1. Remove from future rehearsals
      const today = new Date().toISOString().split('T')[0];
      const futureRehearsals = await db.all(
        'SELECT * FROM rehearsals WHERE project_id = ? AND date >= ?',
        [project.id, today]
      );

      if (DEBUG) {
        console.log(`[Bot] Found ${futureRehearsals.length} future rehearsals for project ${project.id}`);
        console.log(`[Bot] Looking for actor.id = ${actor.id} (type: ${typeof actor.id})`);
      }

      let rehearsalsUpdated = 0;
      for (const rehearsal of futureRehearsals) {
        const actorIds = JSON.parse(rehearsal.actors || '[]');

        // Convert both to numbers for comparison
        const actorIdNum = Number(actor.id);
        const actorIdsNum = actorIds.map(id => Number(id));
        const found = actorIdsNum.includes(actorIdNum);

        if (DEBUG) {
          console.log(`[Bot] Rehearsal ${rehearsal.id}: actors = ${JSON.stringify(actorIds)} (types: ${actorIds.map(id => typeof id).join(', ')})`);
          console.log(`[Bot] Checking if ${actorIdNum} in [${actorIdsNum.join(', ')}]: ${found}`);
        }

        if (found) {
          const updatedActors = actorIds.filter(id => Number(id) !== actorIdNum);
          if (DEBUG) {
            console.log(`[Bot] Updating rehearsal ${rehearsal.id}: ${JSON.stringify(actorIds)} -> ${JSON.stringify(updatedActors)}`);
          }
          await Rehearsal.update(rehearsal.id, {
            actors: JSON.stringify(updatedActors)
          });
          rehearsalsUpdated++;
        }
      }

      // 2. Delete actor from project
      // Note: Manual availability is global and preserved
      await Actor.remove(actor.id);

      console.log(`[Bot] User ${userName} removed from project ${project.name}:`, {
        actorId: actor.id,
        rehearsalsUpdated,
      });

    } catch (err) {
      console.error('[Bot] left_chat_member error', err);
    }
  });

  // /start command
  bot.start(async ctx => {
    try {
      const chatId = String(ctx.chat.id);
      const chatType = ctx.chat.type;

      if (chatType === 'group' || chatType === 'supergroup') {
        const project = await Project.findByChatId(chatId);
        const projectName = project?.name || 'Rehearsal Calendar';

        await ctx.replyWithHTML(
          `🎭 <b>${projectName}</b>\n\n` +
            '⚠️ <b>Important:</b> make this bot an <b>Admin</b> of the group\n\n' +
            '💡 Click the button below to open the app\n\n' +
            '📌 <b>Tip:</b> pin this message for quick access',
          {
            reply_markup: {
              inline_keyboard: [[{
                text: '🔗 Open App',
                url: `https://t.me/rehearsal_calendar_bot/rehearsal_calendar_Tari?startapp=chat_${Math.abs(ctx.chat.id)}`
              }]],
            },
          },
        );
      } else {
        await ctx.reply(
          'This bot only works in group chats. Please add the bot to a group and type /start there.'
        );
      }
    } catch (error) {
      console.error('[Bot] Start command error:', error);
    }
  });

  // /calendar command removed

  // Debug messages
  bot.on('message', async ctx => {
    console.log(`[Bot] Message received:`, {
      chat: ctx.chat.id,
      type: ctx.chat.type,
      text: ctx.message.text,
      from: ctx.from.first_name,
    });
  });
  console.log('[Bot] All handlers registered successfully');
  console.log('========================');
  return bot;
}

export function getBot() {
  return bot || createBot(process.env.TELEGRAM_BOT_TOKEN || '');
}
