import React from 'react';
import { View, Text } from 'react-native';
import { styles } from '../styles/subscriptionScreenStyles';
import type { PaymentTransaction } from '../types';
import { getDateLocale } from '../../../shared/utils/locale';

interface PaymentCardProps {
  payment: PaymentTransaction;
  language: string;
  t: any;
}

function formatCurrency(amount: number | string, currency: string): string {
  const numAmount = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
  if (isNaN(numAmount)) {
    return currency === 'ILS' ? '₪0.00' : `${currency} 0.00`;
  }
  if (currency === 'ILS') {
    return `₪${numAmount.toFixed(2)}`;
  }
  return `${currency} ${numAmount.toFixed(2)}`;
}

function getTransactionTypeLabel(type: string, t: any): string {
  switch (type) {
    case 'initial': return t.subscriptions.transactionTypeInitial;
    case 'recurring': return t.subscriptions.transactionTypeRecurring;
    case 'refund': return t.subscriptions.transactionTypeRefund;
    default: return type;
  }
}

function getStatusLabel(status: string, t: any): string {
  switch (status) {
    case 'pending': return t.subscriptions.transactionStatusPending;
    case 'completed': return t.subscriptions.transactionStatusCompleted;
    case 'failed': return t.subscriptions.transactionStatusFailed;
    case 'refunded': return t.subscriptions.transactionStatusRefunded;
    default: return status;
  }
}

function getStatusBadgeStyle(status: string) {
  switch (status) {
    case 'completed': return [styles.statusBadge, styles.statusCompleted];
    case 'pending': return [styles.statusBadge, styles.statusPending];
    case 'failed': return [styles.statusBadge, styles.statusFailed];
    case 'refunded': return [styles.statusBadge, styles.statusRefunded];
    default: return [styles.statusBadge];
  }
}

function getStatusTextStyle(status: string) {
  switch (status) {
    case 'completed': return styles.statusTextCompleted;
    case 'pending': return styles.statusTextPending;
    case 'failed': return styles.statusTextFailed;
    case 'refunded': return styles.statusTextRefunded;
    default: return styles.statusTextCompleted;
  }
}

export function PaymentCard({ payment, language, t }: PaymentCardProps) {
  const displayName = payment.plan_name
    ? (language === 'ru' ? payment.display_name_ru : payment.display_name_en)
    : null;

  return (
    <View style={styles.paymentCard}>
      <View style={styles.paymentCardHeader}>
        <View>
          <Text style={styles.paymentAmount}>
            {formatCurrency(payment.amount, payment.currency)}
          </Text>
          <Text style={styles.paymentDate}>
            {new Date(payment.attempted_at).toLocaleDateString(
              getDateLocale(language),
              { year: 'numeric', month: 'long', day: 'numeric' }
            )}
          </Text>
        </View>
        <View style={getStatusBadgeStyle(payment.status)}>
          <Text style={getStatusTextStyle(payment.status)}>
            {getStatusLabel(payment.status, t)}
          </Text>
        </View>
      </View>

      <View style={styles.paymentDetails}>
        <View style={styles.paymentDetailRow}>
          <Text style={styles.paymentDetailLabel}>{t.subscriptions.paymentType}:</Text>
          <Text style={styles.paymentDetailValue}>{getTransactionTypeLabel(payment.transaction_type, t)}</Text>
        </View>

        {displayName && (
          <View style={styles.paymentDetailRow}>
            <Text style={styles.paymentDetailLabel}>{t.subscriptions.paymentPlan}:</Text>
            <Text style={styles.paymentDetailValue}>{displayName}</Text>
          </View>
        )}

        {payment.error_message && (
          <View style={styles.paymentDetailRow}>
            <Text style={styles.paymentDetailLabel}>{t.subscriptions.paymentError}:</Text>
            <Text style={styles.paymentDetailValue}>{payment.error_message}</Text>
          </View>
        )}
      </View>
    </View>
  );
}
