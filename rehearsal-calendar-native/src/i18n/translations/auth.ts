export interface AuthTranslations {
  login: string;
  register: string;
  loginTitle: string;
  registerTitle: string;
  loginSubtitle: string;
  registerSubtitle: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  confirmPassword: string;
  loginButton: string;
  registerButton: string;
  createAccount: string;
  alreadyHaveAccount: string;
  loginWithTelegram: string;
  registerWithTelegram: string;
  fillAllFields: string;
  invalidEmail: string;
  passwordMinLength: string;
  passwordsMismatch: string;
  loginError: string;
  registerError: string;
  emailPlaceholder: string;
  passwordPlaceholder: string;
  firstNamePlaceholder: string;
  lastNamePlaceholder: string;
  confirmPasswordPlaceholder: string;
  required: string;
  optional: string;
}

export const ru = {
  auth: {
    login: 'Вход',
    register: 'Регистрация',
    loginTitle: 'Rehearsal Calendar',
    registerTitle: 'Создать аккаунт',
    loginSubtitle: 'Войдите в свой аккаунт',
    registerSubtitle: 'Присоединяйтесь к Rehearsal Calendar',
    email: 'Email',
    password: 'Пароль',
    firstName: 'Имя',
    lastName: 'Фамилия',
    confirmPassword: 'Подтвердите пароль',
    loginButton: 'Войти',
    registerButton: 'Зарегистрироваться',
    createAccount: 'Создать аккаунт',
    alreadyHaveAccount: 'Уже есть аккаунт? Войти',
    loginWithTelegram: 'Войти через Telegram',
    registerWithTelegram: 'Зарегистрироваться через Telegram',
    fillAllFields: 'Заполните все поля',
    invalidEmail: 'Неверный формат email',
    passwordMinLength: 'Пароль должен содержать минимум 6 символов',
    passwordsMismatch: 'Пароли не совпадают',
    loginError: 'Ошибка входа',
    registerError: 'Ошибка регистрации',
    emailPlaceholder: 'your@email.com',
    passwordPlaceholder: '••••••••',
    firstNamePlaceholder: 'Ваше имя',
    lastNamePlaceholder: 'Ваша фамилия (опционально)',
    confirmPasswordPlaceholder: 'Повторите пароль',
    required: '*',
    optional: '(опционально)',
  },
};

export const en = {
  auth: {
    login: 'Login',
    register: 'Sign Up',
    loginTitle: 'Rehearsal Calendar',
    registerTitle: 'Create Account',
    loginSubtitle: 'Sign in to your account',
    registerSubtitle: 'Join Rehearsal Calendar',
    email: 'Email',
    password: 'Password',
    firstName: 'First Name',
    lastName: 'Last Name',
    confirmPassword: 'Confirm Password',
    loginButton: 'Sign In',
    registerButton: 'Sign Up',
    createAccount: 'Create Account',
    alreadyHaveAccount: 'Already have an account? Sign In',
    loginWithTelegram: 'Sign in with Telegram',
    registerWithTelegram: 'Sign up with Telegram',
    fillAllFields: 'Fill in all fields',
    invalidEmail: 'Invalid email format',
    passwordMinLength: 'Password must be at least 6 characters',
    passwordsMismatch: 'Passwords do not match',
    loginError: 'Login Error',
    registerError: 'Registration Error',
    emailPlaceholder: 'your@email.com',
    passwordPlaceholder: '••••••••',
    firstNamePlaceholder: 'Your first name',
    lastNamePlaceholder: 'Your last name (optional)',
    confirmPasswordPlaceholder: 'Repeat password',
    required: '*',
    optional: '(optional)',
  },
};
