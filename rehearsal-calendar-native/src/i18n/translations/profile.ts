/** Between the days of a weekend: they stay on one line (T-408). */
const NBSP = '\u00a0';

export interface ProfileTranslations {
  title: string;
  settings: string;
  notifications: string;
  language: string;
  timezone: string;
  timezoneModalTitle: string;
  timezoneNotSelected: string;
  /** The search over the zones, by city or zone name. */
  timezoneSearch: string;
  timezoneNotFound: string;
  weekStart: string;
  weekStartMonday: string;
  weekStartSunday: string;
  /**
   * The switch under "Start Week On" (T-406): weekends marked busy by
   * default, the days of the country of the profile's zone. The onboarding
   * and the availability editor name it by this label.
   */
  weekendsBusy: string;
  /** Under the switch: the days, "пт и сб" (weekendDayNames). */
  weekendsBusyDays: (days: string) => string;
  /** Joins the days' names: "пт и сб", "Fri and Sat", with no-break spaces (T-408). */
  weekendDaysJoin: (...names: string[]) => string;
  about: string;
  version: string;
  help: string;
  privacyPolicy: string;
  reportBug: string;
  reportBugPlaceholder: string;
  reportBugSend: string;
  reportBugSent: string;
  reportBugFailed: string;
  logout: string;
  deleteAccount: string;
  deleteAccountConfirm: string;
  deleteAccountWarning: string;
  deleteAccountProjectsWarning: (count: number) => string;
  deleteAccountFinalWarning: string;
  /** The confirmation: this phone's calendar is cleared, other devices' are not (T-409). */
  deleteAccountCalendar: string;
  /** After the deletion: the app's events this phone's calendar still has, and how to delete them. */
  deleteAccountCalendarLeft: (count: number) => string;
  /** After the deletion: whether any are still there could not be found out. */
  deleteAccountCalendarUnknown: string;
  deleteAccountSuccess: string;
  deleteAccountError: string;
  cancel: string;
  confirmDelete: string;
  editProfile: string;
  firstName: string;
  lastName: string;
  email: string;
  firstNamePlaceholder: string;
  lastNamePlaceholder: string;
  emailPlaceholder: string;
  firstNameRequired: string;
  profileUpdated: string;
  updateError: string;
  avatarHint: string;
  errorTitle: string;
  notificationError: string;
  pushDeniedTitle: string;
  pushDeniedMessage: string;
  pushUnsupported: string;
  pushFailed: string;
  pushNotAllowedHere: string;
  pushNotRegisteredHere: string;
  openSettings: string;
  languageError: string;
  timezoneError: string;
  weekStartError: string;
  weekendsBusyError: string;
  // Changing the sign-in address with codes to both addresses (R3: HP01)
  changeEmail: string;
  changeEmailTitle: string;
  changeEmailSubtitle: (email: string) => string;
  newEmail: string;
  currentPassword: string;
  sendCodes: string;
  codesSent: string;
  currentAddressCode: (email: string) => string;
  newAddressCode: (email: string) => string;
  deliveryFailedTo: (email: string) => string;
  deliveryUnknownTo: (email: string) => string;
  resendCodes: string;
  confirmChange: string;
  emailChangedTitle: string;
  emailChanged: (email: string) => string;
  emailTakenByOther: string;
}

export const ru = {
  profile: {
    title: 'Профиль',
    settings: 'Настройки',
    notifications: 'Уведомления',
    language: 'Язык',
    timezone: 'Часовой пояс',
    timezoneModalTitle: 'Выберите часовой пояс',
    timezoneNotSelected: 'Не выбран',
    timezoneSearch: 'Город или часовой пояс',
    timezoneNotFound: 'Ничего не найдено',
    weekStart: 'Начало недели',
    weekStartMonday: 'Понедельник',
    weekStartSunday: 'Воскресенье',
    // T-406: new, for the native speakers' reading.
    weekendsBusy: 'Выходные заняты',
    weekendsBusyDays: (days: string) => `Ваши выходные: ${days}`,
    weekendDaysJoin: (...names: string[]) =>
      (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(`,${NBSP}`)}${NBSP}и${NBSP}${names[names.length - 1]}`),
    about: 'О приложении',
    version: 'Версия',
    help: 'Помощь',
    privacyPolicy: 'Политика конфиденциальности',
    reportBug: 'Сообщить об ошибке',
    reportBugPlaceholder: 'Опишите проблему…',
    reportBugSend: 'Отправить',
    reportBugSent: 'Спасибо! Отчёт отправлен',
    reportBugFailed: 'Не удалось отправить отчёт',
    logout: 'Выйти из аккаунта',
    deleteAccount: 'Удалить аккаунт',
    deleteAccountConfirm: 'Удалить аккаунт?',
    deleteAccountWarning: 'Это действие необратимо. Все ваши данные будут удалены навсегда — вместе с проектами, которыми вы владеете, и всеми их репетициями. Остальные участники тоже их потеряют.',
    deleteAccountProjectsWarning: (count: number) =>
      // 1, 21 проект; 2–4, 22 проекта; 5–20, 11–14 проектов — "проект(а/ов)" was no Russian.
      // Shown under "Аккаунт удалён", so done, not to come: "Будет удалён" promised
      // a deletion that had already happened (T-250).
      count % 10 === 1 && count % 100 !== 11
        ? `Также удалён ${count} проект, где вы были единственным администратором.`
        : count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)
          ? `Также удалены ${count} проекта, где вы были единственным администратором.`
          : `Также удалено ${count} проектов, где вы были единственным администратором.`,
    deleteAccountFinalWarning: 'Вы уверены, что хотите удалить свой аккаунт?',
    // T-409: new, for the native speakers' reading.
    deleteAccountCalendar: 'Репетиции, которые приложение добавило в календарь этого iPhone, будут из него удалены. На других устройствах они останутся.',
    deleteAccountCalendarLeft: (count: number) => (count === 1
      ? 'Не удалось убрать из календаря этого iPhone репетиций: 1. Её можно удалить вручную в приложении «Календарь»: название начинается с названия проекта.'
      : `Не удалось убрать из календаря этого iPhone репетиций: ${count}. Их можно удалить вручную в приложении «Календарь»: название каждой начинается с названия проекта.`),
    deleteAccountCalendarUnknown: 'Не удалось проверить, остались ли репетиции в календаре этого iPhone. Если остались, их можно удалить вручную в приложении «Календарь»: название каждой начинается с названия проекта.',
    deleteAccountSuccess: 'Аккаунт удалён',
    deleteAccountError: 'Не удалось удалить аккаунт',
    cancel: 'Отменить',
    confirmDelete: 'Да, удалить',
    editProfile: 'Редактировать профиль',
    firstName: 'Имя',
    lastName: 'Фамилия',
    email: 'Email',
    firstNamePlaceholder: 'Введите имя',
    lastNamePlaceholder: 'Введите фамилию',
    emailPlaceholder: 'Введите email',
    firstNameRequired: 'Имя обязательно',
    profileUpdated: 'Профиль обновлён',
    updateError: 'Ошибка обновления профиля',
    avatarHint: 'На аватаре — инициалы имени и фамилии.',
    errorTitle: 'Ошибка',
    notificationError: 'Не удалось изменить настройки уведомлений',
    pushDeniedTitle: 'Уведомления не разрешены',
    pushDeniedMessage: 'Разрешите уведомления для Rehearsly в настройках телефона.',
    pushUnsupported: 'Это устройство не может получать push-уведомления.',
    pushFailed: 'Не удалось включить уведомления на этом устройстве. Проверьте соединение и попробуйте ещё раз.',
    pushNotAllowedHere: 'На этом телефоне уведомления не разрешены. Нажмите, чтобы разрешить.',
    pushNotRegisteredHere: 'Этот телефон ещё не подключён к уведомлениям. Нажмите, чтобы попробовать ещё раз.',
    openSettings: 'Открыть настройки',
    languageError: 'Не удалось изменить язык',
    timezoneError: 'Не удалось изменить часовой пояс',
    weekStartError: 'Не удалось изменить начало недели',
    // T-406: new, for the native speakers' reading.
    weekendsBusyError: 'Не удалось сохранить настройку выходных',
    changeEmail: 'Сменить адрес',
    changeEmailTitle: 'Смена адреса',
    changeEmailSubtitle: (email: string) => `Мы пришлём по коду на ${email} и на новый адрес. Адрес сменится, когда вы введёте оба.`,
    newEmail: 'Новый адрес',
    currentPassword: 'Текущий пароль',
    sendCodes: 'Прислать коды',
    codesSent: 'Коды отправлены. Прежние больше не действуют.',
    currentAddressCode: (email: string) => `Код из письма на ${email}`,
    newAddressCode: (email: string) => `Код из письма на ${email}`,
    deliveryFailedTo: (email: string) => `Письмо на ${email} не удалось отправить. Запросите коды ещё раз.`,
    deliveryUnknownTo: (email: string) => `Письмо на ${email} может прийти с задержкой. Если его нет через пару минут, запросите коды ещё раз.`,
    resendCodes: 'Отправить коды ещё раз',
    confirmChange: 'Подтвердить смену',
    emailChangedTitle: 'Адрес изменён',
    emailChanged: (email: string) => `Теперь вы входите с адресом ${email}. На прежний адрес отправлено уведомление.`,
    emailTakenByOther: 'Этот адрес уже занят другим аккаунтом.',
  },
};

export const en = {
  profile: {
    title: 'Profile',
    settings: 'Settings',
    notifications: 'Notifications',
    language: 'Language',
    timezone: 'Time Zone',
    timezoneModalTitle: 'Select Time Zone',
    timezoneNotSelected: 'Not selected',
    timezoneSearch: 'City or time zone',
    timezoneNotFound: 'No Results',
    weekStart: 'Start Week On',
    weekStartMonday: 'Monday',
    weekStartSunday: 'Sunday',
    // T-406: new, for the native speakers' reading.
    weekendsBusy: 'Mark Weekends as Busy',
    weekendsBusyDays: (days: string) => `Your weekend: ${days}`,
    weekendDaysJoin: (...names: string[]) =>
      (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(`,${NBSP}`)}${NBSP}and${NBSP}${names[names.length - 1]}`),
    about: 'About',
    version: 'Version',
    help: 'Help',
    privacyPolicy: 'Privacy Policy',
    reportBug: 'Report a Bug',
    reportBugPlaceholder: 'Describe the issue…',
    reportBugSend: 'Send',
    reportBugSent: 'Thanks! Report sent',
    reportBugFailed: 'Could not send the report',
    // "Sign Out", as the app says "Sign In".
    logout: 'Sign Out',
    deleteAccount: 'Delete Account',
    deleteAccountConfirm: 'Delete Account?',
    deleteAccountWarning: 'This cannot be undone. All your data will be permanently deleted, along with the projects you own and all their rehearsals. Other members of those projects will lose them too.',
    deleteAccountProjectsWarning: (count: number) =>
      count === 1
        ? '1 project where you were the only admin was deleted too.'
        : `${count} projects where you were the only admin were deleted too.`,
    deleteAccountFinalWarning: 'Are you sure you want to delete your account?',
    // T-409: new, for the native speakers' reading.
    deleteAccountCalendar: 'Rehearsals the app added to this iPhone’s calendar will be removed from it. On your other devices they will stay.',
    deleteAccountCalendarLeft: (count: number) => (count === 1
      ? '1 rehearsal could not be removed from this iPhone’s calendar. You can delete it yourself in the Calendar app: its title begins with the project’s name.'
      : `${count} rehearsals could not be removed from this iPhone’s calendar. You can delete them yourself in the Calendar app: each title begins with the project’s name.`),
    deleteAccountCalendarUnknown: 'Could not check whether rehearsals from the app are still in this iPhone’s calendar. If they are, you can delete them yourself in the Calendar app: each title begins with the project’s name.',
    deleteAccountSuccess: 'Account deleted',
    deleteAccountError: 'Could not delete your account',
    cancel: 'Cancel',
    confirmDelete: 'Yes, Delete',
    editProfile: 'Edit Profile',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    firstNamePlaceholder: 'Enter first name',
    lastNamePlaceholder: 'Enter last name',
    emailPlaceholder: 'Enter email',
    firstNameRequired: 'First name is required',
    profileUpdated: 'Profile updated',
    updateError: 'Could not update your profile',
    avatarHint: 'Your avatar shows the initials of your first and last name.',
    errorTitle: 'Error',
    notificationError: 'Could not update notification settings',
    pushDeniedTitle: 'Notifications Not Allowed',
    pushDeniedMessage: 'Allow notifications for Rehearsly in Settings.',
    pushUnsupported: 'This device cannot receive push notifications.',
    pushFailed: 'Could not turn on notifications on this device. Check your connection and try again.',
    pushNotAllowedHere: 'Notifications are not allowed on this phone. Tap to allow.',
    pushNotRegisteredHere: 'This phone is not set up for notifications yet. Tap to try again.',
    openSettings: 'Open Settings',
    languageError: 'Could not change the language',
    timezoneError: 'Could not update the time zone',
    weekStartError: 'Could not change the first day of the week',
    // T-406: new, for the native speakers' reading.
    weekendsBusyError: 'Could not save your weekend setting',
    changeEmail: 'Change Email',
    changeEmailTitle: 'Change Email',
    changeEmailSubtitle: (email: string) => `We will send a code to ${email} and one to the new address. The address changes once you enter both.`,
    newEmail: 'New Email',
    currentPassword: 'Current Password',
    sendCodes: 'Send Codes',
    codesSent: 'The codes are on their way. Earlier ones no longer work.',
    currentAddressCode: (email: string) => `Code sent to ${email}`,
    newAddressCode: (email: string) => `Code sent to ${email}`,
    deliveryFailedTo: (email: string) => `The email to ${email} could not be sent. Ask for the codes again.`,
    deliveryUnknownTo: (email: string) => `The email to ${email} may take a while. If it has not arrived in a couple of minutes, ask for the codes again.`,
    resendCodes: 'Send Codes Again',
    confirmChange: 'Confirm Change',
    emailChangedTitle: 'Email Changed',
    emailChanged: (email: string) => `You now sign in with ${email}. A notice went to the previous address.`,
    emailTakenByOther: 'Another account already uses this address.',
  },
};

export const es = {
  profile: {
    title: 'Perfil',
    settings: 'Ajustes',
    notifications: 'Notificaciones',
    language: 'Idioma',
    timezone: 'Zona horaria',
    timezoneModalTitle: 'Seleccionar zona horaria',
    timezoneNotSelected: 'No seleccionada',
    timezoneSearch: 'Ciudad o zona horaria',
    timezoneNotFound: 'Sin resultados',
    weekStart: 'Inicio de la semana',
    weekStartMonday: 'Lunes',
    weekStartSunday: 'Domingo',
    // T-406: new, for the native speakers' reading.
    weekendsBusy: 'Fines de semana ocupados',
    weekendsBusyDays: (days: string) => `Tu fin de semana: ${days}`,
    weekendDaysJoin: (...names: string[]) =>
      (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(`,${NBSP}`)}${NBSP}y${NBSP}${names[names.length - 1]}`),
    about: 'Acerca de',
    version: 'Versión',
    help: 'Ayuda',
    privacyPolicy: 'Política de privacidad',
    reportBug: 'Reportar un error',
    reportBugPlaceholder: 'Describe el problema…',
    reportBugSend: 'Enviar',
    reportBugSent: '¡Gracias! Informe enviado',
    reportBugFailed: 'No se pudo enviar el informe',
    logout: 'Cerrar sesión',
    deleteAccount: 'Eliminar cuenta',
    deleteAccountConfirm: '¿Eliminar cuenta?',
    deleteAccountWarning: 'Esta acción es irreversible. Todos tus datos se eliminarán permanentemente, junto con los proyectos que son tuyos y todos sus ensayos. Los demás miembros también los perderán.',
    deleteAccountProjectsWarning: (count: number) =>
      count === 1
        ? 'También se ha eliminado 1 proyecto que solo administrabas tú.'
        : `También se han eliminado ${count} proyectos que solo administrabas tú.`,
    deleteAccountFinalWarning: '¿Seguro que quieres eliminar tu cuenta?',
    // T-409: new, for the native speakers' reading.
    deleteAccountCalendar: 'Los ensayos que la app añadió al calendario de este iPhone se quitarán de él. En tus otros dispositivos se quedarán.',
    deleteAccountCalendarLeft: (count: number) => (count === 1
      ? 'No se pudo quitar 1 ensayo del calendario de este iPhone. Puedes borrarlo tú en la app Calendario: su título empieza por el nombre del proyecto.'
      : `No se pudieron quitar ${count} ensayos del calendario de este iPhone. Puedes borrarlos tú en la app Calendario: el título de cada uno empieza por el nombre del proyecto.`),
    deleteAccountCalendarUnknown: 'No se pudo comprobar si quedan ensayos de la app en el calendario de este iPhone. Si quedan, puedes borrarlos tú en la app Calendario: el título de cada uno empieza por el nombre del proyecto.',
    deleteAccountSuccess: 'Cuenta eliminada',
    deleteAccountError: 'No se pudo eliminar la cuenta',
    cancel: 'Cancelar',
    confirmDelete: 'Sí, eliminar',
    editProfile: 'Editar perfil',
    firstName: 'Nombre',
    lastName: 'Apellido',
    email: 'Correo electrónico',
    firstNamePlaceholder: 'Escribe tu nombre',
    lastNamePlaceholder: 'Escribe tu apellido',
    emailPlaceholder: 'Escribe tu correo',
    firstNameRequired: 'El nombre es obligatorio',
    profileUpdated: 'Perfil actualizado',
    updateError: 'Error al actualizar el perfil',
    avatarHint: 'Tu avatar muestra las iniciales de tu nombre y apellido.',
    errorTitle: 'Error',
    notificationError: 'No se pudieron actualizar los ajustes de notificaciones',
    pushDeniedTitle: 'Las notificaciones no están permitidas',
    pushDeniedMessage: 'Permite las notificaciones de Rehearsly en la configuración del teléfono.',
    pushUnsupported: 'Este dispositivo no puede recibir notificaciones push.',
    pushFailed: 'No se pudieron activar las notificaciones en este dispositivo. Comprueba la conexión e inténtalo de nuevo.',
    pushNotAllowedHere: 'Las notificaciones no están permitidas en este teléfono. Toca para permitirlas.',
    pushNotRegisteredHere: 'Este teléfono aún no está listo para recibir notificaciones. Toca para intentarlo de nuevo.',
    openSettings: 'Abrir configuración',
    languageError: 'No se pudo cambiar el idioma',
    timezoneError: 'No se pudo actualizar la zona horaria',
    weekStartError: 'No se pudo actualizar el inicio de la semana',
    // T-406: new, for the native speakers' reading.
    weekendsBusyError: 'No se pudo guardar el ajuste de los fines de semana',
    changeEmail: 'Cambiar dirección',
    changeEmailTitle: 'Cambiar dirección',
    changeEmailSubtitle: (email: string) => `Enviaremos un código a ${email} y otro a la dirección nueva. La dirección cambiará cuando escribas los dos.`,
    newEmail: 'Dirección nueva',
    currentPassword: 'Contraseña actual',
    sendCodes: 'Enviar códigos',
    codesSent: 'Te enviamos los códigos. Los anteriores ya no sirven.',
    currentAddressCode: (email: string) => `Código enviado a ${email}`,
    newAddressCode: (email: string) => `Código enviado a ${email}`,
    deliveryFailedTo: (email: string) => `No se pudo enviar el correo a ${email}. Pide los códigos otra vez.`,
    deliveryUnknownTo: (email: string) => `El correo a ${email} puede tardar. Si no llega en un par de minutos, pide los códigos otra vez.`,
    resendCodes: 'Reenviar códigos',
    confirmChange: 'Confirmar el cambio',
    emailChangedTitle: 'Dirección cambiada',
    emailChanged: (email: string) => `Ahora entras con ${email}. Enviamos un aviso a la dirección anterior.`,
    emailTakenByOther: 'Otra cuenta ya usa esta dirección.',
  },
};

export const de = {
  profile: {
    title: 'Profil',
    settings: 'Einstellungen',
    notifications: 'Mitteilungen',
    language: 'Sprache',
    timezone: 'Zeitzone',
    timezoneModalTitle: 'Zeitzone auswählen',
    timezoneNotSelected: 'Nicht ausgewählt',
    timezoneSearch: 'Stadt oder Zeitzone',
    timezoneNotFound: 'Nichts gefunden',
    weekStart: 'Wochenbeginn',
    weekStartMonday: 'Montag',
    weekStartSunday: 'Sonntag',
    // T-406: new, for the native speakers' reading.
    weekendsBusy: 'Wochenenden belegt',
    weekendsBusyDays: (days: string) => `Dein Wochenende: ${days}`,
    weekendDaysJoin: (...names: string[]) =>
      (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(`,${NBSP}`)}${NBSP}und${NBSP}${names[names.length - 1]}`),
    about: 'Über die App',
    version: 'Version',
    help: 'Hilfe',
    privacyPolicy: 'Datenschutzerklärung',
    reportBug: 'Fehler melden',
    reportBugPlaceholder: 'Problem beschreiben …',
    reportBugSend: 'Senden',
    reportBugSent: 'Danke! Bericht gesendet',
    reportBugFailed: 'Der Bericht konnte nicht gesendet werden',
    logout: 'Abmelden',
    deleteAccount: 'Konto löschen',
    deleteAccountConfirm: 'Konto löschen?',
    deleteAccountWarning: 'Diese Aktion ist unumkehrbar. Alle deine Daten werden dauerhaft gelöscht – samt den Projekten, die dir gehören, und all ihren Proben. Auch alle anderen Mitglieder verlieren den Zugriff darauf.',
    deleteAccountProjectsWarning: (count: number) =>
      count === 1
        ? '1 Projekt, das nur du verwaltet hast, wurde ebenfalls gelöscht.'
        : `${count} Projekte, die nur du verwaltet hast, wurden ebenfalls gelöscht.`,
    deleteAccountFinalWarning: 'Möchtest du dein Konto wirklich löschen?',
    // T-409: new, for the native speakers' reading.
    deleteAccountCalendar: 'Proben, die die App in den Kalender dieses iPhones eingetragen hat, werden daraus entfernt. Auf deinen anderen Geräten bleiben sie.',
    deleteAccountCalendarLeft: (count: number) => (count === 1
      ? '1 Probe konnte nicht aus dem Kalender dieses iPhones entfernt werden. Du kannst sie in der Kalender-App selbst löschen: Ihr Titel beginnt mit dem Projektnamen.'
      : `${count} Proben konnten nicht aus dem Kalender dieses iPhones entfernt werden. Du kannst sie in der Kalender-App selbst löschen: Ihr Titel beginnt jeweils mit dem Projektnamen.`),
    deleteAccountCalendarUnknown: 'Es ließ sich nicht prüfen, ob noch Proben der App im Kalender dieses iPhones sind. Falls ja, kannst du sie in der Kalender-App selbst löschen: Ihr Titel beginnt jeweils mit dem Projektnamen.',
    deleteAccountSuccess: 'Konto gelöscht',
    deleteAccountError: 'Konto konnte nicht gelöscht werden',
    cancel: 'Abbrechen',
    confirmDelete: 'Ja, löschen',
    editProfile: 'Profil bearbeiten',
    firstName: 'Vorname',
    lastName: 'Nachname',
    email: 'E-Mail',
    firstNamePlaceholder: 'Vornamen eingeben',
    lastNamePlaceholder: 'Nachnamen eingeben',
    emailPlaceholder: 'E-Mail eingeben',
    firstNameRequired: 'Vorname ist erforderlich',
    profileUpdated: 'Profil aktualisiert',
    updateError: 'Profil konnte nicht aktualisiert werden',
    avatarHint: 'Dein Avatar zeigt die Initialen deines Vor- und Nachnamens.',
    errorTitle: 'Fehler',
    notificationError: 'Mitteilungseinstellungen konnten nicht geändert werden',
    pushDeniedTitle: 'Mitteilungen sind nicht erlaubt',
    pushDeniedMessage: 'Erlaube Mitteilungen für Rehearsly in den Geräteeinstellungen.',
    pushUnsupported: 'Dieses Gerät kann keine Push-Mitteilungen empfangen.',
    pushFailed: 'Mitteilungen konnten auf diesem Gerät nicht aktiviert werden. Prüfe die Verbindung und versuche es erneut.',
    pushNotAllowedHere: 'Mitteilungen sind auf diesem Gerät nicht erlaubt. Tippe, um sie zu erlauben.',
    pushNotRegisteredHere: 'Dieses Gerät ist noch nicht für Mitteilungen eingerichtet. Tippe, um es erneut zu versuchen.',
    openSettings: 'Einstellungen öffnen',
    languageError: 'Sprache konnte nicht geändert werden',
    timezoneError: 'Zeitzone konnte nicht aktualisiert werden',
    weekStartError: 'Wochenbeginn konnte nicht aktualisiert werden',
    // T-406: new, for the native speakers' reading.
    weekendsBusyError: 'Die Einstellung für die Wochenenden konnte nicht gespeichert werden',
    changeEmail: 'Adresse ändern',
    changeEmailTitle: 'Adresse ändern',
    changeEmailSubtitle: (email: string) => `Wir schicken einen Code an ${email} und einen an die neue Adresse. Die Adresse ändert sich, sobald du beide eingibst.`,
    newEmail: 'Neue Adresse',
    currentPassword: 'Aktuelles Passwort',
    sendCodes: 'Codes senden',
    codesSent: 'Die Codes sind unterwegs. Frühere gelten nicht mehr.',
    currentAddressCode: (email: string) => `Code aus der E-Mail an ${email}`,
    newAddressCode: (email: string) => `Code aus der E-Mail an ${email}`,
    deliveryFailedTo: (email: string) => `Die E-Mail an ${email} konnte nicht gesendet werden. Fordere die Codes erneut an.`,
    deliveryUnknownTo: (email: string) => `Es kann etwas dauern, bis die E-Mail an ${email} ankommt. Ist sie nach ein paar Minuten nicht da, fordere die Codes erneut an.`,
    resendCodes: 'Codes erneut senden',
    confirmChange: 'Änderung bestätigen',
    emailChangedTitle: 'Adresse geändert',
    emailChanged: (email: string) => `Du meldest dich jetzt mit ${email} an. An deine bisherige Adresse haben wir einen Hinweis geschickt.`,
    emailTakenByOther: 'Ein anderes Konto nutzt diese Adresse bereits.',
  },
};
