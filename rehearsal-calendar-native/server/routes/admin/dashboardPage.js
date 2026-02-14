export function generateAdminPageHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin — Rehearsal Calendar</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      min-height: 100vh;
    }
    .header {
      padding: 16px 24px;
      background: #161b22;
      border-bottom: 1px solid rgba(139,148,158,0.2);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header h1 { font-size: 18px; font-weight: 600; }
    .header-actions { display: flex; gap: 8px; align-items: center; }
    .btn {
      padding: 6px 14px;
      border-radius: 6px;
      border: 1px solid rgba(139,148,158,0.3);
      background: transparent;
      color: #e6edf3;
      cursor: pointer;
      font-size: 13px;
    }
    .btn:hover { background: rgba(139,148,158,0.1); }
    .btn-primary {
      background: linear-gradient(135deg, #A855F7, #9333EA);
      border: none;
      color: #fff;
      font-weight: 600;
    }
    .btn-primary:hover { opacity: 0.9; }
    .container { max-width: 1100px; margin: 0 auto; padding: 24px; }

    /* Login */
    .login-wrap {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 80vh;
    }
    .login-box {
      background: #161b22;
      border: 1px solid rgba(139,148,158,0.2);
      border-radius: 12px;
      padding: 32px;
      width: 340px;
      text-align: center;
    }
    .login-box h2 { margin-bottom: 20px; font-size: 20px; }
    .login-box input {
      width: 100%;
      padding: 10px 12px;
      border-radius: 6px;
      border: 1px solid rgba(139,148,158,0.3);
      background: #0d1117;
      color: #e6edf3;
      font-size: 14px;
      margin-bottom: 12px;
    }
    .login-box input:focus { outline: none; border-color: #A855F7; }
    .login-box .error { color: #f85149; font-size: 13px; margin-bottom: 8px; display: none; }

    /* Stats cards */
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .card {
      background: #161b22;
      border: 1px solid rgba(139,148,158,0.2);
      border-radius: 10px;
      padding: 18px;
    }
    .card-label {
      font-size: 12px;
      color: #8b949e;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .card-value {
      font-size: 28px;
      font-weight: 700;
    }
    .card-sub {
      font-size: 12px;
      color: #8b949e;
      margin-top: 6px;
    }
    .card-sub span { color: #3fb950; }
    .card-churn .card-value { color: #d29922; }

    /* Tables */
    .section { margin-bottom: 24px; }
    .section-title {
      font-size: 15px;
      font-weight: 600;
      margin-bottom: 12px;
      color: #8b949e;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #161b22;
      border: 1px solid rgba(139,148,158,0.2);
      border-radius: 10px;
      overflow: hidden;
      font-size: 13px;
    }
    th {
      text-align: left;
      padding: 10px 14px;
      background: #21262d;
      color: #8b949e;
      font-weight: 500;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    td {
      padding: 10px 14px;
      border-top: 1px solid rgba(139,148,158,0.1);
    }
    tr:hover td { background: rgba(139,148,158,0.04); }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-green { background: rgba(63,185,80,0.15); color: #3fb950; }
    .badge-red { background: rgba(248,81,73,0.15); color: #f85149; }
    .badge-yellow { background: rgba(210,153,34,0.15); color: #d29922; }
    .badge-gray { background: rgba(139,148,158,0.15); color: #8b949e; }
    .pagination {
      display: flex;
      gap: 8px;
      margin-top: 10px;
      justify-content: flex-end;
    }
    .loading {
      text-align: center;
      padding: 40px;
      color: #8b949e;
    }
    .hidden { display: none !important; }
  </style>
</head>
<body>

<!-- Login Screen -->
<div id="login-screen">
  <div class="login-wrap">
    <div class="login-box">
      <h2>Admin Panel</h2>
      <div class="error" id="login-error">Wrong password</div>
      <input type="password" id="password-input" placeholder="Password" autofocus>
      <button class="btn btn-primary" style="width:100%;padding:10px" onclick="doLogin()">Log in</button>
    </div>
  </div>
</div>

<!-- Dashboard -->
<div id="dashboard" class="hidden">
  <div class="header">
    <h1>Rehearsal Calendar Admin</h1>
    <div class="header-actions">
      <button class="btn" onclick="loadAll()">Refresh</button>
      <button class="btn" onclick="doLogout()">Log out</button>
    </div>
  </div>
  <div class="container">
    <div id="stats-loading" class="loading">Loading...</div>

    <!-- Stats Cards -->
    <div id="stats-cards" class="cards hidden"></div>

    <!-- Users Table -->
    <div class="section">
      <div class="section-title">Recent Users</div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Registered</th>
            <th>Last Login</th>
            <th>Subscription</th>
          </tr>
        </thead>
        <tbody id="users-body">
          <tr><td colspan="5" class="loading">Loading...</td></tr>
        </tbody>
      </table>
      <div class="pagination" id="users-pagination"></div>
    </div>

    <!-- Transactions Table -->
    <div class="section">
      <div class="section-title">Recent Transactions</div>
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Amount</th>
            <th>Type</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody id="tx-body">
          <tr><td colspan="5" class="loading">Loading...</td></tr>
        </tbody>
      </table>
      <div class="pagination" id="tx-pagination"></div>
    </div>
  </div>
</div>

<script>
  var TOKEN_KEY = 'admin_token';
  var usersPage = 0;
  var txPage = 0;
  var PAGE_SIZE = 30;

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function clearToken() { localStorage.removeItem(TOKEN_KEY); }

  async function api(path, opts) {
    var token = getToken();
    var headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var res = await fetch('/admin/api' + path, Object.assign({ headers: headers }, opts || {}));
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
    var pw = document.getElementById('password-input').value;
    var errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    try {
      var data = await fetch('/admin/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pw })
      }).then(function(r) { return r.json(); });
      if (data.token) {
        setToken(data.token);
        showDashboard();
        loadAll();
      } else {
        errEl.textContent = data.error || 'Login failed';
        errEl.style.display = 'block';
      }
    } catch (e) {
      errEl.textContent = 'Connection error';
      errEl.style.display = 'block';
    }
  }

  function doLogout() {
    clearToken();
    showLogin();
  }

  // Enter key on password
  document.getElementById('password-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
  });

  function fmtDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function statusBadge(status) {
    if (!status) return '<span class="badge badge-gray">none</span>';
    var cls = 'badge-gray';
    if (status === 'active' || status === 'completed') cls = 'badge-green';
    else if (status === 'failed' || status === 'payment_failed') cls = 'badge-red';
    else if (status === 'cancelled' || status === 'pending') cls = 'badge-yellow';
    return '<span class="badge ' + cls + '">' + status + '</span>';
  }

  async function loadStats() {
    var el = document.getElementById('stats-cards');
    var loading = document.getElementById('stats-loading');
    try {
      var d = await api('/stats');
      var subsList = (d.subscriptions.active || []).map(function(s) {
        return s.plan + ': ' + s.count;
      }).join(', ');

      el.innerHTML =
        '<div class="card">' +
          '<div class="card-label">Users</div>' +
          '<div class="card-value">' + d.users.total + '</div>' +
          '<div class="card-sub"><span>+' + d.users.newThisWeek + '</span> this week, <span>+' + d.users.newThisMonth + '</span> this month</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-label">Active Subscriptions</div>' +
          '<div class="card-value">' + d.subscriptions.totalActive + '</div>' +
          '<div class="card-sub">' + (subsList || 'none') + '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-label">Revenue (ILS)</div>' +
          '<div class="card-value">' + Number(d.revenue.total).toLocaleString() + '</div>' +
          '<div class="card-sub">' + d.revenue.currency + '</div>' +
        '</div>' +
        '<div class="card card-churn">' +
          '<div class="card-label">Churn (30 days)</div>' +
          '<div class="card-value">' + d.churn.subscriptions.rate + '%</div>' +
          '<div class="card-sub">Subs cancelled: ' + d.churn.subscriptions.cancelledLast30Days + '</div>' +
        '</div>' +
        '<div class="card card-churn">' +
          '<div class="card-label">User Churn (30 days)</div>' +
          '<div class="card-value">' + d.churn.users.rate + '%</div>' +
          '<div class="card-sub">Inactive users: ' + d.churn.users.inactiveLast30Days + '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-label">Projects</div>' +
          '<div class="card-value">' + d.usage.projects + '</div>' +
        '</div>' +
        '<div class="card">' +
          '<div class="card-label">Rehearsals</div>' +
          '<div class="card-value">' + d.usage.rehearsals + '</div>' +
        '</div>';

      el.classList.remove('hidden');
      loading.classList.add('hidden');
    } catch (e) { /* handled by api() */ }
  }

  async function loadUsers(page) {
    usersPage = page || 0;
    var body = document.getElementById('users-body');
    try {
      var d = await api('/users?limit=' + PAGE_SIZE + '&offset=' + (usersPage * PAGE_SIZE));
      if (!d.users.length) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#8b949e">No users</td></tr>';
        return;
      }
      body.innerHTML = d.users.map(function(u) {
        var subText = u.subscriptionStatus
          ? statusBadge(u.subscriptionStatus) + ' <span style="color:#8b949e;font-size:11px">' + (u.planName || '') + '</span>'
          : '<span class="badge badge-gray">free</span>';
        return '<tr>' +
          '<td>' + (u.firstName || '') + ' ' + (u.lastName || '') + '</td>' +
          '<td>' + u.email + '</td>' +
          '<td>' + fmtDate(u.createdAt) + '</td>' +
          '<td>' + fmtDate(u.lastLoginAt) + '</td>' +
          '<td>' + subText + '</td>' +
        '</tr>';
      }).join('');
      renderPagination('users-pagination', d.total, usersPage, loadUsers);
    } catch (e) { /* handled by api() */ }
  }

  async function loadTransactions(page) {
    txPage = page || 0;
    var body = document.getElementById('tx-body');
    try {
      var d = await api('/transactions?limit=' + PAGE_SIZE + '&offset=' + (txPage * PAGE_SIZE));
      if (!d.transactions.length) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#8b949e">No transactions</td></tr>';
        return;
      }
      body.innerHTML = d.transactions.map(function(t) {
        return '<tr>' +
          '<td>' + t.email + '</td>' +
          '<td>' + t.amount + ' ' + t.currency + '</td>' +
          '<td>' + (t.type || '-') + '</td>' +
          '<td>' + statusBadge(t.status) + '</td>' +
          '<td>' + fmtDate(t.attemptedAt) + '</td>' +
        '</tr>';
      }).join('');
      renderPagination('tx-pagination', d.total, txPage, loadTransactions);
    } catch (e) { /* handled by api() */ }
  }

  function renderPagination(elId, total, currentPage, loadFn) {
    var el = document.getElementById(elId);
    var pages = Math.ceil(total / PAGE_SIZE);
    if (pages <= 1) { el.innerHTML = ''; return; }
    var html = '';
    if (currentPage > 0) html += '<button class="btn" onclick="(' + loadFn.name + ')(' + (currentPage - 1) + ')">Prev</button>';
    html += '<span style="color:#8b949e;font-size:12px;line-height:30px">Page ' + (currentPage + 1) + ' of ' + pages + '</span>';
    if (currentPage < pages - 1) html += '<button class="btn" onclick="(' + loadFn.name + ')(' + (currentPage + 1) + ')">Next</button>';
    el.innerHTML = html;
  }

  function loadAll() {
    loadStats();
    loadUsers(0);
    loadTransactions(0);
  }

  // Init
  if (getToken()) {
    showDashboard();
    loadAll();
  } else {
    showLogin();
  }
</script>
</body>
</html>`;
}
