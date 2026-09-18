(() => {
  'use strict';

  const TOKEN_KEY = 'admin_token';
  const PAGE_SIZE = 30;
  let usersPage = 0;
  let bugsPage = 0;
  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const clearToken = () => localStorage.removeItem(TOKEN_KEY);

  // API data is always text. Tags, class names and event handlers are defined
  // locally, never assembled from a profile, report or other response value.
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  async function api(path, opts) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = 'Bearer ' + token;
    const res = await fetch('/admin/api' + path, Object.assign({ headers }, opts || {}));
    if (res.status === 401) { clearToken(); showLogin(); throw new Error('Unauthorized'); }
    return res.json();
  }

  function showLogin() {
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('dashboard').classList.add('hidden');
  }

  function showDashboard() {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('dashboard').classList.remove('hidden');
  }

  async function doLogin() {
    const password = document.getElementById('password-input').value;
    const error = document.getElementById('login-error');
    error.classList.add('hidden');
    try {
      const data = await fetch('/admin/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      }).then(res => res.json());
      if (data.token) {
        localStorage.setItem(TOKEN_KEY, data.token);
        showDashboard();
        loadAll();
      } else {
        error.textContent = data.error || 'Login failed';
        error.classList.remove('hidden');
      }
    } catch {
      error.textContent = 'Connection error';
      error.classList.remove('hidden');
    }
  }

  function doLogout() {
    clearToken();
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

  async function loadStats() {
    try {
      const data = await api('/stats');
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
      document.getElementById('stats-loading').classList.add('hidden');
    } catch { /* Existing API error handling is tracked separately in H04. */ }
  }

  function emptyRow(columns, message) {
    const row = element('tr');
    const cell = element('td', 'empty-cell', message);
    cell.colSpan = columns;
    row.append(cell);
    return row;
  }

  async function loadUsers(page = 0) {
    usersPage = page;
    try {
      const data = await api('/users?limit=' + PAGE_SIZE + '&offset=' + (usersPage * PAGE_SIZE));
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
      document.getElementById('users-body').replaceChildren(
        ...(rows.length ? rows : [emptyRow(4, 'No users')]),
      );
      renderPagination('users-pagination', data.total, usersPage, loadUsers);
    } catch { /* Existing API error handling is tracked separately in H04. */ }
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
    const statuses = [['new', 'new'], ['in_progress', 'in progress'], ['fixed', 'fixed']];
    statuses.forEach(([status, label], index) => {
      const button = element('button', 'status-btn status-btn-' + status + (status === current ? ' active' : ''), label);
      button.addEventListener('click', () => setBugStatus(id, status));
      if (index) cell.append(' ');
      cell.append(button);
    });
    return cell;
  }

  async function setBugStatus(id, status) {
    try {
      await fetch('/admin/api/bug-reports/' + encodeURIComponent(id) + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + getToken() },
        body: JSON.stringify({ status }),
      });
      loadBugReports(bugsPage);
    } catch (error) { console.error(error); }
  }

  async function loadBugReports(page = 0) {
    bugsPage = page;
    try {
      const data = await api('/bug-reports?limit=' + PAGE_SIZE + '&offset=' + (bugsPage * PAGE_SIZE));
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
      document.getElementById('bugs-body').replaceChildren(
        ...(rows.length ? rows : [emptyRow(5, 'No bug reports')]),
      );
      renderPagination('bugs-pagination', data.total, bugsPage, loadBugReports);
    } catch { /* Existing API error handling is tracked separately in H04. */ }
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
  if (getToken()) {
    showDashboard();
    loadAll();
  } else {
    showLogin();
  }
})();
