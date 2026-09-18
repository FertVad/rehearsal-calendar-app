export function generateAdminPageHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin — Rehearsal Calendar</title>
  <link rel="stylesheet" href="/admin/dashboard.css">
  <script src="/admin/dashboard.js" defer></script>
</head>
<body>

<!-- Login Screen -->
<div id="login-screen">
  <div class="login-wrap">
    <div class="login-box">
      <h2>Admin Panel</h2>
      <div class="error hidden" id="login-error" role="alert"></div>
      <input type="password" id="password-input" placeholder="Password" aria-label="Password" autocomplete="current-password" autofocus>
      <button class="btn btn-primary login-button" id="login-button">Log in</button>
    </div>
  </div>
</div>

<!-- Dashboard -->
<div id="dashboard" class="hidden">
  <div class="header">
    <h1>Rehearsal Calendar Admin</h1>
    <div class="header-actions">
      <button class="btn" id="refresh-button">Refresh</button>
      <button class="btn" id="logout-button">Log out</button>
    </div>
  </div>
  <div class="container">
    <!-- Stats Cards -->
    <section id="stats-section" aria-label="Statistics" aria-busy="false">
      <div id="stats-loading" class="loading hidden" role="status">Loading...</div>
      <div id="stats-error" class="section-error hidden" role="alert"></div>
      <div id="stats-stale" class="stale-note hidden" role="status"></div>
      <div id="stats-cards" class="cards hidden"></div>
    </section>

    <!-- Bug Reports Table -->
    <section class="section" id="bugs-section" aria-labelledby="bugs-title" aria-busy="false">
      <h2 class="section-title" id="bugs-title">Bug Reports</h2>
      <div id="bugs-loading" class="loading hidden" role="status">Loading...</div>
      <div id="bugs-error" class="section-error hidden" role="alert"></div>
      <div id="bugs-stale" class="stale-note hidden" role="status"></div>
      <div id="bugs-mutation-status" class="mutation-status hidden" role="status"></div>
      <table>
        <thead>
          <tr>
            <th>User</th>
            <th>Message</th>
            <th>Screen</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
        </thead>
        <tbody id="bugs-body"></tbody>
      </table>
      <div class="pagination" id="bugs-pagination"></div>
    </section>

    <!-- Users Table -->
    <section class="section" id="users-section" aria-labelledby="users-title" aria-busy="false">
      <h2 class="section-title" id="users-title">Recent Users</h2>
      <div id="users-loading" class="loading hidden" role="status">Loading...</div>
      <div id="users-error" class="section-error hidden" role="alert"></div>
      <div id="users-stale" class="stale-note hidden" role="status"></div>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Registered</th>
            <th>Last Login</th>
          </tr>
        </thead>
        <tbody id="users-body"></tbody>
      </table>
      <div class="pagination" id="users-pagination"></div>
    </section>

  </div>
</div>

</body>
</html>`;
}
