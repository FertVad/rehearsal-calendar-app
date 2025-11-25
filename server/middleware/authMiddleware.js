import { verifyTelegramInitData, normalizeGroupChatIdStrict } from '../utils/telegramAuth.js';

const isProd = process.env.NODE_ENV === 'production';

function getInitDataFromRequest(req) {
  // Primary: custom header from client
  const h = req.header('x-telegram-init-data');
  if (h) return h;
  // Secondary: body field for POST/PUT (optional fallback)
  if (typeof req.body?.__tgInitData === 'string') return req.body.__tgInitData;
  return '';
}

export function requireTelegramAuth(options = {}) {
  const { allowDevParam = true } = options;
  return function telegramAuthMiddleware(req, res, next) {
    const raw = getInitDataFromRequest(req);
    const token = process.env.TELEGRAM_BOT_TOKEN || '';

    if (!raw && allowDevParam && !isProd) {
      // Dev: allow using :chatId param with dev-* namespace
      const chatParam = req.params?.chatId;
      if (typeof chatParam === 'string' && chatParam.startsWith('dev-')) {
        req.tg = { userId: 'dev-user', chatId: chatParam, authDate: Math.floor(Date.now() / 1000) };
        return next();
      }
    }

    const maxAgeSec = Number(process.env.TG_INITDATA_MAX_AGE_SEC) || 24 * 60 * 60;
    const resVerify = verifyTelegramInitData(raw, token, { maxAgeSec });
    if (!resVerify.ok) {
      console.warn('[auth] initData reject', { route: req.originalUrl, reason: resVerify.error });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = String(resVerify.user.id);
    let chatId = resVerify.chatId ? normalizeGroupChatIdStrict(resVerify.chatId) : null;
    // If route contains :chatId, prefer it but must equal resolved chat
    const routeChat = req.params?.chatId;
    if (routeChat) {
      const normRoute = String(routeChat).startsWith('dev-') && !isProd
        ? String(routeChat)
        : normalizeGroupChatIdStrict(routeChat);
      if (!normRoute) {
        return res.status(400).json({ error: 'Bad chatId' });
      }
      if (chatId && normRoute !== chatId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      chatId = normRoute;
    }

    if (!chatId) {
      // Could be a private chat: for this app we require group chat id
      return res.status(400).json({ error: 'Group chat id required' });
    }

    req.tg = { userId, chatId, authDate: resVerify.authDate };
    return next();
  };
}

export function requireProjectMember(ProjectModel, ActorModel) {
  return async function projectMemberMiddleware(req, res, next) {
    try {
      const { chatId, userId } = req.tg || {};
      if (!chatId || !userId) return res.status(401).json({ error: 'Unauthorized' });
      // Dev bypass for dev-* chat namespaces
      if (!isProd && String(chatId).startsWith('dev-')) {
        req.project = { id: chatId, chat_id: chatId, name: 'Dev Project' };
        req.actor = { id: 'dev-actor', telegram_id: String(userId), is_admin: true, name: 'Dev User' };
        return next();
      }
      const project = await ProjectModel.findByChatId(chatId);
      if (!project) return res.status(404).json({ error: 'Project not found' });
      const actor = await ActorModel.findByTelegramId(String(userId), project.id);
      if (!actor) return res.status(403).json({ error: 'Forbidden' });
      req.project = project;
      req.actor = actor;
      next();
    } catch (err) {
      console.error('[auth] member middleware error', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

export function requireProjectAdmin() {
  return function adminMiddleware(req, res, next) {
    const actor = req.actor;
    if (!actor || !actor.is_admin) return res.status(403).json({ error: 'Admin rights required' });
    next();
  };
}
