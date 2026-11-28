(() => {
  'use strict';

  const TOKEN_KEY = 'admin_token';
  const PAGE_SIZE = 30;
  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const sections = Object.fromEntries(['stats', 'analytics', 'users', 'bugs'].map(name => [name, {
    name, page: 0, sequence: 0, hasData: false, controller: null,
  }]));
  const mutations = new Map();
  const reportButtons = new Map();
  let sessionEpoch = 0;
  let loginController = null;

  // API values only become text nodes. Tags, classes and handlers are local.
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  // The page is in Russian only (T-419, the owner, 26.11.2026); every word is
  // the native editor's (audit/evidence/T-419/natives-ru.md). What goes to the
  // server — statuses, filter values — stays as the API names it.
  const NB = String.fromCharCode(160); // a no-break space
  const TRY_AGAIN = 'Попробуйте ещё раз.';
  const MALFORMED = 'Сервер ответил не так, как ожидалось.';
  const LOGIN_FAILED = 'Не удалось войти. ' + TRY_AGAIN;
  const STALE = 'Показаны прежние данные — возможно, они устарели.';

  // The editor's strings are copied with ⍽ where a no-break space goes (T-425).
  const typeset = text => text.split('⍽').join(NB);

  // Registration dates (T-425): UTC days, both in, at most this many — the
  // server's cap (services/admin/people.js), checked here before asking.
  const MAX_PERIOD_DAYS = 366;
  const DAY_MS = 24 * 60 * 60 * 1000;
  const FILTERS_KEY = 'admin_filters';
  const COHORT_SOURCE = 'Свой / без проекта';
  const DATES_FORMAT = 'Неверная дата: нужен формат ГГГГ-ММ-ДД.';
  const DATES_ORDER = 'Начальная дата позже конечной.';
  const DATES_MISSING = 'Укажите обе даты.';
  const COHORT_DATES = 'Выберите даты теста.';
  const daysWord = n => (n % 10 === 1 && n % 100 !== 11 ? 'дня' : 'дней');
  const datesTooLong = n => 'Слишком длинный период: не больше ' + n + NB + daysWord(n) + '.';

  // A 400 the page can name, by the server's code; anything else is generic.
  function refusalText(refusal) {
    switch (refusal?.code) {
      case 'DATES_FORMAT': return DATES_FORMAT;
      case 'DATES_ORDER': return DATES_ORDER;
      case 'DATES_MISSING': return DATES_MISSING;
      case 'COHORT_DATES': return COHORT_DATES;
      case 'DATES_TOO_LONG':
        return datesTooLong(Number.isSafeInteger(refusal.maxDays) ? refusal.maxDays : MAX_PERIOD_DAYS);
      default: return null;
    }
  }

  class RequestError extends Error {}
  class ObsoleteRequest extends Error {}
  const malformedResponse = () => new RequestError(MALFORMED);
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isText = value => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
  const isNullableText = value => value === null || isText(value);
  const hasFields = (value, keys, valid = isText) => isObject(value)
    && keys.every(key => Object.hasOwn(value, key) && valid(value[key]));

  function ensureCurrent(request) {
    if (!request.isCurrent()) throw new ObsoleteRequest();
  }

  // The login screen's message for a failed answer: by its status, never the
  // server's text. A 503 is "not configured" only when adminAuth.js says so:
  // the database check and the rate limiter's store answer 503 too.
  async function loginFailure(response, request) {
    if (response.status === 400) return 'Введите пароль.';
    if (response.status === 401) return 'Неверный пароль.';
    if (response.status === 429) {
      const retryAfter = (response.headers.get('Retry-After') || '').trim();
      if (!/^\d+$/.test(retryAfter)) return `Слишком много попыток входа. Подождите до 15${NB}минут и попробуйте снова.`;
      const minutes = Math.max(1, Math.ceil(Number(retryAfter) / 60));
      return `Слишком много попыток входа. Попробуйте снова через ${minutes}${NB}мин.`;
    }
    if (response.status === 503) {
      let data;
      try { data = await response.json(); } catch { /* Not the configuration's answer. */ }
      ensureCurrent(request);
      if (data?.error === 'Admin panel not configured') {
        return 'Вход не настроен: на сервере не задан пароль администратора (ADMIN_PASSWORD_HASH или ADMIN_PASSWORD).';
      }
    }
    return LOGIN_FAILED;
  }

  // Both reads and writes use the same HTTP, JSON and session guards. Checking
  // after each await also protects a new session when cancellation is too late.
  async function api(path, request, options = {}) {
    ensureCurrent(request);
    const headers = { 'Content-Type': 'application/json' };
    if (request.token) headers.Authorization = 'Bearer ' + request.token;
    let response;
    try {
      response = await fetch('/admin/api' + path, {
        ...options, headers, signal: request.controller.signal,
      });
    } catch {
      ensureCurrent(request);
      throw new RequestError('Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.');
    }
    ensureCurrent(request);
    if (response.status === 401 && request.token) {
      resetSession();
      showLogin('Сессия истекла. Войдите снова.');
      throw new ObsoleteRequest();
    }
    if (!response.ok) {
      // The page's own words: never a server's error text, login included.
      if (!request.token) throw new RequestError(await loginFailure(response, request));
      if (response.status === 400) {
        let refusal;
        try { refusal = await response.json(); } catch { /* No code to name. */ }
        ensureCurrent(request);
        const text = refusalText(refusal);
        if (text) throw new RequestError(text);
      }
      throw new RequestError('Запрос не выполнен. ' + TRY_AGAIN);
    }
    let data;
    try { data = await response.json(); } catch {
      ensureCurrent(request);
      throw malformedResponse();
    }
    ensureCurrent(request);
    return data;
  }

  function setLoading(section, loading) {
    document.getElementById(section.name + '-section').setAttribute('aria-busy', String(loading));
    const indicator = document.getElementById(section.name + '-loading');
    indicator.textContent = section.hasData ? 'Обновление…' : 'Загрузка…';
    indicator.classList.toggle('hidden', !loading);
  }

  function setStale(section, text = '') {
    const indicator = document.getElementById(section.name + '-stale');
    indicator.textContent = text;
    indicator.classList.toggle('hidden', !text);
  }

  function clearSectionError(section) {
    const error = document.getElementById(section.name + '-error');
    error.replaceChildren();
    error.classList.add('hidden');
  }

  function resetSession({ clearToken = true } = {}) {
    sessionEpoch += 1;
    if (clearToken) localStorage.removeItem(TOKEN_KEY);
    loginController?.abort();
    loginController = null;
    document.getElementById('login-button').disabled = false;
    document.getElementById('login-button').textContent = 'Войти';
    document.getElementById('password-input').disabled = false;
    for (const section of Object.values(sections)) {
      section.controller?.abort();
      section.controller = null;
      section.sequence += 1;
      section.page = 0;
      section.hasData = false;
      setLoading(section, false);
      setStale(section);
      clearSectionError(section);
    }
    for (const mutation of mutations.values()) mutation.controller.abort();
    mutations.clear();
    reportButtons.clear();
    for (const id of ['stats-cards', 'analytics-body', 'users-body', 'bugs-body', 'users-pagination', 'bugs-pagination']) {
      document.getElementById(id).replaceChildren();
    }
    document.getElementById('stats-cards').classList.add('hidden');
    renderMutationStatus();
  }

  function showLogin(message = '') {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
    const error = document.getElementById('login-error');
    error.textContent = message;
    error.classList.toggle('hidden', !message);
  }

  function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
  }

  async function doLogin() {
    if (loginController) return;
    if (!document.getElementById('password-input').value) {
      showLogin('Введите пароль.');
      return;
    }
    const controller = new AbortController();
    loginController = controller;
    const epoch = sessionEpoch;
    const request = { controller, token: null, isCurrent: () => epoch === sessionEpoch && loginController === controller };
    const button = document.getElementById('login-button');
    const input = document.getElementById('password-input');
    const error = document.getElementById('login-error');
    const password = input.value;
    button.disabled = true;
    button.textContent = 'Вход…';
    input.disabled = true;
    error.classList.add('hidden');
    try {
      const data = await api('/login', request, { method: 'POST', body: JSON.stringify({ password }) });
      if (!isObject(data) || typeof data.token !== 'string' || !data.token.trim()) throw malformedResponse();
      ensureCurrent(request);
      resetSession({ clearToken: false });
      localStorage.setItem(TOKEN_KEY, data.token);
      input.value = '';
      showDashboard();
      loadAll();
    } catch (failure) {
      if (!request.isCurrent()) return;
      // An answer without a token is the server's odd reply; on this screen it asks to try again.
      error.textContent = !(failure instanceof RequestError) ? LOGIN_FAILED
        : failure.message === MALFORMED ? MALFORMED + ' ' + TRY_AGAIN : failure.message;
      error.classList.remove('hidden');
    } finally {
      if (request.isCurrent()) {
        loginController = null;
        button.disabled = false;
        button.textContent = 'Войти';
        input.disabled = false;
      }
    }
  }

  function doLogout() {
    resetSession();
    document.getElementById('password-input').value = '';
    showLogin();
  }

  // No value is a dash, not a hyphen.
  const NONE = '—';

  // A moment (createdAt, lastLoginAt…): its date in the browser's zone, дд.мм.гггг.
  function fmtDate(date) {
    if (!date) return NONE;
    const moment = new Date(date);
    if (Number.isNaN(moment.getTime())) return String(date);
    return moment.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // A date without a time (ГГГГ-ММ-ДД: weeks, days, last day in app, marks):
  // taken from the string. new Date would read it as UTC midnight, the day
  // before anywhere west of UTC (CLAUDE.md, rule 3).
  function fmtDay(day) {
    if (!day) return NONE;
    const text = String(day);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    return text.slice(8, 10) + '.' + text.slice(5, 7) + '.' + text.slice(0, 4);
  }

  // A decimal comma; whole numbers stay as they are. Text (never expected) is shown as it came.
  const decimal = value => (typeof value === 'number' ? value.toLocaleString('ru-RU') : String(value));
  const percent = value => (value === null || value === undefined ? NONE : decimal(value) + NB + '%');
  const share = (part, whole) => (whole ? part + ' (' + percent(Math.round((part / whole) * 1000) / 10) + ')' : String(part));
  // «X из Y (Z %)»; with nobody to count, no figure at all.
  const ratio = (part, of, rate) => (of ? part + ' из ' + of + ' (' + percent(rate) + ')' : NONE);
  const hoursText = (value, of) => (value === null || value === undefined ? 'пока никого'
    : decimal(value) + NB + 'ч (по ' + of + NB + 'чел.)');
  // Up to an hour in minutes, then hours with one decimal: «1440 мин» reads worse than «24 ч».
  const minutesText = minutes => (minutes === null || minutes === undefined ? NONE
    : minutes < 60 ? minutes + NB + 'мин'
      : (Math.round(minutes / 6) / 10).toLocaleString('ru-RU') + NB + 'ч');
  const capital = text => text.charAt(0).toUpperCase() + text.slice(1);

  // Codes from the data by their Russian names; a code the page does not know is shown as it is.
  const named = (names, code) => (Object.hasOwn(names, code) ? names[code] : code);
  const ROLES = { owner: 'владелец', admin: 'администратор', member: 'участник' };
  const SIGN_IN = { apple: 'Apple', google: 'Google', email: 'почта' };
  const STATUSES = [['new', 'Новая'], ['in_progress', 'В работе'], ['fixed', 'Исправлена']];
  // Each type by the heading of the notification itself in the Russian app.
  const INBOX_TYPES = {
    rehearsal_created: 'Новая репетиция / Вас позвали на репетицию',
    rehearsal_updated: 'Изменена репетиция',
    rehearsal_deleted: 'Отменена репетиция',
    rehearsal_removed: 'Вас сняли с репетиции',
    member_response: 'Репетиция просмотрена',
    member_joined: 'Новый участник',
    admin_appointed: 'Новый администратор',
    member_left: 'Участник вышел из проекта / Участник удалён',
    role_changed: 'Изменение роли',
    member_removed: 'Удаление из проекта',
    project_deleted: 'Проект удалён',
    rehearsal_reminder_24h: 'Напоминание за сутки',
    rehearsal_reminder_1h: 'Напоминание за час',
  };
  const EMAIL_CODES = {
    verify: 'Подтверждение адреса при регистрации',
    reset: 'Сброс пароля',
    change: 'Смена адреса: код на новый адрес',
    confirm: 'Смена адреса: код на текущий адрес',
  };
  const GROUPS = { invite: 'По приглашению', other: 'Свой / без проекта' };
  // A project's name in quotes as the app sets it (shared/quoteName.cjs, via public/admin/quoteName.js).
  const quoted = name => window.adminQuoteName(name, 'ru');

  function card(label, value, className = '') {
    const node = element('div', 'card' + (className ? ' ' + className : ''));
    node.append(element('div', 'card-label', label), element('div', 'card-value', value));
    return node;
  }

  // Each section owns its request sequence and last confirmed page. A failed
  // navigation retains that page, while Retry remembers the requested page.
  async function loadSection(section, page, path, validate, render) {
    if (section.name === 'bugs') {
      clearSavedMutations();
      renderMutationStatus();
    }
    section.controller?.abort();
    const controller = new AbortController();
    section.controller = controller;
    const sequence = ++section.sequence;
    const epoch = sessionEpoch;
    const token = getToken();
    const request = { controller, token, isCurrent: () => epoch === sessionEpoch
      && sequence === section.sequence && getToken() === token };
    // Only a read begun after a mutation response can resolve its feedback.
    const reconcilable = section.name === 'bugs'
      ? [...mutations.values()].filter(mutation => mutation.phase !== 'saving') : [];
    clearSectionError(section);
    setLoading(section, true);
    setStale(section, section.hasData ? 'Идёт обновление — пока показаны прежние данные.' : '');
    try {
      const data = await api(path, request);
      if (!validate(data)) throw malformedResponse();
      ensureCurrent(request);
      render(data, page);
      section.page = page;
      section.hasData = true;
      setStale(section);
      reconcileMutations(reconcilable, true, section.name === 'bugs' ? data.reports : []);
      return true;
    } catch (failure) {
      if (!request.isCurrent() || failure instanceof ObsoleteRequest) return false;
      const message = failure instanceof RequestError ? failure.message : TRY_AGAIN;
      const failed = {
        stats: 'Не удалось загрузить статистику.',
        analytics: 'Не удалось загрузить аналитику.',
        users: 'Не удалось загрузить пользователей.',
        bugs: 'Не удалось загрузить отчёты об ошибках.',
      }[section.name];
      const error = document.getElementById(section.name + '-error');
      const retry = element('button', 'btn', 'Повторить');
      retry.addEventListener('click', () => loadSection(section, page, path, validate, render));
      error.replaceChildren(element('span', '', failed + ' ' + message), retry);
      error.classList.remove('hidden');
      setStale(section, section.hasData ? STALE : '');
      reconcileMutations(reconcilable, false);
      return false;
    } finally {
      if (request.isCurrent()) {
        section.controller = null;
        setLoading(section, false);
      }
    }
  }

  // One line under a figure saying what exactly it counts. The space before a
  // dash is a no-break one, so that no line of it begins with the dash.
  function note(text) {
    return element('p', 'note', text.split(' — ').join(NB + '— '));
  }

  const byId = id => document.getElementById(id);
  // The test cohort counts only with dates: the switch sits beside them.
  const cohortOn = () => byId('filter-period').value === 'dates' && byId('filter-cohort').checked;
  const realDay = text => /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text))
    && new Date(Date.parse(text)).toISOString().slice(0, 10) === text;

  /**
   * The period (or dates), source, language and cohort every section is read
   * for, as a query; or what is wrong with the dates, before anything is asked.
   */
  function readFilters() {
    const params = new URLSearchParams();
    const period = byId('filter-period').value;
    if (period === 'dates') {
      const from = byId('filter-from').value;
      const to = byId('filter-to').value;
      if (!from && !to && cohortOn()) return { error: COHORT_DATES };
      if (!from || !to) return { error: DATES_MISSING };
      if (!realDay(from) || !realDay(to)) return { error: DATES_FORMAT };
      if (from > to) return { error: DATES_ORDER };
      if ((Date.parse(to) - Date.parse(from)) / DAY_MS + 1 > MAX_PERIOD_DAYS) return { error: datesTooLong(MAX_PERIOD_DAYS) };
      params.set('from', from);
      params.set('to', to);
      if (cohortOn()) params.set('cohort', '1');
    } else {
      params.set('period', period);
    }
    const source = byId('filter-source').value;
    if (source && !cohortOn()) params.set('source', source);
    const lang = byId('filter-lang').value;
    if (lang) params.set('lang', lang);
    return { query: params.toString() };
  }

  function showFilterError(text) {
    const error = byId('filter-error');
    error.textContent = text || '';
    error.classList.toggle('hidden', !text);
  }

  // Dates that cannot be asked for: nothing is sent, and what is shown is
  // marked as the earlier figures. A read still on its way is dropped.
  function withFilters(section, load) {
    const filters = readFilters();
    showFilterError(filters.error);
    if (!filters.error) return load(filters.query);
    section.controller?.abort();
    section.controller = null;
    section.sequence += 1;
    setLoading(section, false);
    clearSectionError(section);
    setStale(section, section.hasData ? STALE : '');
    return Promise.resolve(false);
  }

  // While the cohort is on, the source list shows what it is fixed to and
  // cannot be changed; turned off, the earlier choice comes back.
  let sourceBeforeCohort = '';
  function applyFilterControls() {
    const dates = byId('filter-period').value === 'dates';
    const on = cohortOn();
    byId('filter-dates').classList.toggle('hidden', !dates);
    byId('filter-dates-note').classList.toggle('hidden', !dates);
    byId('filter-cohort-note').classList.toggle('hidden', !dates);
    const select = byId('filter-source');
    let fixed = byId('filter-source-cohort');
    if (on && !fixed) {
      sourceBeforeCohort = select.value;
      fixed = element('option', '', COHORT_SOURCE);
      fixed.id = 'filter-source-cohort';
      fixed.value = 'cohort';
      select.append(fixed);
      select.value = 'cohort';
    } else if (!on && fixed) {
      fixed.remove();
      select.value = sourceBeforeCohort;
    }
    select.disabled = on;
  }

  // The dates and the switch outlive a reload; without storage, "all time".
  function saveFilters() {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify({ period: byId('filter-period').value,
        from: byId('filter-from').value, to: byId('filter-to').value, cohort: byId('filter-cohort').checked }));
    } catch { /* Not remembered: the page works the same. */ }
  }

  function restoreFilters() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(FILTERS_KEY) || 'null'); } catch { saved = null; }
    if (isObject(saved)) {
      const period = byId('filter-period');
      if ([...period.options].some(option => option.value === saved.period)) period.value = saved.period;
      for (const [key, id] of [['from', 'filter-from'], ['to', 'filter-to']]) {
        if (typeof saved[key] === 'string' && realDay(saved[key])) byId(id).value = saved[key];
      }
      byId('filter-cohort').checked = saved.cohort === true;
    }
    applyFilterControls();
  }

  function loadStats() {
    return withFilters(sections.stats, query => loadSection(sections.stats, 0, '/stats?' + query, data => isObject(data)
      && hasFields(data.users, ['total', 'newThisWeek', 'newThisMonth'])
      && hasFields(data.signIns, ['rate', 'notInLast30Days'])
      && hasFields(data.usage, ['projects', 'rehearsals']), data => {
      const users = card('Пользователи', data.users.total);
      const summary = element('div', 'card-sub');
      // The last 7 and 30 days back from now (since(7), since(30)), not a calendar week and month.
      summary.append(
        element('span', '', '+' + data.users.newThisWeek), ' за 7' + NB + 'дней, ',
        element('span', '', '+' + data.users.newThisMonth), ' за 30' + NB + 'дней',
      );
      users.append(summary, note('Аккаунты без служебных, подходящие под фильтры «Источник» и «Язык», на текущий момент; '
        + 'новые — зарегистрированные за последние 7 и 30' + NB + 'дней.'));
      // Sign-ins, not use: a session renews itself without one (H03).
      const signIns = card('Не входили 30' + NB + 'дней', percent(data.signIns.rate), 'card-churn');
      signIns.append(element('div', 'card-sub', 'Пользователей: ' + data.signIns.notInLast30Days
        + ' (сессия продлевается без входа, поэтому это не показатель использования)'),
      note('Последний вход (или регистрация, если входов не было) — больше 30' + NB + 'дней назад; '
        + 'доля — от пользователей из карточки «Пользователи».'));
      const projects = card('Проекты', data.usage.projects);
      projects.append(note('Все проекты, кроме проектов владельцев с адресом на rehearsly.me или demo.rehearsly.me.'));
      const rehearsals = card('Репетиции', data.usage.rehearsals);
      rehearsals.append(note('Все репетиции этих проектов — и прошедшие, и будущие.'));
      const container = document.getElementById('stats-cards');
      container.replaceChildren(users, signIns, projects, rehearsals);
      container.classList.remove('hidden');
    }));
  }

  function emptyRow(columns, message) {
    const row = element('tr');
    const cell = element('td', 'empty-cell', message);
    cell.colSpan = columns;
    row.append(cell);
    return row;
  }

  function validList(data, key, validateRow) {
    return isObject(data) && Number.isSafeInteger(data.total) && data.total >= 0
      && Array.isArray(data[key]) && data[key].every(validateRow);
  }

  const SOURCE_KINDS = ['invite', 'own', 'none'];
  const validUser = user => hasFields(user, ['id'])
    && hasFields(user, ['firstName', 'lastName', 'email', 'createdAt', 'lastLoginAt', 'locale', 'timezone'], isNullableText)
    && typeof user.service === 'boolean'
    && isObject(user.source) && SOURCE_KINDS.includes(user.source.kind)
    && hasFields(user.source, ['project', 'owner'], isNullableText)
    && Array.isArray(user.signIn) && user.signIn.every(isText)
    && isObject(user.steps) && isObject(user.steps.roles)
    && hasFields(user.steps, ['projects', 'marks', 'seen', 'onRoster', 'rehearsals'])
    && hasFields(user.steps, ['marksUntil'], isNullableText)
    && hasFields(user, ['lastAppDay'], isNullableText);

  // Without migration 016 nothing records use: say so, not "never" (T-294).
  const NOT_RECORDED = 'Нет данных: миграция' + NB + '016 не применена';

  // "Приглашение", not "приглашён(а)": the person's gender is not known.
  function sourceText(source) {
    if (source.kind === 'own') return 'Свой проект' + (source.project === null ? '' : ' ' + quoted(source.project));
    if (source.kind === 'invite') {
      return 'Приглашение в ' + quoted(source.project ?? '?') + (source.owner ? ' (владелец ' + source.owner + ')' : '');
    }
    return 'Без проекта';
  }

  function signInText(methods) {
    if (!methods.length) return NONE;
    const text = methods.map(method => named(SIGN_IN, method)).join(', ');
    return Object.hasOwn(SIGN_IN, methods[0]) ? capital(text) : text;
  }

  // Each step as «label: value», no declension; the cell begins with a capital.
  function stepsText(steps) {
    const roles = Object.entries(steps.roles).filter(([, n]) => n > 0).map(([role, n]) => named(ROLES, role) + ' — ' + n);
    return [
      'Онбординг: ' + (steps.onboarding ? 'да' : 'нет'),
      'проектов: ' + steps.projects + (roles.length ? ' (' + roles.join(', ') + ')' : ''),
      // «по» takes the date in: the last date the marks reach.
      'отметок: ' + (steps.marks ? steps.marks + ', по ' + fmtDay(steps.marksUntil) : 'нет'),
      'синхронизация календаря: ' + (steps.calendar ? 'да' : 'нет'),
      'устройство: ' + (steps.device ? 'есть' : 'нет'),
      'просмотрено: ' + steps.seen + ' из ' + steps.onRoster,
      'создано репетиций: ' + steps.rehearsals,
    ].join(' · ');
  }

  function loadUsers(page = 0) {
    const service = document.getElementById('show-service').checked ? '&service=1' : '';
    return withFilters(sections.users, query => loadSection(sections.users, page, '/users?limit=' + PAGE_SIZE + '&offset=' + (page * PAGE_SIZE)
      + '&' + query + service,
    data => validList(data, 'users', validUser) && typeof data.appDaysRecorded === 'boolean', data => {
      const rows = data.users.map(user => {
        const row = element('tr', user.service ? 'service-row' : '');
        row.append(
          element('td', '', (user.firstName || '') + ' ' + (user.lastName || '')),
          element('td', '', user.email + (user.service ? ' [служебный]' : '')),
          element('td', '', fmtDate(user.createdAt)),
          element('td', '', fmtDate(user.lastLoginAt)),
          element('td', '', data.appDaysRecorded ? fmtDay(user.lastAppDay) : NOT_RECORDED),
          element('td', '', sourceText(user.source)),
          element('td', '', signInText(user.signIn)),
          element('td', '', (user.locale || NONE) + ' / ' + (user.timezone || NONE)),
          element('td', 'steps-cell', stepsText(user.steps)),
        );
        return row;
      });
      document.getElementById('users-body').replaceChildren(...(rows.length ? rows : [emptyRow(9, 'Пользователей нет')]));
      renderPagination('users-pagination', data.total, page, loadUsers);
    }));
  }

  // Analytics: every value is text in a cell or a line, never markup.
  function table(headers, rows, empty = 'За этот период ничего нет') {
    const node = element('table', 'mini-table');
    const head = element('tr');
    headers.forEach(header => head.append(element('th', '', header)));
    const thead = element('thead');
    thead.append(head);
    const body = element('tbody');
    for (const cells of rows) {
      const row = element('tr');
      cells.forEach(cell => row.append(element('td', '', cell === null || cell === undefined ? NONE : String(cell))));
      body.append(row);
    }
    if (!rows.length) body.append(emptyRow(headers.length, empty));
    node.append(thead, body);
    const wrap = element('div', 'table-scroll');
    wrap.append(node);
    return wrap;
  }

  function block(title, ...children) {
    const node = element('div', 'analytics-block');
    node.append(element('h3', 'block-title', title), ...children);
    return node;
  }

  function renderFunnel(funnel) {
    const steps = ['registered', 'onboarding', 'project', 'marks', 'engaged'];
    const line = (label, group, counts) => [label, group,
      ...steps.map(step => share(counts[step], counts.registered))];
    const rows = [
      ...['invite', 'other'].map(group => line('Все недели', GROUPS[group], funnel.total[group])),
      ...funnel.weeks.flatMap(week => ['invite', 'other'].filter(group => week[group].registered > 0)
        .map(group => line(fmtDay(week.week), GROUPS[group], week[group]))),
    ];
    // «По 12 чел.»: the median over the 12 people who have the step.
    const medians = ['invite', 'other'].map(group => {
      const m = funnel.medians[group];
      return note(GROUPS[group] + ': медиана от регистрации до проекта — ' + hoursText(m.toProjectHours, m.toProjectOf)
        + ', до первых отметок занятости — ' + hoursText(m.toMarksHours, m.toMarksOf) + '.');
    });
    // «Пройден или пропущен»: "Skip" sets the same flag (skipOnboarding → completeOnboarding).
    return block('Воронка новичков',
      table(['Неделя регистрации', 'Источник', 'Зарегистрировались', 'Онбординг', 'В проекте', 'Отметки занятости',
        'Просмотрено / своя репетиция'], rows),
      note('Зарегистрировавшиеся за период — по неделям регистрации; неделя обозначена её понедельником (по UTC). '
        + 'Каждый шаг — доля зарегистрировавшихся, у кого он есть сейчас: онбординг пройден или пропущен; человек состоит в проекте; '
        + 'есть отметки занятости — свои или из календаря; хотя бы одна репетиция отмечена просмотренной (как участник) '
        + 'или создана (как организатор). «По приглашению» — тот же источник, что в таблице пользователей.'),
      ...medians,
      note('У онбординга не записано время — только сам факт, что он пройден или пропущен. Время до проекта считается '
        + 'до самого раннего участия, которое ещё действует. Время до первых отметок — до самой ранней из отметок, '
        + 'которые ещё хранятся: при повторном сохранении дня его отметки заменяются, поэтому у того, кто пересохранил '
        + 'свой первый день, первые отметки окажутся позже.'));
  }

  // Counted only for the people the source and language filters select (analytics.js: `everyone`).
  const FILTERED = ' Считаются только люди, подходящие под фильтры «Источник» и «Язык».';

  function renderSources(sources) {
    const counts = rows => rows.map(row => [fmtDay(row.date), row.invite, row.own, row.none]);
    // The weeks are Mondays in UTC (analytics.js, weekOf); retention's are in the person's zone.
    return block('Откуда приходят люди',
      table(['Неделя (понедельник, UTC)', 'По приглашению', 'Свой проект', 'Без проекта'], counts(sources.byWeek)),
      note('Аккаунты без служебных, зарегистрированные за период, — по неделям и по источнику, как в таблице пользователей.'),
      table(['День (UTC)', 'По приглашению', 'Свой проект', 'Без проекта'], counts(sources.byDay)),
      note('То же по дням; дни без регистраций не показаны.'),
      table(['Проект', 'Владелец', 'Присоединились за период', 'Из них пришли через него'],
        sources.projects.map(row => [row.project, row.owner, row.joined, row.newcomers])),
      note('Присоединились: действующие участники, кроме владельца, чьё участие в проекте началось за период. '
        + 'Из них пришли через него: зарегистрировавшиеся за период, у которых это первый проект и попали они в него '
        + 'по приглашению.' + FILTERED),
      table(['Язык', 'Людей'], sources.languages.map(row => [row.value, row.people])),
      table(['Часовой пояс', 'Людей'], sources.timezones.map(row => [row.value, row.people])),
      note('Язык и часовой пояс — как они сохранены у зарегистрировавшихся за период.'));
  }

  function renderProjects(projects) {
    // A project with only a future rehearsal is listed too: since_start has no upper bound.
    return block('Проекты',
      table(['Проект', 'Владелец', 'Создан', 'Участников', 'Репетиций', 'За 4' + NB + 'недели', 'Ближайшая',
        'Просмотрено до начала (30' + NB + 'дн.)', 'Покрытие занятости (14' + NB + 'дн.)'],
      projects.map(p => [p.name, p.owner, fmtDate(p.createdAt), p.members, p.rehearsals, p.rehearsalsLastFourWeeks,
        fmtDate(p.nextRehearsalAt), ratio(p.seenBeforeStart.seen, p.seenBeforeStart.of, p.seenBeforeStart.rate),
        ratio(p.coverage.people, p.coverage.of, p.coverage.rate)])),
      note('Проекты, созданные за период, или с репетицией, которая начинается не раньше начала периода (в том числе в будущем); '
        + 'проекты владельцев с адресом на rehearsly.me или demo.rehearsly.me не показаны. В столбце «Участников» — '
        + 'действующие участники, подходящие под фильтры «Источник» и «Язык».'),
      // Places on rosters, a person on a rehearsal each, not people (roster.js, seenBeforeStart).
      note('Просмотрено до начала: из мест в составах репетиций, начавшихся за последние 30' + NB + 'дней (место — один человек '
        + 'на одной репетиции), — сколько отмечены просмотренными, причём последнее изменение отметки было раньше начала. '
        + 'Кого больше нет в проекте, тот не входит ни в один состав.' + FILTERED),
      note('Покрытие занятости: участники, у которых в ближайшие 14' + NB + 'дней есть хоть одна своя отметка или событие '
        + 'из календаря (отметки на весь день — по датам UTC, начиная с сегодняшней). День без отметок считается свободным, '
        + 'поэтому это доля тех, кто вообще что-то внёс.'));
  }

  function renderNotifications(notifications) {
    const d = notifications.devices;
    return block('Уведомления и письма',
      element('p', 'metric', 'Есть устройство для уведомлений: ' + ratio(d.people, d.of, d.rate)),
      note('Зарегистрировавшиеся за период, у которых есть хотя бы одно устройство, подключённое к push-уведомлениям.'),
      table(['Тип уведомления', 'Создано', 'Прочитано', 'Доля прочитанных', 'Медиана до прочтения'],
        notifications.inbox.map(row => [named(INBOX_TYPES, row.type), row.created, row.read, percent(row.readRate),
          minutesText(row.medianMinutesToRead)])),
      // read_at is set by opening one and by "Прочитать все" alike (markRead(…, 'all')); a
      // notification the person deleted is gone from the table (deleteNotifications).
      note('Уведомления в приложении (экран «Уведомления»), созданные за период, у людей, подходящих под фильтры «Источник» '
        + 'и «Язык» (дата регистрации любая); прочитано — с тех пор открыты или отмечены кнопкой «Прочитать все». '
        + 'Медиана — по прочитанным. Уведомления, которые человек удалил, не учитываются.'),
      table(['Код из письма', 'Создано', 'Отправлено', 'Не отправлено', 'Использовано', 'Заменено', 'Заблокировано'],
        notifications.emailCodes.map(row => [named(EMAIL_CODES, row.purpose), row.created, row.sent, row.failed, row.used,
          row.replaced, row.locked])),
      note('Коды, созданные за период. Отправлено: почтовый сервис принял письмо. Не отправлено: сервис его отклонил. '
        + 'Заменено: код закрыт, когда выдали новый. Заблокировано: пять неверных попыток. Использовано: код закрыт иначе — '
        + 'введён верно или аннулирован сбросом пароля либо сменой адреса; таблица эти случаи не различает.' + FILTERED),
      note('Отчёты об ошибках — в своём разделе ниже.'));
  }

  function renderUsage(usage) {
    if (!usage.recorded) {
      return block('Использование приложения', element('p', 'metric', 'Нет данных: миграция' + NB + '016 не применена.'),
        note('Дни в приложении, сборки и счётчики приглашений записываются, только когда применена миграция' + NB + '016. '
          + 'До этого считать нечего — а это не то же самое, что «приложением никто не пользуется».'));
    }
    const a = usage.active;
    const opened = cell => ratio(cell.opened, cell.of, cell.rate);
    // usage.js, activeWithin: 7 and 30 dates in the person's zone, today included.
    return block('Использование приложения',
      element('p', 'metric', 'Активных сегодня: ' + share(a.day, a.of) + ' · за 7' + NB + 'дней: ' + share(a.week, a.of)
        + ' · за 30' + NB + 'дней: ' + share(a.month, a.of)),
      note('Люди без служебных, подходящие под фильтры «Источник» и «Язык» (дата регистрации любая), которые пользовались '
        + 'приложением — то есть в их сессии был хоть один запрос — хотя бы в один из этих дней, по дате в их часовом поясе. '
        + '7 и 30' + NB + 'дней — это календарные даты по поясу человека, считая сегодняшнюю, а не сутки от текущего момента, '
        + 'как в фильтре. ' + (usage.since ? 'Записи ведутся с ' + fmtDay(usage.since) + '.' : 'Записей пока нет.')),
      table(['Неделя регистрации', 'Зарегистрировались', 'День' + NB + '1', 'День' + NB + '7', 'День' + NB + '30'],
        usage.retention.map(row => [fmtDay(row.week), row.registered, opened(row.day1), opened(row.day7), opened(row.day30)])),
      note('Зарегистрировавшиеся за период — по неделе, на которую пришлась дата регистрации в их часовом поясе (неделя '
        + 'обозначена понедельником): кто открывал приложение на 1-й, 7-й и 30-й день после регистрации (день регистрации — '
        + 'нулевой). В «из» входят только те, у кого этот день уже закончился и пришёлся на время, когда записи уже велись.'),
      table(['Сборка приложения', 'Людей'], usage.builds.map(row => [row.build === null ? 'Не указана' : row.build, row.people]),
        'За последние 30' + NB + 'дней активных не было'),
      note('У активных за последние 30' + NB + 'дней — сборка из их последнего дня, когда она была указана: видно, что ещё '
        + 'в ходу, прежде чем поднимать MIN_IOS_BUILD.'),
      table(['Проект', 'Владелец', 'Открытий страницы приглашения', 'Открытий в приложении', 'Присоединений'],
        usage.invitations.map(row => [row.project, row.owner, row.pageOpens, row.appOpens, row.joins])),
      note('С начала периода (дни по UTC). Открытия страницы: страницу приглашения открыли в браузере, не считая превью ссылок. '
        + 'Открытия в приложении: приглашение открыли в приложении — по ссылке или со страницы. Присоединения: присоединились '
        + 'к проекту по приглашению. Это только счётчики — ни с кем из людей они не связаны. Проекты владельцев с адресом '
        + 'на rehearsly.me или demo.rehearsly.me не показаны.'));
  }

  const validUsage = usage => isObject(usage) && typeof usage.recorded === 'boolean' && (!usage.recorded
    || (isObject(usage.active) && hasFields(usage.active, ['day', 'week', 'month', 'of'])
      && hasFields(usage, ['since'], isNullableText)
      && Array.isArray(usage.retention) && usage.retention.every(row => isObject(row)
        && ['day1', 'day7', 'day30'].every(key => isObject(row[key])))
      && Array.isArray(usage.builds) && Array.isArray(usage.invitations)));

  // The test cohort and the week before it (T-425). The strings are the editor's
  // (audit/evidence/T-425/natives-ru.md); the organiser's steps after «Создали
  // проект» and the calendar apart from hand marks are T-427's and T-426's.
  const dayMonth = day => String(day).slice(8, 10) + '.' + String(day).slice(5, 7);
  const span = column => '(' + (column.from === column.to ? dayMonth(column.from)
    : dayMonth(column.from) + '–' + dayMonth(column.to)) + ')';

  function renderCohort(cohort) {
    // A cell with nobody whose time is up stays empty, not 0 (the note says so).
    const part = value => (value === null ? '' : ratio(value.count, value.of, value.rate));
    const opened = value => (cohort.recorded ? part(value) : NOT_RECORDED);
    const rows = [
      ['Зарегистрировались', column => String(column.registered)],
      [typeset('В среднем за⍽день'), column => decimal(column.perDay)],
      [typeset('Онбординг (на⍽текущий момент)'), column => part(column.onboarding)],
      typeset('За⍽первые ' + cohort.stepDays + '⍽дней после регистрации'),
      ['Создали проект', column => part(column.project)],
      ['В проекте', column => part(column.inProject)],
      ['Отметки занятости', column => part(column.marks)],
      [typeset('Открыли приложение на⍽1-й⍽день'), column => opened(column.day1)],
      [typeset('Открыли приложение на⍽7-й⍽день'), column => opened(column.day7)],
    ];
    const columns = [cohort.test, cohort.before];
    const node = element('table', 'mini-table cohort-table');
    const head = element('tr');
    head.append(element('th', '', ''), element('th', '', 'Когорта ' + span(cohort.test)),
      element('th', '', typeset('Неделя до⍽теста ') + span(cohort.before)));
    const thead = element('thead');
    thead.append(head);
    const body = element('tbody');
    for (const row of rows) {
      const line = element('tr', typeof row === 'string' ? 'cohort-divider' : '');
      if (typeof row === 'string') {
        const cell = element('td', '', row);
        cell.colSpan = columns.length + 1;
        line.append(cell);
      } else {
        line.append(element('td', '', row[0]), ...columns.map(column => element('td', '', row[1](column))));
      }
      body.append(line);
    }
    node.append(thead, body);
    const wrap = element('div', 'table-scroll');
    wrap.append(node);
    return block('Тестовая когорта', wrap,
      note(typeset('Неделя до⍽теста⍽— семь дней перед первым днём когорты, с⍽тем же отбором по⍽источнику и⍽языку. '
        + 'По⍽ней видно, сколько людей приходит и⍽без рекламы. Чтобы у⍽столбцов был равный срок, шаги считаются '
        + 'за⍽первые 7⍽дней после регистрации, а⍽доля⍽— от⍽тех, у⍽кого эти 7⍽дней уже прошли; для 1-го и⍽7-го '
        + 'дня⍽— от⍽тех, у⍽кого этот день уже закончился (день регистрации⍽— нулевой). Онбординг⍽— на⍽текущий '
        + 'момент и⍽от⍽всех зарегистрировавшихся: у⍽него не записано время. '
        + 'Пустая ячейка: срок ещё ни у⍽кого не прошёл.')));
  }

  const validShare = value => value === null || hasFields(value, ['count', 'of', 'rate']);
  const validColumn = column => hasFields(column, ['from', 'to', 'registered', 'perDay'])
    && ['onboarding', 'project', 'inProject', 'marks', 'day1', 'day7'].every(key => Object.hasOwn(column, key)
      && validShare(column[key]));
  const validCohort = cohort => cohort === undefined || (isObject(cohort) && typeof cohort.recorded === 'boolean'
    && Number.isSafeInteger(cohort.stepDays) && validColumn(cohort.test) && validColumn(cohort.before));

  const validAnalytics = data => isObject(data) && Array.isArray(data.languages) && data.languages.every(isText)
    && validUsage(data.usage) && validCohort(data.cohort)
    && isObject(data.funnel) && Array.isArray(data.funnel.weeks) && isObject(data.funnel.total) && isObject(data.funnel.medians)
    && isObject(data.sources) && ['byDay', 'byWeek', 'projects', 'languages', 'timezones'].every(key => Array.isArray(data.sources[key]))
    && Array.isArray(data.projects) && data.projects.every(p => isObject(p) && isObject(p.seenBeforeStart) && isObject(p.coverage))
    && isObject(data.notifications) && isObject(data.notifications.devices)
    && Array.isArray(data.notifications.inbox) && Array.isArray(data.notifications.emailCodes);

  // The language list comes from the data; the current choice stays selected.
  function renderLanguages(languages) {
    const select = document.getElementById('filter-lang');
    const current = select.value;
    const options = [element('option', '', 'Все языки')];
    options[0].value = '';
    for (const language of new Set([...languages, ...(current ? [current] : [])])) {
      const option = element('option', '', language);
      option.value = language;
      options.push(option);
    }
    select.replaceChildren(...options);
    select.value = current;
  }

  function loadAnalytics() {
    return withFilters(sections.analytics, query => loadSection(sections.analytics, 0, '/analytics?' + query, validAnalytics, data => {
      renderLanguages(data.languages);
      document.getElementById('analytics-body').replaceChildren(
        ...(data.cohort ? [renderCohort(data.cohort)] : []),
        note('Зарегистрировались за период: ' + data.people + ' (без служебных аккаунтов).'),
        renderFunnel(data.funnel), renderSources(data.sources),
        renderUsage(data.usage), renderProjects(data.projects), renderNotifications(data.notifications));
    }));
  }

  function renderPagination(id, total, page, loadPage) {
    const container = document.getElementById(id);
    const pages = Math.ceil(total / PAGE_SIZE);
    container.replaceChildren();
    if (pages <= 1) return;
    if (page > 0) {
      const prev = element('button', 'btn', 'Предыдущая');
      prev.addEventListener('click', () => loadPage(page - 1));
      container.append(prev);
    }
    container.append(element('span', 'page-label', 'Страница ' + (page + 1) + ' из ' + pages));
    if (page < pages - 1) {
      const next = element('button', 'btn', 'Следующая');
      next.addEventListener('click', () => loadPage(page + 1));
      container.append(next);
    }
  }

  function statusButtons(id, current) {
    const cell = element('td');
    const buttons = [];
    // The label is the page's; the value sent in the PATCH stays the API's.
    STATUSES.forEach(([status, label], index) => {
      const button = element('button', 'status-btn status-btn-' + status + (status === current ? ' active' : ''), label);
      button.disabled = Boolean(mutations.get(String(id))?.pending);
      button.addEventListener('click', () => setBugStatus(id, status));
      if (index) cell.append(' ');
      cell.append(button);
      buttons.push(button);
    });
    reportButtons.set(String(id), buttons);
    return cell;
  }

  function renderMutationStatus() {
    const region = document.getElementById('bugs-mutation-status');
    const messages = [];
    let needsReload = false;
    for (const mutation of mutations.values()) {
      const copy = {
        saving: 'сохраняем статус…',
        unconfirmed: 'не удалось подтвердить смену статуса. Возможно, сервер её всё же сохранил: обновите отчёты и проверьте, '
          + 'прежде чем пробовать снова.',
        'saved-refreshing': 'статус сохранён. Обновляем отчёты…',
        'saved-stale': 'статус сохранён, но список отчётов обновить не удалось. ' + STALE,
        saved: 'статус сохранён.',
      }[mutation.phase];
      messages.push(element('p', '', 'Отчёт №' + NB + mutation.id + ': ' + copy));
      needsReload ||= ['unconfirmed', 'saved-stale'].includes(mutation.phase);
      for (const button of reportButtons.get(String(mutation.id)) || []) button.disabled = mutation.pending;
    }
    if (needsReload) {
      const reload = element('button', 'btn', 'Обновить отчёты');
      reload.addEventListener('click', () => loadBugReports(sections.bugs.page));
      messages.push(reload);
    }
    region.replaceChildren(...messages);
    region.setAttribute('role', needsReload ? 'alert' : 'status');
    region.classList.toggle('mutation-error', needsReload);
    region.classList.toggle('hidden', !messages.length);
  }

  function clearSavedMutations() {
    for (const [key, mutation] of mutations) {
      if (mutation.phase === 'saved') mutations.delete(key);
    }
  }

  function reconcileMutations(entries, succeeded, reports = []) {
    const returnedIds = new Set(reports.map(report => String(report.id)));
    for (const mutation of entries) {
      const key = String(mutation.id);
      if (mutations.get(key) !== mutation) continue;
      if (mutation.phase === 'unconfirmed') {
        // Another page says nothing about this report. In particular, a saved
        // status may have moved it elsewhere in the server's sorted list.
        if (succeeded && returnedIds.has(key)) mutations.delete(key);
      } else {
        mutation.phase = succeeded ? 'saved' : 'saved-stale';
        mutation.pending = false;
      }
    }
    renderMutationStatus();
  }

  async function setBugStatus(id, status) {
    const key = String(id);
    if (mutations.get(key)?.pending) return;
    clearSavedMutations();
    const mutation = { id, phase: 'saving', pending: true, controller: new AbortController() };
    mutations.set(key, mutation);
    const epoch = sessionEpoch;
    const token = getToken();
    const request = { controller: mutation.controller, token, isCurrent: () => epoch === sessionEpoch
      && getToken() === token && mutations.get(key) === mutation };
    renderMutationStatus();
    try {
      const data = await api('/bug-reports/' + encodeURIComponent(id) + '/status', request, {
        method: 'PATCH', body: JSON.stringify({ status }),
      });
      if (!isObject(data) || data.success !== true) throw malformedResponse();
      ensureCurrent(request);
      mutation.phase = 'saved-refreshing';
      renderMutationStatus();
      await loadBugReports(sections.bugs.page);
    } catch (failure) {
      if (!request.isCurrent() || failure instanceof ObsoleteRequest) return;
      mutation.phase = 'unconfirmed';
      mutation.pending = false;
      renderMutationStatus();
    }
  }

  function loadBugReports(page = 0) {
    return loadSection(sections.bugs, page, '/bug-reports?limit=' + PAGE_SIZE + '&offset=' + (page * PAGE_SIZE),
      data => validList(data, 'reports', report => hasFields(report, ['id', 'name', 'message', 'status', 'createdAt'])
        && (report.screen === undefined || isNullableText(report.screen))), data => {
        reportButtons.clear();
        const rows = data.reports.map(report => {
          const row = element('tr');
          row.append(
            element('td', '', report.name),
            element('td', 'msg-cell', report.message),
            element('td', 'screen-cell', report.screen || NONE),
            statusButtons(report.id, report.status),
            element('td', '', fmtDate(report.createdAt)),
          );
          return row;
        });
        document.getElementById('bugs-body').replaceChildren(...(rows.length ? rows : [emptyRow(5, 'Отчётов об ошибках нет')]));
        renderPagination('bugs-pagination', data.total, page, loadBugReports);
      });
  }

  function loadAll() {
    loadStats();
    loadAnalytics();
    loadUsers(0);
    loadBugReports(0);
  }

  restoreFilters();
  for (const id of ['filter-period', 'filter-from', 'filter-to', 'filter-cohort', 'filter-source', 'filter-lang']) {
    document.getElementById(id).addEventListener('change', () => {
      applyFilterControls();
      saveFilters();
      loadStats();
      loadAnalytics();
      loadUsers(0);
    });
  }
  document.getElementById('show-service').addEventListener('change', () => loadUsers(0));
  document.getElementById('login-button').addEventListener('click', doLogin);
  document.getElementById('refresh-button').addEventListener('click', loadAll);
  document.getElementById('logout-button').addEventListener('click', doLogout);
  document.getElementById('password-input').addEventListener('keydown', event => {
    if (event.key === 'Enter') doLogin();
  });
  window.addEventListener('storage', event => {
    if (event.storageArea !== localStorage || (event.key !== TOKEN_KEY && event.key !== null)) return;
    // Another tab owns the new shared credential. Cancel this tab's old work
    // without deleting that credential, then start a clean session scope.
    resetSession({ clearToken: false });
    document.getElementById('password-input').value = '';
    if (getToken()) {
      showDashboard();
      loadAll();
    } else {
      showLogin();
    }
  });
  if (getToken()) {
    showDashboard();
    loadAll();
  } else {
    showLogin();
  }
})();
