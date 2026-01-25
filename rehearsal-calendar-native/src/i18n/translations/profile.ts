export interface ProfileTranslations {
  title: string;
  settings: string;
  notifications: string;
  language: string;
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
  premium: string;
}

export const ru = {
  profile: {
    title: 'Профиль',
    settings: 'Настройки',
    notifications: 'Уведомления',
    language: 'Язык',
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
    premium: 'Premium',
  },
};

export const en = {
  profile: {
    title: 'Profile',
    settings: 'Settings',
    notifications: 'Notifications',
    language: 'Language',
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
    premium: 'Premium',
  },
};
