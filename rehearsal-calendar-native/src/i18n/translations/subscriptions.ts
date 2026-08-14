export interface SubscriptionsTranslations {
  // Management Screen
  managementTitle: string;
  paymentHistory: string;
  noPayments: string;
  viewPlans: string;

  // Status labels
  statusActive: string;
  statusCancelled: string;
  statusExpired: string;
  statusPaymentFailed: string;

  // Transaction types
  transactionTypeInitial: string;
  transactionTypeRecurring: string;
  transactionTypeRefund: string;

  // Transaction status
  transactionStatusPending: string;
  transactionStatusCompleted: string;
  transactionStatusFailed: string;
  transactionStatusRefunded: string;

  // Payment card labels
  paymentType: string;
  paymentPlan: string;
  paymentError: string;

  // Hosted Fields (AllPay)
  paymentSuccess: string;
  paymentSuccessMessage: string;
  paymentLoading: string;

  // Cancel subscription
  cancelTitle: string;
  cancelWarning: string;
  cancelWarningLifetime: string;
  cancelButton: string;
  cancelConfirm: string;
  cancelSuccess: string;
  cancelSuccessMessage: string;

  // Errors
  loadError: string;
  cancelError: string;
}

export const ru = {
  subscriptions: {
    // Management Screen
    managementTitle: 'Управление подпиской',
    paymentHistory: 'История платежей',
    noPayments: 'Нет платежей',
    viewPlans: 'Посмотреть планы',

    // Status labels
    statusActive: 'Активна',
    statusCancelled: 'Отменена',
    statusExpired: 'Истекла',
    statusPaymentFailed: 'Ошибка оплаты',

    // Transaction types
    transactionTypeInitial: 'Первоначальный платёж',
    transactionTypeRecurring: 'Ежемесячный платёж',
    transactionTypeRefund: 'Возврат',

    // Transaction status
    transactionStatusPending: 'В обработке',
    transactionStatusCompleted: 'Завершён',
    transactionStatusFailed: 'Ошибка',
    transactionStatusRefunded: 'Возвращён',

    // Payment card labels
    paymentType: 'Тип',
    paymentPlan: 'План',
    paymentError: 'Ошибка',

    // Hosted Fields (AllPay)
    paymentSuccess: 'Успех!',
    paymentSuccessMessage: 'Подписка успешно оформлена! Теперь вы можете создавать проекты.',
    paymentLoading: 'Загрузка формы оплаты...',

    // Cancel subscription
    cancelTitle: 'Отменить подписку?',
    cancelWarning: 'Вы уверены, что хотите отменить подписку? Вы потеряете возможность создавать проекты в конце текущего периода.',
    cancelWarningLifetime: 'Вы уверены, что хотите отменить подписку? Вы больше не сможете создавать новые проекты.',
    cancelButton: 'Отменить подписку',
    cancelConfirm: 'Да, отменить',
    cancelSuccess: 'Подписка отменена',
    cancelSuccessMessage: 'Ваша подписка была успешно отменена.',

    // Errors
    loadError: 'Не удалось загрузить данные подписки',
    cancelError: 'Не удалось отменить подписку',
  },
};

export const en = {
  subscriptions: {
    // Management Screen
    managementTitle: 'Manage Subscription',
    paymentHistory: 'Payment History',
    noPayments: 'No payments yet',
    viewPlans: 'View Plans',

    // Status labels
    statusActive: 'Active',
    statusCancelled: 'Cancelled',
    statusExpired: 'Expired',
    statusPaymentFailed: 'Payment Failed',

    // Transaction types
    transactionTypeInitial: 'Initial Payment',
    transactionTypeRecurring: 'Recurring Payment',
    transactionTypeRefund: 'Refund',

    // Transaction status
    transactionStatusPending: 'Pending',
    transactionStatusCompleted: 'Completed',
    transactionStatusFailed: 'Failed',
    transactionStatusRefunded: 'Refunded',

    // Payment card labels
    paymentType: 'Type',
    paymentPlan: 'Plan',
    paymentError: 'Error',

    // Hosted Fields (AllPay)
    paymentSuccess: 'Success!',
    paymentSuccessMessage: 'Subscription created successfully! You can now create projects.',
    paymentLoading: 'Loading payment form...',

    // Cancel subscription
    cancelTitle: 'Cancel Subscription?',
    cancelWarning: 'Are you sure you want to cancel your subscription? You will lose the ability to create projects at the end of the current period.',
    cancelWarningLifetime: 'Are you sure you want to cancel your subscription? You will no longer be able to create new projects.',
    cancelButton: 'Cancel Subscription',
    cancelConfirm: 'Yes, cancel',
    cancelSuccess: 'Subscription Cancelled',
    cancelSuccessMessage: 'Your subscription has been cancelled successfully.',

    // Errors
    loadError: 'Failed to load subscription data',
    cancelError: 'Failed to cancel subscription',
  },
};

export const es = {
  subscriptions: {
    // Management Screen
    managementTitle: 'Gestionar suscripción',
    paymentHistory: 'Historial de pagos',
    noPayments: 'Aún no hay pagos',
    viewPlans: 'Ver planes',

    // Status labels
    statusActive: 'Activa',
    statusCancelled: 'Cancelada',
    statusExpired: 'Caducada',
    statusPaymentFailed: 'Pago fallido',

    // Transaction types
    transactionTypeInitial: 'Pago inicial',
    transactionTypeRecurring: 'Pago recurrente',
    transactionTypeRefund: 'Reembolso',

    // Transaction status
    transactionStatusPending: 'Pendiente',
    transactionStatusCompleted: 'Completado',
    transactionStatusFailed: 'Fallido',
    transactionStatusRefunded: 'Reembolsado',

    // Payment card labels
    paymentType: 'Tipo',
    paymentPlan: 'Plan',
    paymentError: 'Error',

    // Hosted Fields (AllPay)
    paymentSuccess: '¡Éxito!',
    paymentSuccessMessage: '¡Suscripción creada con éxito! Ahora puedes crear proyectos.',
    paymentLoading: 'Cargando formulario de pago...',

    // Cancel subscription
    cancelTitle: '¿Cancelar suscripción?',
    cancelWarning: '¿Seguro que quieres cancelar tu suscripción? Perderás la posibilidad de crear proyectos al final del período actual.',
    cancelWarningLifetime: '¿Seguro que quieres cancelar tu suscripción? Ya no podrás crear nuevos proyectos.',
    cancelButton: 'Cancelar suscripción',
    cancelConfirm: 'Sí, cancelar',
    cancelSuccess: 'Suscripción cancelada',
    cancelSuccessMessage: 'Tu suscripción se ha cancelado correctamente.',

    // Errors
    loadError: 'No se pudieron cargar los datos de la suscripción',
    cancelError: 'No se pudo cancelar la suscripción',
  },
};

export const de = {
  subscriptions: {
    // Management Screen
    managementTitle: 'Abonnement verwalten',
    paymentHistory: 'Zahlungsverlauf',
    noPayments: 'Noch keine Zahlungen',
    viewPlans: 'Pläne ansehen',

    // Status labels
    statusActive: 'Aktiv',
    statusCancelled: 'Gekündigt',
    statusExpired: 'Abgelaufen',
    statusPaymentFailed: 'Zahlung fehlgeschlagen',

    // Transaction types
    transactionTypeInitial: 'Erstzahlung',
    transactionTypeRecurring: 'Wiederkehrende Zahlung',
    transactionTypeRefund: 'Rückerstattung',

    // Transaction status
    transactionStatusPending: 'Ausstehend',
    transactionStatusCompleted: 'Abgeschlossen',
    transactionStatusFailed: 'Fehlgeschlagen',
    transactionStatusRefunded: 'Erstattet',

    // Payment card labels
    paymentType: 'Typ',
    paymentPlan: 'Plan',
    paymentError: 'Fehler',

    // Hosted Fields (AllPay)
    paymentSuccess: 'Erfolg!',
    paymentSuccessMessage: 'Abonnement erfolgreich erstellt! Du kannst jetzt Projekte erstellen.',
    paymentLoading: 'Zahlungsformular wird geladen...',

    // Cancel subscription
    cancelTitle: 'Abonnement kündigen?',
    cancelWarning: 'Möchtest du dein Abonnement wirklich kündigen? Am Ende der aktuellen Periode kannst du keine Projekte mehr erstellen.',
    cancelWarningLifetime: 'Möchtest du dein Abonnement wirklich kündigen? Du kannst dann keine neuen Projekte mehr erstellen.',
    cancelButton: 'Abonnement kündigen',
    cancelConfirm: 'Ja, kündigen',
    cancelSuccess: 'Abonnement gekündigt',
    cancelSuccessMessage: 'Dein Abonnement wurde erfolgreich gekündigt.',

    // Errors
    loadError: 'Abonnementdaten konnten nicht geladen werden',
    cancelError: 'Abonnement konnte nicht gekündigt werden',
  },
};
