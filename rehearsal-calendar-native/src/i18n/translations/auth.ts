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
  // OAuth translations
  orContinueWith: string;
  signInWithGoogle: string;
  signInWithApple: string;
  googleSignInError: string;
  appleSignInError: string;
  accountLinked: string;
  googleAccountLinkedToExisting: string;
  appleAccountLinkedToExisting: string;
  // Confirming the address with an emailed code (R3)
  verifyTitle: string;
  verifySubtitle: (email: string) => string;
  verifyCodeLabel: string;
  verifyCodePlaceholder: string;
  verifyButton: string;
  resendCode: string;
  resendIn: (seconds: number) => string;
  codeResent: string;
  deliveryFailed: string;
  deliveryUnknown: string;
  codeInvalid: string;
  codeExpired: string;
  codeLocked: string;
  codeMissing: string;
  alreadyVerified: string;
  emailUnavailable: string;
  rateLimited: (seconds: number) => string;
  emailTakenTitle: string;
  emailTakenMessage: string;
  emailNotVerified: string;
  invalidCredentials: string;
  signInAgainToConfirm: string;
  backToLogin: string;
}

export const ru = {
  auth: {
    login: 'Вход',
    register: 'Регистрация',
    loginTitle: 'Rehearsly',
    registerTitle: 'Создать аккаунт',
    loginSubtitle: 'Войдите в свой аккаунт',
    registerSubtitle: 'Присоединяйтесь к Rehearsly',
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
    passwordMinLength: 'Пароль должен содержать минимум 8 символов',
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
    // OAuth translations
    orContinueWith: 'или войти через',
    signInWithGoogle: 'Войти через Google',
    signInWithApple: 'Войти через Apple',
    googleSignInError: 'Ошибка входа через Google',
    appleSignInError: 'Ошибка входа через Apple',
    accountLinked: 'Аккаунты связаны',
    googleAccountLinkedToExisting: 'Ваш аккаунт Google был связан с существующим аккаунтом.',
    appleAccountLinkedToExisting: 'Ваш аккаунт Apple был связан с существующим аккаунтом.',
    verifyTitle: 'Подтвердите адрес',
    verifySubtitle: (email: string) => `Мы отправили шестизначный код на ${email}. Введите его, чтобы войти.`,
    verifyCodeLabel: 'Код из письма',
    verifyCodePlaceholder: '123456',
    verifyButton: 'Подтвердить',
    resendCode: 'Отправить код ещё раз',
    resendIn: (seconds: number) => `Новый код можно запросить через ${seconds} с`,
    codeResent: 'Новый код отправлен. Прежний больше не действует.',
    deliveryFailed: 'Письмо не удалось отправить. Запросите код ещё раз.',
    deliveryUnknown: 'Письмо может прийти с задержкой. Если его нет через пару минут, запросите код ещё раз.',
    codeInvalid: 'Неверный код',
    codeExpired: 'Срок кода истёк. Запросите новый.',
    codeLocked: 'Слишком много неверных попыток. Запросите новый код.',
    codeMissing: 'Действующего кода нет. Запросите новый.',
    alreadyVerified: 'Адрес уже подтверждён. Войдите.',
    emailUnavailable: 'Почта сейчас недоступна. Попробуйте позже.',
    rateLimited: (seconds: number) => `Подождите ${seconds} с и попробуйте снова.`,
    emailTakenTitle: 'Адрес уже занят',
    emailTakenMessage: 'Аккаунт с этим адресом уже есть. Войдите или восстановите пароль.',
    emailNotVerified: 'Сначала подтвердите адрес: введите код из письма.',
    invalidCredentials: 'Неверный email или пароль',
    signInAgainToConfirm: 'Войдите ещё раз, чтобы подтвердить адрес.',
    backToLogin: 'Ко входу',
  },
};

export const en = {
  auth: {
    login: 'Login',
    register: 'Sign Up',
    loginTitle: 'Rehearsly',
    registerTitle: 'Create Account',
    loginSubtitle: 'Sign in to your account',
    registerSubtitle: 'Join Rehearsly',
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
    passwordMinLength: 'Password must be at least 8 characters',
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
    // OAuth translations
    orContinueWith: 'or continue with',
    signInWithGoogle: 'Sign in with Google',
    signInWithApple: 'Sign in with Apple',
    googleSignInError: 'Google Sign-In Error',
    appleSignInError: 'Apple Sign-In Error',
    accountLinked: 'Account Linked',
    googleAccountLinkedToExisting: 'Your Google account has been linked to your existing account.',
    appleAccountLinkedToExisting: 'Your Apple account has been linked to your existing account.',
    verifyTitle: 'Confirm your email',
    verifySubtitle: (email: string) => `We sent a six-digit code to ${email}. Enter it to sign in.`,
    verifyCodeLabel: 'Code from the email',
    verifyCodePlaceholder: '123456',
    verifyButton: 'Confirm',
    resendCode: 'Send the code again',
    resendIn: (seconds: number) => `You can ask for a new code in ${seconds} s`,
    codeResent: 'A new code is on its way. The previous one no longer works.',
    deliveryFailed: 'The email could not be sent. Ask for the code again.',
    deliveryUnknown: 'The email may take a while. If it has not arrived in a couple of minutes, ask for the code again.',
    codeInvalid: 'Wrong code',
    codeExpired: 'The code has expired. Ask for a new one.',
    codeLocked: 'Too many wrong attempts. Ask for a new code.',
    codeMissing: 'There is no active code. Ask for a new one.',
    alreadyVerified: 'This address is already confirmed. Sign in.',
    emailUnavailable: 'Email is unavailable right now. Try again later.',
    rateLimited: (seconds: number) => `Wait ${seconds} s and try again.`,
    emailTakenTitle: 'Address already in use',
    emailTakenMessage: 'An account with this address already exists. Sign in or reset your password.',
    emailNotVerified: 'Confirm your address first: enter the code from the email.',
    invalidCredentials: 'Wrong email or password',
    signInAgainToConfirm: 'Sign in again to confirm your address.',
    backToLogin: 'Back to sign in',
  },
};

export const es = {
  auth: {
    login: 'Iniciar sesión',
    register: 'Registrarse',
    loginTitle: 'Rehearsly',
    registerTitle: 'Crear cuenta',
    loginSubtitle: 'Inicia sesión en tu cuenta',
    registerSubtitle: 'Únete a Rehearsly',
    email: 'Correo electrónico',
    password: 'Contraseña',
    firstName: 'Nombre',
    lastName: 'Apellido',
    confirmPassword: 'Confirmar contraseña',
    loginButton: 'Iniciar sesión',
    registerButton: 'Registrarse',
    createAccount: 'Crear cuenta',
    alreadyHaveAccount: '¿Ya tienes una cuenta? Inicia sesión',
    loginWithTelegram: 'Iniciar sesión con Telegram',
    registerWithTelegram: 'Registrarse con Telegram',
    fillAllFields: 'Completa todos los campos',
    invalidEmail: 'Formato de correo no válido',
    passwordMinLength: 'La contraseña debe tener al menos 8 caracteres',
    passwordsMismatch: 'Las contraseñas no coinciden',
    loginError: 'Error de inicio de sesión',
    registerError: 'Error de registro',
    emailPlaceholder: 'tu@email.com',
    passwordPlaceholder: '••••••••',
    firstNamePlaceholder: 'Tu nombre',
    lastNamePlaceholder: 'Tu apellido (opcional)',
    confirmPasswordPlaceholder: 'Repetir contraseña',
    required: '*',
    optional: '(opcional)',
    // OAuth translations
    orContinueWith: 'o continuar con',
    signInWithGoogle: 'Iniciar sesión con Google',
    signInWithApple: 'Iniciar sesión con Apple',
    googleSignInError: 'Error al iniciar sesión con Google',
    appleSignInError: 'Error al iniciar sesión con Apple',
    accountLinked: 'Cuenta vinculada',
    googleAccountLinkedToExisting: 'Tu cuenta de Google se ha vinculado a tu cuenta existente.',
    appleAccountLinkedToExisting: 'Tu cuenta de Apple se ha vinculado a tu cuenta existente.',
    verifyTitle: 'Confirma tu correo',
    verifySubtitle: (email: string) => `Enviamos un código de seis dígitos a ${email}. Introdúcelo para entrar.`,
    verifyCodeLabel: 'Código del correo',
    verifyCodePlaceholder: '123456',
    verifyButton: 'Confirmar',
    resendCode: 'Enviar el código otra vez',
    resendIn: (seconds: number) => `Podrás pedir un código nuevo en ${seconds} s`,
    codeResent: 'Te enviamos un código nuevo. El anterior ya no sirve.',
    deliveryFailed: 'No se pudo enviar el correo. Pide el código otra vez.',
    deliveryUnknown: 'El correo puede tardar. Si no llega en un par de minutos, pide el código otra vez.',
    codeInvalid: 'Código incorrecto',
    codeExpired: 'El código ha caducado. Pide uno nuevo.',
    codeLocked: 'Demasiados intentos fallidos. Pide un código nuevo.',
    codeMissing: 'No hay ningún código activo. Pide uno nuevo.',
    alreadyVerified: 'Esta dirección ya está confirmada. Inicia sesión.',
    emailUnavailable: 'El correo no está disponible ahora. Inténtalo más tarde.',
    rateLimited: (seconds: number) => `Espera ${seconds} s y vuelve a intentarlo.`,
    emailTakenTitle: 'Dirección en uso',
    emailTakenMessage: 'Ya existe una cuenta con esta dirección. Inicia sesión o restablece tu contraseña.',
    emailNotVerified: 'Primero confirma tu dirección: introduce el código del correo.',
    invalidCredentials: 'Correo o contraseña incorrectos',
    signInAgainToConfirm: 'Vuelve a iniciar sesión para confirmar tu dirección.',
    backToLogin: 'Volver a iniciar sesión',
  },
};

export const de = {
  auth: {
    login: 'Anmelden',
    register: 'Registrieren',
    loginTitle: 'Rehearsly',
    registerTitle: 'Konto erstellen',
    loginSubtitle: 'Melde dich bei deinem Konto an',
    registerSubtitle: 'Tritt Rehearsly bei',
    email: 'E-Mail',
    password: 'Passwort',
    firstName: 'Vorname',
    lastName: 'Nachname',
    confirmPassword: 'Passwort bestätigen',
    loginButton: 'Anmelden',
    registerButton: 'Registrieren',
    createAccount: 'Konto erstellen',
    alreadyHaveAccount: 'Bereits ein Konto? Anmelden',
    loginWithTelegram: 'Mit Telegram anmelden',
    registerWithTelegram: 'Mit Telegram registrieren',
    fillAllFields: 'Bitte alle Felder ausfüllen',
    invalidEmail: 'Ungültiges E-Mail-Format',
    passwordMinLength: 'Das Passwort muss mindestens 8 Zeichen lang sein',
    passwordsMismatch: 'Passwörter stimmen nicht überein',
    loginError: 'Anmeldefehler',
    registerError: 'Registrierungsfehler',
    emailPlaceholder: 'deine@email.com',
    passwordPlaceholder: '••••••••',
    firstNamePlaceholder: 'Dein Vorname',
    lastNamePlaceholder: 'Dein Nachname (optional)',
    confirmPasswordPlaceholder: 'Passwort wiederholen',
    required: '*',
    optional: '(optional)',
    // OAuth translations
    orContinueWith: 'oder fortfahren mit',
    signInWithGoogle: 'Mit Google anmelden',
    signInWithApple: 'Mit Apple anmelden',
    googleSignInError: 'Fehler bei der Google-Anmeldung',
    appleSignInError: 'Fehler bei der Apple-Anmeldung',
    accountLinked: 'Konto verknüpft',
    googleAccountLinkedToExisting: 'Dein Google-Konto wurde mit deinem bestehenden Konto verknüpft.',
    appleAccountLinkedToExisting: 'Dein Apple-Konto wurde mit deinem bestehenden Konto verknüpft.',
    verifyTitle: 'E-Mail bestätigen',
    verifySubtitle: (email: string) => `Wir haben einen sechsstelligen Code an ${email} geschickt. Gib ihn ein, um dich anzumelden.`,
    verifyCodeLabel: 'Code aus der E-Mail',
    verifyCodePlaceholder: '123456',
    verifyButton: 'Bestätigen',
    resendCode: 'Code erneut senden',
    resendIn: (seconds: number) => `Einen neuen Code kannst du in ${seconds} s anfordern`,
    codeResent: 'Ein neuer Code ist unterwegs. Der vorige gilt nicht mehr.',
    deliveryFailed: 'Die E-Mail konnte nicht gesendet werden. Fordere den Code erneut an.',
    deliveryUnknown: 'Die E-Mail kann etwas dauern. Ist sie nach ein paar Minuten nicht da, fordere den Code erneut an.',
    codeInvalid: 'Falscher Code',
    codeExpired: 'Der Code ist abgelaufen. Fordere einen neuen an.',
    codeLocked: 'Zu viele falsche Versuche. Fordere einen neuen Code an.',
    codeMissing: 'Es gibt keinen gültigen Code. Fordere einen neuen an.',
    alreadyVerified: 'Diese Adresse ist bereits bestätigt. Melde dich an.',
    emailUnavailable: 'E-Mail ist gerade nicht verfügbar. Versuch es später noch einmal.',
    rateLimited: (seconds: number) => `Warte ${seconds} s und versuch es noch einmal.`,
    emailTakenTitle: 'Adresse bereits vergeben',
    emailTakenMessage: 'Mit dieser Adresse gibt es schon ein Konto. Melde dich an oder setze dein Passwort zurück.',
    emailNotVerified: 'Bestätige zuerst deine Adresse: Gib den Code aus der E-Mail ein.',
    invalidCredentials: 'E-Mail oder Passwort falsch',
    signInAgainToConfirm: 'Melde dich erneut an, um deine Adresse zu bestätigen.',
    backToLogin: 'Zurück zur Anmeldung',
  },
};
