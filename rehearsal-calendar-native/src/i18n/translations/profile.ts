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
  languageError: string;
  timezoneError: string;
  weekStartError: string;
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
    deleteAccountWarning: 'Это действие необратимо. Все ваши данные будут удалены навсегда.',
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
    languageError: 'Не удалось изменить язык',
    timezoneError: 'Не удалось обновить часовой пояс',
    weekStartError: 'Не удалось обновить начало недели',
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
    deleteAccountWarning: 'This action is irreversible. All your data will be permanently deleted.',
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
    languageError: 'Failed to change language',
    timezoneError: 'Failed to update timezone',
    weekStartError: 'Failed to update week start day',
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
    deleteAccountWarning: 'Esta acción es irreversible. Todos tus datos se eliminarán permanentemente.',
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
    languageError: 'No se pudo cambiar el idioma',
    timezoneError: 'No se pudo actualizar la zona horaria',
    weekStartError: 'No se pudo actualizar el inicio de la semana',
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
    deleteAccountWarning: 'Diese Aktion ist unumkehrbar. Alle deine Daten werden dauerhaft gelöscht.',
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
    languageError: 'Sprache konnte nicht geändert werden',
    timezoneError: 'Zeitzone konnte nicht aktualisiert werden',
    weekStartError: 'Wochenbeginn konnte nicht aktualisiert werden',
  },
};
