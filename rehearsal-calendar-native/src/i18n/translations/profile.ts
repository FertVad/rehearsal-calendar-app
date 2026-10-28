export interface ProfileTranslations {
  title: string;
  settings: string;
  notifications: string;
  language: string;
  timezone: string;
  timezoneModalTitle: string;
  timezoneNotSelected: string;
  weekStart: string;
  weekStartMonday: string;
  weekStartSunday: string;
  about: string;
  version: string;
  help: string;
  logout: string;
  deleteAccount: string;
  deleteAccountConfirm: string;
  deleteAccountWarning: string;
  deleteAccountProjectsWarning: (count: number) => string;
  deleteAccountFinalWarning: string;
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
  emailRequired: string;
  emailInvalid: string;
  saveChanges: string;
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
    weekStart: 'Начало недели',
    weekStartMonday: 'Понедельник',
    weekStartSunday: 'Воскресенье',
    about: 'О приложении',
    version: 'Версия',
    help: 'Помощь',
    logout: 'Выйти из аккаунта',
    deleteAccount: 'Удалить аккаунт',
    deleteAccountConfirm: 'Удалить аккаунт?',
    deleteAccountWarning: 'Это действие необратимо. Все ваши данные будут удалены навсегда — вместе с проектами, которыми вы владеете, и всеми их репетициями. Остальные участники потеряют их тоже.',
    deleteAccountProjectsWarning: (count: number) =>
      count === 1
        ? 'Будет удален 1 проект, где вы единственный администратор.'
        : `Будут удалены ${count} проект(а/ов), где вы единственный администратор.`,
    deleteAccountFinalWarning: 'Вы уверены, что хотите удалить свой аккаунт?',
    deleteAccountSuccess: 'Аккаунт успешно удален',
    deleteAccountError: 'Не удалось удалить аккаунт',
    cancel: 'Отмена',
    confirmDelete: 'Да, удалить',
    editProfile: 'Редактировать профиль',
    firstName: 'Имя',
    lastName: 'Фамилия',
    email: 'Email',
    firstNamePlaceholder: 'Введите имя',
    lastNamePlaceholder: 'Введите фамилию',
    emailPlaceholder: 'Введите email',
    firstNameRequired: 'Имя обязательно',
    emailRequired: 'Email обязателен',
    emailInvalid: 'Неверный формат email',
    saveChanges: 'Сохранить изменения',
    profileUpdated: 'Профиль обновлен',
    updateError: 'Ошибка обновления профиля',
    avatarHint: 'Аватар генерируется автоматически на основе вашего email',
    errorTitle: 'Ошибка',
    notificationError: 'Не удалось изменить настройки уведомлений',
    pushDeniedTitle: 'Уведомления запрещены',
    pushDeniedMessage: 'Разрешите уведомления для Rehearsly в настройках телефона.',
    pushUnsupported: 'Это устройство не может получать push-уведомления.',
    pushFailed: 'Не удалось включить уведомления на этом устройстве. Проверьте соединение и попробуйте ещё раз.',
    pushNotAllowedHere: 'На этом телефоне уведомления не разрешены. Нажмите, чтобы разрешить.',
    pushNotRegisteredHere: 'Этот телефон ещё не подключён к уведомлениям. Нажмите, чтобы попробовать ещё раз.',
    openSettings: 'Открыть настройки',
    languageError: 'Не удалось изменить язык',
    timezoneError: 'Не удалось обновить часовой пояс',
    weekStartError: 'Не удалось обновить начало недели',
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
    emailChanged: (email: string) => `Теперь вы входите с ${email}. На прежний адрес отправлено уведомление.`,
    emailTakenByOther: 'Этот адрес уже занят другим аккаунтом.',
  },
};

export const en = {
  profile: {
    title: 'Profile',
    settings: 'Settings',
    notifications: 'Notifications',
    language: 'Language',
    timezone: 'Timezone',
    timezoneModalTitle: 'Select Timezone',
    timezoneNotSelected: 'Not selected',
    weekStart: 'Week starts on',
    weekStartMonday: 'Monday',
    weekStartSunday: 'Sunday',
    about: 'About',
    version: 'Version',
    help: 'Help',
    logout: 'Log out',
    deleteAccount: 'Delete Account',
    deleteAccountConfirm: 'Delete Account?',
    deleteAccountWarning: 'This action is irreversible. All your data will be permanently deleted — along with the projects you own and all their rehearsals. Everyone else in them loses them too.',
    deleteAccountProjectsWarning: (count: number) =>
      count === 1
        ? '1 project where you are the only admin will be deleted.'
        : `${count} projects where you are the only admin will be deleted.`,
    deleteAccountFinalWarning: 'Are you sure you want to delete your account?',
    deleteAccountSuccess: 'Account successfully deleted',
    deleteAccountError: 'Failed to delete account',
    cancel: 'Cancel',
    confirmDelete: 'Yes, delete',
    editProfile: 'Edit Profile',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    firstNamePlaceholder: 'Enter first name',
    lastNamePlaceholder: 'Enter last name',
    emailPlaceholder: 'Enter email',
    firstNameRequired: 'First name is required',
    emailRequired: 'Email is required',
    emailInvalid: 'Invalid email format',
    saveChanges: 'Save Changes',
    profileUpdated: 'Profile updated',
    updateError: 'Failed to update profile',
    avatarHint: 'Avatar is automatically generated based on your email',
    errorTitle: 'Error',
    notificationError: 'Failed to update notification settings',
    pushDeniedTitle: 'Notifications are not allowed',
    pushDeniedMessage: 'Allow notifications for Rehearsly in your phone settings.',
    pushUnsupported: 'This device cannot receive push notifications.',
    pushFailed: 'Could not turn on notifications on this device. Check your connection and try again.',
    pushNotAllowedHere: 'Notifications are not allowed on this phone. Tap to allow.',
    pushNotRegisteredHere: 'This phone is not set up for notifications yet. Tap to try again.',
    openSettings: 'Open Settings',
    languageError: 'Failed to change language',
    timezoneError: 'Failed to update timezone',
    weekStartError: 'Failed to update week start day',
    changeEmail: 'Change address',
    changeEmailTitle: 'Change address',
    changeEmailSubtitle: (email: string) => `We will send a code to ${email} and one to the new address. The address changes once you enter both.`,
    newEmail: 'New address',
    currentPassword: 'Current password',
    sendCodes: 'Send codes',
    codesSent: 'The codes are on their way. Earlier ones no longer work.',
    currentAddressCode: (email: string) => `Code from the email to ${email}`,
    newAddressCode: (email: string) => `Code from the email to ${email}`,
    deliveryFailedTo: (email: string) => `The email to ${email} could not be sent. Ask for the codes again.`,
    deliveryUnknownTo: (email: string) => `The email to ${email} may take a while. If it has not arrived in a couple of minutes, ask for the codes again.`,
    resendCodes: 'Send the codes again',
    confirmChange: 'Confirm change',
    emailChangedTitle: 'Address changed',
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
    weekStart: 'Inicio de la semana',
    weekStartMonday: 'Lunes',
    weekStartSunday: 'Domingo',
    about: 'Acerca de',
    version: 'Versión',
    help: 'Ayuda',
    logout: 'Cerrar sesión',
    deleteAccount: 'Eliminar cuenta',
    deleteAccountConfirm: '¿Eliminar cuenta?',
    deleteAccountWarning: 'Esta acción es irreversible. Todos tus datos se eliminarán permanentemente, junto con los proyectos que posees y todos sus ensayos. Los demás integrantes también los pierden.',
    deleteAccountProjectsWarning: (count: number) =>
      count === 1
        ? 'Se eliminará 1 proyecto en el que eres el único administrador.'
        : `Se eliminarán ${count} proyectos en los que eres el único administrador.`,
    deleteAccountFinalWarning: '¿Seguro que quieres eliminar tu cuenta?',
    deleteAccountSuccess: 'Cuenta eliminada correctamente',
    deleteAccountError: 'No se pudo eliminar la cuenta',
    cancel: 'Cancelar',
    confirmDelete: 'Sí, eliminar',
    editProfile: 'Editar perfil',
    firstName: 'Nombre',
    lastName: 'Apellido',
    email: 'Correo electrónico',
    firstNamePlaceholder: 'Introduce tu nombre',
    lastNamePlaceholder: 'Introduce tu apellido',
    emailPlaceholder: 'Introduce el correo',
    firstNameRequired: 'El nombre es obligatorio',
    emailRequired: 'El correo es obligatorio',
    emailInvalid: 'Formato de correo no válido',
    saveChanges: 'Guardar cambios',
    profileUpdated: 'Perfil actualizado',
    updateError: 'Error al actualizar el perfil',
    avatarHint: 'El avatar se genera automáticamente a partir de tu correo',
    errorTitle: 'Error',
    notificationError: 'No se pudieron actualizar los ajustes de notificaciones',
    pushDeniedTitle: 'Las notificaciones no están permitidas',
    pushDeniedMessage: 'Permite las notificaciones de Rehearsly en los ajustes del teléfono.',
    pushUnsupported: 'Este dispositivo no puede recibir notificaciones push.',
    pushFailed: 'No se pudieron activar las notificaciones en este dispositivo. Comprueba la conexión e inténtalo de nuevo.',
    pushNotAllowedHere: 'Las notificaciones no están permitidas en este teléfono. Toca para permitirlas.',
    pushNotRegisteredHere: 'Este teléfono aún no está listo para recibir notificaciones. Toca para intentarlo de nuevo.',
    openSettings: 'Abrir ajustes',
    languageError: 'No se pudo cambiar el idioma',
    timezoneError: 'No se pudo actualizar la zona horaria',
    weekStartError: 'No se pudo actualizar el inicio de la semana',
    changeEmail: 'Cambiar dirección',
    changeEmailTitle: 'Cambiar dirección',
    changeEmailSubtitle: (email: string) => `Enviaremos un código a ${email} y otro a la dirección nueva. La dirección cambia cuando introduzcas los dos.`,
    newEmail: 'Dirección nueva',
    currentPassword: 'Contraseña actual',
    sendCodes: 'Enviar códigos',
    codesSent: 'Te enviamos los códigos. Los anteriores ya no sirven.',
    currentAddressCode: (email: string) => `Código del correo a ${email}`,
    newAddressCode: (email: string) => `Código del correo a ${email}`,
    deliveryFailedTo: (email: string) => `No se pudo enviar el correo a ${email}. Pide los códigos otra vez.`,
    deliveryUnknownTo: (email: string) => `El correo a ${email} puede tardar. Si no llega en un par de minutos, pide los códigos otra vez.`,
    resendCodes: 'Enviar los códigos otra vez',
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
    notifications: 'Benachrichtigungen',
    language: 'Sprache',
    timezone: 'Zeitzone',
    timezoneModalTitle: 'Zeitzone auswählen',
    timezoneNotSelected: 'Nicht ausgewählt',
    weekStart: 'Wochenbeginn',
    weekStartMonday: 'Montag',
    weekStartSunday: 'Sonntag',
    about: 'Über',
    version: 'Version',
    help: 'Hilfe',
    logout: 'Abmelden',
    deleteAccount: 'Konto löschen',
    deleteAccountConfirm: 'Konto löschen?',
    deleteAccountWarning: 'Diese Aktion ist unumkehrbar. Alle deine Daten werden dauerhaft gelöscht — samt den Projekten, die dir gehören, und all ihren Proben. Alle anderen darin verlieren sie ebenfalls.',
    deleteAccountProjectsWarning: (count: number) =>
      count === 1
        ? '1 Projekt, in dem du der einzige Administrator bist, wird gelöscht.'
        : `${count} Projekte, in denen du der einzige Administrator bist, werden gelöscht.`,
    deleteAccountFinalWarning: 'Möchtest du dein Konto wirklich löschen?',
    deleteAccountSuccess: 'Konto erfolgreich gelöscht',
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
    emailRequired: 'E-Mail ist erforderlich',
    emailInvalid: 'Ungültiges E-Mail-Format',
    saveChanges: 'Änderungen speichern',
    profileUpdated: 'Profil aktualisiert',
    updateError: 'Profil konnte nicht aktualisiert werden',
    avatarHint: 'Der Avatar wird automatisch aus deiner E-Mail-Adresse erstellt',
    errorTitle: 'Fehler',
    notificationError: 'Benachrichtigungseinstellungen konnten nicht aktualisiert werden',
    pushDeniedTitle: 'Benachrichtigungen sind nicht erlaubt',
    pushDeniedMessage: 'Erlaube Benachrichtigungen für Rehearsly in den Einstellungen des Telefons.',
    pushUnsupported: 'Dieses Gerät kann keine Push-Benachrichtigungen empfangen.',
    pushFailed: 'Benachrichtigungen konnten auf diesem Gerät nicht aktiviert werden. Prüfe die Verbindung und versuche es erneut.',
    pushNotAllowedHere: 'Benachrichtigungen sind auf diesem Telefon nicht erlaubt. Tippe, um sie zu erlauben.',
    pushNotRegisteredHere: 'Dieses Telefon ist noch nicht für Benachrichtigungen eingerichtet. Tippe, um es erneut zu versuchen.',
    openSettings: 'Einstellungen öffnen',
    languageError: 'Sprache konnte nicht geändert werden',
    timezoneError: 'Zeitzone konnte nicht aktualisiert werden',
    weekStartError: 'Wochenbeginn konnte nicht aktualisiert werden',
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
    deliveryUnknownTo: (email: string) => `Die E-Mail an ${email} kann etwas dauern. Ist sie nach ein paar Minuten nicht da, fordere die Codes erneut an.`,
    resendCodes: 'Codes erneut senden',
    confirmChange: 'Änderung bestätigen',
    emailChangedTitle: 'Adresse geändert',
    emailChanged: (email: string) => `Du meldest dich jetzt mit ${email} an. Die bisherige Adresse hat eine Nachricht bekommen.`,
    emailTakenByOther: 'Ein anderes Konto nutzt diese Adresse bereits.',
  },
};
