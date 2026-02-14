import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassButton } from '../../../shared/components';
import { Colors } from '../../../shared/constants/colors';
import { styles } from '../styles/subscriptionScreenStyles';
import { PaymentCard } from './PaymentCard';
import type { UserSubscription, PaymentTransaction } from '../types';

interface SubscriptionManagementProps {
  subscription: UserSubscription;
  paymentHistory: PaymentTransaction[];
  loadingHistory: boolean;
  cancelLoading: boolean;
  language: string;
  t: any;
  onCancel: () => void;
  onViewPlans: () => void;
}

export function SubscriptionManagement({
  subscription,
  paymentHistory,
  loadingHistory,
  cancelLoading,
  language,
  t,
  onCancel,
  onViewPlans,
}: SubscriptionManagementProps) {
  return (
    <View style={styles.managementContainer}>
      {/* Current Subscription Card */}
      <View style={styles.currentSubscriptionCard}>
        <View style={styles.subscriptionHeader}>
          <Ionicons name="shield-checkmark" size={24} color={Colors.accent.purple} />
          <Text style={styles.subscriptionTitle}>
            {language === 'ru'
              ? subscription.display_name_ru
              : subscription.display_name_en}
          </Text>
        </View>

        <View style={styles.subscriptionInfo}>
          <Text style={styles.subscriptionInfoLabel}>
            {language === 'ru' ? 'Статус:' : 'Status:'}
          </Text>
          <Text style={styles.subscriptionInfoValue}>
            {subscription.status === 'active'
              ? t.subscriptions.statusActive
              : subscription.status}
          </Text>
        </View>

        {subscription.next_billing_date && (
          <View style={styles.subscriptionInfo}>
            <Text style={styles.subscriptionInfoLabel}>
              {language === 'ru' ? 'Следующий платёж:' : 'Next billing:'}
            </Text>
            <Text style={styles.subscriptionInfoValue}>
              {new Date(subscription.next_billing_date).toLocaleDateString(
                language === 'ru' ? 'ru-RU' : 'en-US',
                { year: 'numeric', month: 'long', day: 'numeric' }
              )}
            </Text>
          </View>
        )}

        {!subscription.next_billing_date && (
          <View style={styles.subscriptionInfo}>
            <Text style={styles.subscriptionInfoLabel}>
              {language === 'ru' ? 'Тип:' : 'Type:'}
            </Text>
            <Text style={styles.subscriptionInfoValue}>
              {language === 'ru' ? 'Навсегда' : 'Lifetime'}
            </Text>
          </View>
        )}

        <GlassButton
          title={t.subscriptions.cancelButton}
          onPress={onCancel}
          variant="glass"
          loading={cancelLoading}
          style={styles.cancelButton}
        />
      </View>

      {/* Payment History */}
      <View style={styles.paymentHistorySection}>
        <Text style={styles.paymentHistoryTitle}>
          {t.subscriptions.paymentHistory}
        </Text>

        {loadingHistory ? (
          <ActivityIndicator size="large" color={Colors.accent.purple} />
        ) : paymentHistory.length > 0 ? (
          paymentHistory.map(payment => (
            <PaymentCard key={payment.id} payment={payment} language={language} t={t} />
          ))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons
              name="document-text-outline"
              size={48}
              color={Colors.text.secondary}
              style={styles.emptyStateIcon}
            />
            <Text style={styles.emptyStateText}>{t.subscriptions.noPayments}</Text>
          </View>
        )}
      </View>

      {/* View Plans Button */}
      <GlassButton
        title={t.subscriptions.viewPlans}
        onPress={onViewPlans}
        variant="purple"
        style={styles.viewPlansButton}
      />
    </View>
  );
}
