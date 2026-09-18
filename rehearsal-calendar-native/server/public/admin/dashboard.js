(() => {
  'use strict';

  const TOKEN_KEY = 'admin_token';
  const PAGE_SIZE = 30;
  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const sections = Object.fromEntries(['stats', 'users', 'bugs'].map(name => [name, {
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

  class RequestError extends Error {}
  class ObsoleteRequest extends Error {}
  const malformedResponse = () => new RequestError('The server returned an unexpected response.');
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isText = value => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
  const isNullableText = value => value === null || isText(value);
  const hasFields = (value, keys, valid = isText) => isObject(value)
    && keys.every(key => Object.hasOwn(value, key) && valid(value[key]));

  function ensureCurrent(request) {
    if (!request.isCurrent()) throw new ObsoleteRequest();
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
      throw new RequestError('Connection error. Check your connection and try again.');
    }
    ensureCurrent(request);
    if (response.status === 401 && request.token) {
      resetSession();
      showLogin('Your session has expired. Please log in again.');
      throw new ObsoleteRequest();
    }
    if (!response.ok) {
      // Preserve the login endpoint's short password error as literal text.
      // Never display internal errors from server failures or dashboard APIs.
      if (!request.token && [400, 401].includes(response.status)) {
        let data;
        try { data = await response.json(); } catch { /* Use the safe fallback below. */ }
        ensureCurrent(request);
        throw new RequestError(typeof data?.error === 'string' && data.error.length <= 300
          ? data.error : 'Login failed. Please check your password.');
      }
      throw new RequestError('The request failed. Please try again.');
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
    indicator.textContent = section.hasData ? 'Refreshing...' : 'Loading...';
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
    document.getElementById('login-button').textContent = 'Log in';
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
    for (const id of ['stats-cards', 'users-body', 'bugs-body', 'users-pagination', 'bugs-pagination']) {
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
    const controller = new AbortController();
    loginController = controller;
    const epoch = sessionEpoch;
    const request = { controller, token: null, isCurrent: () => epoch === sessionEpoch && loginController === controller };
    const button = document.getElementById('login-button');
    const input = document.getElementById('password-input');
    const error = document.getElementById('login-error');
    const password = input.value;
    button.disabled = true;
    button.textContent = 'Logging in...';
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
      error.textContent = failure instanceof RequestError ? failure.message : 'Login failed. Please try again.';
      error.classList.remove('hidden');
    } finally {
      if (request.isCurrent()) {
        loginController = null;
        button.disabled = false;
        button.textContent = 'Log in';
        input.disabled = false;
      }
    }
  }

  function doLogout() {
    resetSession();
    document.getElementById('password-input').value = '';
    showLogin();
  }

  function fmtDate(date) {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

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
    setStale(section, section.hasData ? 'Showing previously loaded data while refreshing.' : '');
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
      const message = failure instanceof RequestError ? failure.message : 'Please try again.';
      const label = { stats: 'statistics', users: 'users', bugs: 'bug reports' }[section.name];
      const error = document.getElementById(section.name + '-error');
      const retry = element('button', 'btn', 'Retry');
      retry.addEventListener('click', () => loadSection(section, page, path, validate, render));
      error.replaceChildren(element('span', '', 'Could not load ' + label + '. ' + message), retry);
      error.classList.remove('hidden');
      setStale(section, section.hasData ? 'Showing previously loaded data; it may be out of date.' : '');
      reconcileMutations(reconcilable, false);
      return false;
    } finally {
      if (request.isCurrent()) {
        section.controller = null;
        setLoading(section, false);
      }
    }
  }

  function loadStats() {
    return loadSection(sections.stats, 0, '/stats', data => isObject(data)
      && hasFields(data.users, ['total', 'newThisWeek', 'newThisMonth'])
      && isObject(data.churn) && hasFields(data.churn.users, ['rate', 'inactiveLast30Days'])
      && hasFields(data.usage, ['projects', 'rehearsals']), data => {
      const users = card('Users', data.users.total);
      const summary = element('div', 'card-sub');
      summary.append(
        element('span', '', '+' + data.users.newThisWeek), ' this week, ',
        element('span', '', '+' + data.users.newThisMonth), ' this month',
      );
      users.append(summary);
      const churn = card('User Churn (30 days)', data.churn.users.rate + '%', 'card-churn');
      churn.append(element('div', 'card-sub', 'Inactive users: ' + data.churn.users.inactiveLast30Days));
      const container = document.getElementById('stats-cards');
      container.replaceChildren(users, churn,
        card('Projects', data.usage.projects), card('Rehearsals', data.usage.rehearsals));
      container.classList.remove('hidden');
    });
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

  function loadUsers(page = 0) {
    return loadSection(sections.users, page, '/users?limit=' + PAGE_SIZE + '&offset=' + (page * PAGE_SIZE),
      data => validList(data, 'users', user => hasFields(user, ['id'])
        && hasFields(user, ['firstName', 'lastName', 'email', 'createdAt', 'lastLoginAt'], isNullableText)), data => {
        const rows = data.users.map(user => {
          const row = element('tr');
          row.append(
            element('td', '', (user.firstName || '') + ' ' + (user.lastName || '')),
            element('td', '', user.email),
            element('td', '', fmtDate(user.createdAt)),
            element('td', '', fmtDate(user.lastLoginAt)),
          );
          return row;
        });
        document.getElementById('users-body').replaceChildren(...(rows.length ? rows : [emptyRow(4, 'No users')]));
        renderPagination('users-pagination', data.total, page, loadUsers);
      });
  }

  function renderPagination(id, total, page, loadPage) {
    const container = document.getElementById(id);
    const pages = Math.ceil(total / PAGE_SIZE);
    container.replaceChildren();
    if (pages <= 1) return;
    if (page > 0) {
      const prev = element('button', 'btn', 'Prev');
      prev.addEventListener('click', () => loadPage(page - 1));
      container.append(prev);
    }
    container.append(element('span', 'page-label', 'Page ' + (page + 1) + ' of ' + pages));
    if (page < pages - 1) {
      const next = element('button', 'btn', 'Next');
      next.addEventListener('click', () => loadPage(page + 1));
      container.append(next);
    }
  }

  function statusButtons(id, current) {
    const cell = element('td');
    const buttons = [];
    const statuses = [['new', 'new'], ['in_progress', 'in progress'], ['fixed', 'fixed']];
    statuses.forEach(([status, label], index) => {
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
        saving: 'Saving report status...',
        unconfirmed: 'Could not confirm the status change. The server may have saved it. Reload reports to check before trying again.',
        'saved-refreshing': 'Status saved. Refreshing reports...',
        'saved-stale': 'Status saved, but the report list could not be refreshed. Showing previously loaded data; it may be out of date.',
        saved: 'Status saved.',
      }[mutation.phase];
      messages.push(element('p', '', 'Report ' + mutation.id + ': ' + copy));
      needsReload ||= ['unconfirmed', 'saved-stale'].includes(mutation.phase);
      for (const button of reportButtons.get(String(mutation.id)) || []) button.disabled = mutation.pending;
    }
    if (needsReload) {
      const reload = element('button', 'btn', 'Reload reports');
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
            element('td', 'screen-cell', report.screen || '-'),
            statusButtons(report.id, report.status),
            element('td', '', fmtDate(report.createdAt)),
          );
          return row;
        });
        document.getElementById('bugs-body').replaceChildren(...(rows.length ? rows : [emptyRow(5, 'No bug reports')]));
        renderPagination('bugs-pagination', data.total, page, loadBugReports);
      });
  }

  function loadAll() {
    loadStats();
    loadUsers(0);
    loadBugReports(0);
  }

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
