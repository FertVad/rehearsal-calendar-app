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
    <!-- Filters: one period and one selection for every section (T-293) -->
    <section id="filters" class="filters" aria-label="Filters">
      <label>Period
        <select id="filter-period">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="all" selected>All time</option>
        </select>
      </label>
      <label>Source
        <select id="filter-source">
          <option value="" selected>Everyone</option>
          <option value="invite">Invited into a project</option>
          <option value="own">Own project</option>
          <option value="none">No project</option>
        </select>
      </label>
      <label>Language
        <select id="filter-lang">
          <option value="" selected>All languages</option>
        </select>
      </label>
      <p class="note">Service accounts (rehearsly.me, demo.rehearsly.me and ADMIN_SERVICE_EMAILS) count in no figure. "Last N days" runs back from now. The period selects people by registration date; the cards at the top are as of now.</p>
    </section>

    <!-- Stats Cards -->
    <section id="stats-section" aria-label="Statistics" aria-busy="false">
      <div id="stats-loading" class="loading hidden" role="status">Loading...</div>
      <div id="stats-error" class="section-error hidden" role="alert"></div>
      <div id="stats-stale" class="stale-note hidden" role="status"></div>
      <div id="stats-cards" class="cards hidden"></div>
    </section>

    <!-- Funnel, sources, projects, notifications (T-293) -->
    <section class="section" id="analytics-section" aria-labelledby="analytics-title" aria-busy="false">
      <h2 class="section-title" id="analytics-title">Analytics</h2>
      <div id="analytics-loading" class="loading hidden" role="status">Loading...</div>
      <div id="analytics-error" class="section-error hidden" role="alert"></div>
      <div id="analytics-stale" class="stale-note hidden" role="status"></div>
      <div id="analytics-body"></div>
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
      <label class="toggle"><input type="checkbox" id="show-service"> Show service accounts</label>
      <p class="note">People registered in the period, newest first. Steps: onboarding done; projects and roles; availability marks (own or from a calendar) and the last date they reach; calendar sync used, either way (busy times imported from a calendar, or rehearsals exported to the phone's calendar; the export records stay after sync is turned off); a device for notifications; rehearsals marked as seen, of those they are on; rehearsals they created.</p>
      <div id="users-loading" class="loading hidden" role="status">Loading...</div>
      <div id="users-error" class="section-error hidden" role="alert"></div>
      <div id="users-stale" class="stale-note hidden" role="status"></div>
      <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Registered</th>
            <th>Last Login</th>
            <th title="The earliest project they are still an active member of: as owner, their own project; in any other role, an invitation (an invited member later made admin stays invited). Someone who left a project loses its membership row, so a person who left every project reads &quot;no project&quot;.">Source ⓘ</th>
            <th>Sign-in</th>
            <th>Language / zone</th>
            <th>Steps</th>
          </tr>
        </thead>
        <tbody id="users-body"></tbody>
      </table>
      </div>
      <p class="note">Last Login is the last sign-in, not use: the app renews its session without one.</p>
      <div class="pagination" id="users-pagination"></div>
    </section>

  </div>
</div>

</body>
</html>`;
}
