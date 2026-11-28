// The admin page is in Russian only (T-419, the owner, 26.11.2026): its one
// reader is the owner. Every word is the native editor's
// (audit/evidence/T-419/natives-ru.md); &nbsp; is a no-break space.
export function generateAdminPageHTML() {
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Админка Rehearsly</title>
  <link rel="stylesheet" href="/admin/dashboard.css">
  <script src="/admin/quoteName.js" defer></script>
  <script src="/admin/dashboard.js" defer></script>
</head>
<body>

<!-- Login Screen -->
<div id="login-screen">
  <div class="login-wrap">
    <div class="login-box">
      <h2>Админка Rehearsly</h2>
      <div class="error hidden" id="login-error" role="alert"></div>
      <input type="password" id="password-input" placeholder="Пароль" aria-label="Пароль" autocomplete="current-password" autofocus>
      <button class="btn btn-primary login-button" id="login-button">Войти</button>
    </div>
  </div>
</div>

<!-- Dashboard -->
<div id="dashboard" class="hidden">
  <div class="header">
    <h1>Админка Rehearsly</h1>
    <div class="header-actions">
      <button class="btn" id="refresh-button">Обновить</button>
      <button class="btn" id="logout-button">Выйти</button>
    </div>
  </div>
  <div class="container">
    <!-- Filters: one period and one selection for every section (T-293) -->
    <section id="filters" class="filters" aria-label="Фильтры">
      <label>Период
        <select id="filter-period">
          <option value="7">Последние 7&nbsp;дней</option>
          <option value="30">Последние 30&nbsp;дней</option>
          <option value="90">Последние 90&nbsp;дней</option>
          <option value="all" selected>Всё время</option>
          <option value="dates">Даты</option>
        </select>
      </label>
      <!-- Registration dates, UTC days, both in; the test cohort beside them (T-425) -->
      <div id="filter-dates" class="filter-dates hidden">
        <label>С
          <input type="date" id="filter-from">
        </label>
        <label>По
          <input type="date" id="filter-to">
        </label>
        <label class="toggle"><input type="checkbox" id="filter-cohort"> Тестовая когорта</label>
      </div>
      <label>Источник
        <select id="filter-source">
          <option value="" selected>Все</option>
          <option value="invite">По приглашению</option>
          <option value="own">Свой проект</option>
          <option value="none">Без проекта</option>
        </select>
      </label>
      <label>Язык
        <select id="filter-lang">
          <option value="" selected>Все языки</option>
        </select>
      </label>
      <!-- The app owner's accounts and projects out of every figure (T-428) -->
      <label class="toggle"><input type="checkbox" id="filter-owner" aria-describedby="filter-owner-note filter-owner-unavailable"> Без аккаунта владельца приложения</label>
      <p class="filter-error hidden" id="filter-error" role="alert"></p>
      <p class="note hidden" id="filter-dates-note">Дни&nbsp;— по&nbsp;UTC; первый и&nbsp;последний входят в&nbsp;период.</p>
      <p class="note hidden" id="filter-cohort-note">Все, кто зарегистрировался в&nbsp;эти даты с&nbsp;источником «Свой проект» или «Без проекта», считаются пришедшими из&nbsp;рекламы. Пока переключатель включён, выбрать источник нельзя.</p>
      <p class="note" id="filter-owner-note">Убирает из&nbsp;всех цифр аккаунт владельца приложения (адреса из&nbsp;ADMIN_OWNER_EMAILS) и&nbsp;проекты, которыми он владеет. Участники этих проектов в&nbsp;цифрах остаются.</p>
      <p class="note hidden" id="filter-owner-unavailable" role="status">Недоступно: на&nbsp;сервере не задана переменная ADMIN_OWNER_EMAILS.</p>
      <p class="note">Служебные аккаунты (адреса на rehearsly.me и demo.rehearsly.me, а также из ADMIN_SERVICE_EMAILS) не входят ни в одну цифру. «Последние N&nbsp;дней» отсчитываются от текущего момента. Период отбирает людей по дате регистрации; карточки вверху&nbsp;— на текущий момент, без учёта периода.</p>
    </section>

    <!-- Stats Cards -->
    <section id="stats-section" aria-label="Статистика" aria-busy="false">
      <div id="stats-loading" class="loading hidden" role="status">Загрузка…</div>
      <div id="stats-error" class="section-error hidden" role="alert"></div>
      <div id="stats-stale" class="stale-note hidden" role="status"></div>
      <div id="stats-cards" class="cards hidden"></div>
    </section>

    <!-- Funnel, sources, projects, notifications (T-293) -->
    <section class="section" id="analytics-section" aria-labelledby="analytics-title" aria-busy="false">
      <h2 class="section-title" id="analytics-title">Аналитика</h2>
      <div id="analytics-loading" class="loading hidden" role="status">Загрузка…</div>
      <div id="analytics-error" class="section-error hidden" role="alert"></div>
      <div id="analytics-stale" class="stale-note hidden" role="status"></div>
      <div id="analytics-body"></div>
    </section>

    <!-- Bug Reports Table -->
    <section class="section" id="bugs-section" aria-labelledby="bugs-title" aria-busy="false">
      <h2 class="section-title" id="bugs-title">Отчёты об ошибках</h2>
      <div id="bugs-loading" class="loading hidden" role="status">Загрузка…</div>
      <div id="bugs-error" class="section-error hidden" role="alert"></div>
      <div id="bugs-stale" class="stale-note hidden" role="status"></div>
      <div id="bugs-mutation-status" class="mutation-status hidden" role="status"></div>
      <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Автор</th>
            <th>Сообщение</th>
            <th>Экран</th>
            <th>Статус</th>
            <th>Дата</th>
          </tr>
        </thead>
        <tbody id="bugs-body"></tbody>
      </table>
      </div>
      <div class="pagination" id="bugs-pagination"></div>
    </section>

    <!-- Users Table -->
    <section class="section" id="users-section" aria-labelledby="users-title" aria-busy="false">
      <h2 class="section-title" id="users-title">Пользователи</h2>
      <label class="toggle"><input type="checkbox" id="show-service"> Показывать служебные аккаунты</label>
      <p class="note">Зарегистрировавшиеся за период, сначала новые. Шаги: онбординг пройден или пропущен; проекты и роли в них; ручные отметки занятости и&nbsp;последняя дата, до&nbsp;которой они доходят; отметки из&nbsp;календаря; подключён ли календарь (есть занятость, импортированная из&nbsp;календаря, или репетиции экспортированы в&nbsp;календарь телефона; записи об&nbsp;экспорте остаются и&nbsp;после выключения синхронизации); устройство для уведомлений; сколько репетиций человек отметил просмотренными из тех, в составе которых он есть; сколько репетиций он создал.</p>
      <div id="users-loading" class="loading hidden" role="status">Загрузка…</div>
      <div id="users-error" class="section-error hidden" role="alert"></div>
      <div id="users-stale" class="stale-note hidden" role="status"></div>
      <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Имя</th>
            <th>Почта</th>
            <th>Регистрация</th>
            <th>Последний вход</th>
            <th>Последний день в приложении</th>
            <th title="Проект, в котором человек состоит дольше всего из тех, где он ещё участник: если он там владелец&nbsp;— «свой проект», в любой другой роли&nbsp;— «приглашение» (приглашённый, которого потом сделали администратором, остаётся приглашённым). При выходе из проекта запись об участии удаляется, поэтому у того, кто вышел из всех проектов,&nbsp;— «без проекта».">Источник ⓘ</th>
            <th>Способы входа</th>
            <th>Язык / часовой пояс</th>
            <th>Шаги</th>
          </tr>
        </thead>
        <tbody id="users-body"></tbody>
      </table>
      </div>
      <p class="note">«Последний вход»&nbsp;— когда человек в последний раз входил в аккаунт, а не пользовался приложением: сессию приложение продлевает без входа. «Последний день в приложении»&nbsp;— это использование: последняя дата по часовому поясу человека, когда приложение обращалось к серверу в его сессии (дни хранятся 13&nbsp;месяцев и записываются с тех пор, как применена миграция&nbsp;016).</p>
      <div class="pagination" id="users-pagination"></div>
    </section>

  </div>
</div>

</body>
</html>`;
}
