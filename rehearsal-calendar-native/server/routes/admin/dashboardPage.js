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
      <div class="error hidden" id="login-error">Wrong password</div>
      <input type="password" id="password-input" placeholder="Password" autofocus>
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
    <div id="stats-loading" class="loading">Loading...</div>

    <!-- Stats Cards -->
    <div id="stats-cards" class="cards hidden"></div>

    <!-- Bug Reports Table -->
    <div class="section">
      <div class="section-title">Bug Reports</div>
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
        <tbody id="bugs-body">
          <tr><td colspan="5" class="loading">Loading...</td></tr>
        </tbody>
      </table>
      <div class="pagination" id="bugs-pagination"></div>
    </div>

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
          </tr>
        </thead>
        <tbody id="users-body">
          <tr><td colspan="4" class="loading">Loading...</td></tr>
        </tbody>
      </table>
      <div class="pagination" id="users-pagination"></div>
    </div>

  </div>
</div>

</body>
</html>`;
}
