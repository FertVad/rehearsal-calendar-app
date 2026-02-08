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
