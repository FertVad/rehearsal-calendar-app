/**
 * Subscription Screen
 * Displays subscription plans, current subscription status, and handles AllPay checkout
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { GlassButton } from '../../../shared/components';
import { subscriptionsAPI } from '../../../shared/services/api';
import { useI18n } from '../../../contexts/I18nContext';
import { ProfileStackParamList } from '../../../navigation';
import { styles } from '../styles/subscriptionScreenStyles';
import { Colors } from '../../../shared/constants/colors';

type SubscriptionScreenProps = NativeStackScreenProps<ProfileStackParamList, 'Subscription'>;

interface SubscriptionPlan {
  id: number;
  name: string;
  display_name_en: string;
  display_name_ru: string;
  price_ils: number;
  billing_period: string;
  max_projects: number;
  max_members_per_project: number;
  features: string[];
}

interface UserSubscription {
  id: number;
  plan_id: number;
  plan_name: string;
  display_name_en: string;
  display_name_ru: string;
  status: string;
  current_period_end: string;
  next_billing_date: string;
}

interface PaymentTransaction {
  id: number;
  user_id: number;
  subscription_id: number | null;
  allpay_order_id: string;
  allpay_transaction_id: string | null;
  allpay_payment_status: number | null;
  amount: number | string; // PostgreSQL returns NUMERIC as string
  currency: string;
  payment_method: string | null;
  transaction_type: 'initial' | 'recurring' | 'refund';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  error_message: string | null;
  attempted_at: string;
  completed_at: string | null;
  plan_name: string | null;
  display_name_en: string | null;
  display_name_ru: string | null;
}

export default function SubscriptionScreen({ navigation }: SubscriptionScreenProps) {
  const { t, language } = useI18n();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<PaymentTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const pollingIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansResponse, subscriptionResponse] = await Promise.all([
        subscriptionsAPI.getPlans(),
        subscriptionsAPI.getCurrentSubscription(),
      ]);

      setPlans(plansResponse.data.plans || []);
      const subscription = subscriptionResponse.data.subscription;
      setCurrentSubscription(subscription);

      // Load payment history if subscription exists
      if (subscription) {
        loadPaymentHistory();
      }
    } catch (error: any) {
      console.error('Failed to load subscription data:', error);
      Alert.alert(t.common.error, error.response?.data?.error || t.subscriptions.loadError);
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentHistory = async () => {
    try {
      setLoadingHistory(true);
      const response = await subscriptionsAPI.getPaymentHistory(50);
      setPaymentHistory(response.data.payments || []);
    } catch (error: any) {
      console.error('Failed to load payment history:', error);
      // Don't show alert - payment history is optional
    } finally {
      setLoadingHistory(false);
    }
  };

  // Helper functions
  const formatCurrency = (amount: number | string, currency: string): string => {
    // Handle null, undefined, or non-numeric values
    const numAmount = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));

    // Check if conversion resulted in valid number
    if (isNaN(numAmount)) {
      return currency === 'ILS' ? '₪0.00' : `${currency} 0.00`;
    }

    if (currency === 'ILS') {
      return `₪${numAmount.toFixed(2)}`;
    }
    return `${currency} ${numAmount.toFixed(2)}`;
  };

  const getTransactionTypeLabel = (type: string): string => {
    switch (type) {
      case 'initial':
        return t.subscriptions.transactionTypeInitial;
      case 'recurring':
        return t.subscriptions.transactionTypeRecurring;
      case 'refund':
        return t.subscriptions.transactionTypeRefund;
      default:
        return type;
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending':
        return t.subscriptions.transactionStatusPending;
      case 'completed':
        return t.subscriptions.transactionStatusCompleted;
      case 'failed':
        return t.subscriptions.transactionStatusFailed;
      case 'refunded':
        return t.subscriptions.transactionStatusRefunded;
      default:
        return status;
    }
  };

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return [styles.statusBadge, styles.statusCompleted];
      case 'pending':
        return [styles.statusBadge, styles.statusPending];
      case 'failed':
        return [styles.statusBadge, styles.statusFailed];
      case 'refunded':
        return [styles.statusBadge, styles.statusRefunded];
      default:
        return [styles.statusBadge];
    }
  };

  const getStatusTextStyle = (status: string) => {
    switch (status) {
      case 'completed':
        return styles.statusTextCompleted;
      case 'pending':
        return styles.statusTextPending;
      case 'failed':
        return styles.statusTextFailed;
      case 'refunded':
        return styles.statusTextRefunded;
      default:
        return styles.statusTextCompleted;
    }
  };

  const startPolling = (orderId: string) => {
    // Clear any existing polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    // Poll every 2 seconds
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await subscriptionsAPI.checkPendingOrder(orderId);
        const { subscriptionCreated } = response.data;

        if (subscriptionCreated) {
          // Success! Stop polling and close WebView
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
          }
          setCheckoutUrl(null);
          setSelectedPlanId(null);
          setCurrentOrderId(null);
          setShowPlans(false);

          Alert.alert(
            language === 'ru' ? 'Успех!' : 'Success!',
            language === 'ru'
              ? 'Подписка успешно оформлена! Теперь вы можете создавать проекты.'
              : 'Subscription created successfully! You can now create projects.',
            [{ text: 'OK', onPress: () => loadData() }]
          );
        }
      } catch (error: any) {
        console.error('Polling error:', error);
        // Don't show error to user, polling will continue
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const handleSelectPlan = async (planId: number) => {
    if (currentSubscription) {
      Alert.alert(
        t.common.error,
        language === 'ru'
          ? 'У вас уже есть активная подписка. Сначала отмените её.'
          : 'You already have an active subscription. Please cancel it first.'
      );
      return;
    }

    try {
      setSelectedPlanId(planId);
      const response = await subscriptionsAPI.createCheckout(planId, language);
      const { checkoutUrl: url, orderId } = response.data;

      console.log('[DEBUG] Checkout created:', { checkoutUrl: url, orderId });

      setCheckoutUrl(url);
      setCurrentOrderId(orderId);

      // Start polling for payment completion
      startPolling(orderId);
    } catch (error: any) {
      console.error('Failed to create checkout:', error);
      Alert.alert(t.common.error, error.response?.data?.error || 'Failed to create checkout');
      setSelectedPlanId(null);
    }
  };

  // Handle messages from Hosted Fields page (postMessage)
  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('[WebView] Received message:', data);

      if (data.type === 'payment_success') {
        stopPolling();
        setCheckoutUrl(null);
        setSelectedPlanId(null);
        setShowPlans(false);

        const orderId = data.orderId || currentOrderId;
        setCurrentOrderId(null);

        // Verify/create subscription via check-pending
        if (orderId) {
          try {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const response = await subscriptionsAPI.checkPendingOrder(orderId);
            if (!response.data.subscriptionCreated) {
              await new Promise(resolve => setTimeout(resolve, 3000));
              await subscriptionsAPI.checkPendingOrder(orderId);
            }
          } catch (e) {
            console.error('[HostedFields] Error verifying subscription:', e);
          }
        }

        Alert.alert(
          language === 'ru' ? 'Успех!' : 'Success!',
          language === 'ru'
            ? 'Подписка успешно оформлена! Теперь вы можете создавать проекты.'
            : 'Subscription created successfully! You can now create projects.',
          [{ text: 'OK', onPress: () => loadData() }]
        );
      } else if (data.type === 'payment_error') {
        console.error('[HostedFields] Payment error:', data.error, data.message);
        // Don't close WebView on error — user can retry
      }
    } catch (e) {
      // Not a JSON message, ignore
    }
  };

  const handleWebViewNavigationStateChange = async (navState: any) => {
    const { url } = navState;

    // Handle success redirect (fallback for non-hosted-fields flow)
    if (url.includes('rehearsalapp://subscription/success')) {
      stopPolling();
      setCheckoutUrl(null);
      setSelectedPlanId(null);
      setShowPlans(false);

      const orderId = currentOrderId;
      setCurrentOrderId(null);

      if (orderId) {
        try {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const response = await subscriptionsAPI.checkPendingOrder(orderId);
          if (!response.data.subscriptionCreated) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            await subscriptionsAPI.checkPendingOrder(orderId);
          }
        } catch (e) {
          console.error('[Redirect] Error verifying subscription:', e);
        }
      }

      Alert.alert(
        language === 'ru' ? 'Успех!' : 'Success!',
        language === 'ru'
          ? 'Подписка успешно оформлена! Теперь вы можете создавать проекты.'
          : 'Subscription created successfully! You can now create projects.',
        [{ text: 'OK', onPress: () => loadData() }]
      );
    }

    // Handle cancel redirect (custom URL scheme)
    if (url.includes('rehearsalapp://subscription/cancel')) {
      stopPolling();
      setCheckoutUrl(null);
      setSelectedPlanId(null);
      setCurrentOrderId(null);
    }
  };

  const handleCancelSubscription = () => {
    // Check if it's a lifetime subscription
    const isLifetime = currentSubscription?.next_billing_date === null;

    Alert.alert(
      t.subscriptions.cancelTitle,
      isLifetime ? t.subscriptions.cancelWarningLifetime : t.subscriptions.cancelWarning,
      [
        { text: language === 'ru' ? 'Назад' : 'Back', style: 'cancel' },
        {
          text: t.subscriptions.cancelConfirm,
          style: 'destructive',
          onPress: confirmCancelSubscription,
        },
      ]
    );
  };

  const confirmCancelSubscription = async () => {
    try {
      setCancelLoading(true);
      await subscriptionsAPI.cancelSubscription('User requested cancellation');
      Alert.alert(
        t.subscriptions.cancelSuccess,
        t.subscriptions.cancelSuccessMessage
      );
      setShowPlans(false);
      loadData();
    } catch (error: any) {
      console.error('Failed to cancel subscription:', error);
      Alert.alert(t.common.error, error.response?.data?.error || t.subscriptions.cancelError);
    } finally {
      setCancelLoading(false);
    }
  };

  const renderManagementView = () => {
    if (!currentSubscription) return null;

    return (
      <View style={styles.managementContainer}>
        {/* Current Subscription Card */}
        <View style={styles.currentSubscriptionCard}>
          <View style={styles.subscriptionHeader}>
            <Ionicons name="shield-checkmark" size={24} color={Colors.accent.purple} />
            <Text style={styles.subscriptionTitle}>
              {language === 'ru'
                ? currentSubscription.display_name_ru
                : currentSubscription.display_name_en}
            </Text>
          </View>

          <View style={styles.subscriptionInfo}>
            <Text style={styles.subscriptionInfoLabel}>
              {language === 'ru' ? 'Статус:' : 'Status:'}
            </Text>
            <Text style={styles.subscriptionInfoValue}>
              {currentSubscription.status === 'active'
                ? t.subscriptions.statusActive
                : currentSubscription.status}
            </Text>
          </View>

          {currentSubscription.next_billing_date && (
            <View style={styles.subscriptionInfo}>
              <Text style={styles.subscriptionInfoLabel}>
                {language === 'ru' ? 'Следующий платёж:' : 'Next billing:'}
              </Text>
              <Text style={styles.subscriptionInfoValue}>
                {new Date(currentSubscription.next_billing_date).toLocaleDateString(
                  language === 'ru' ? 'ru-RU' : 'en-US',
                  { year: 'numeric', month: 'long', day: 'numeric' }
                )}
              </Text>
            </View>
          )}

          {!currentSubscription.next_billing_date && (
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
            onPress={handleCancelSubscription}
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
            paymentHistory.map(payment => renderPaymentCard(payment))
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
          onPress={() => setShowPlans(true)}
          variant="purple"
          style={styles.viewPlansButton}
        />
      </View>
    );
  };

  const renderPaymentCard = (payment: PaymentTransaction) => {
    const displayName = payment.plan_name
      ? (language === 'ru' ? payment.display_name_ru : payment.display_name_en)
      : null;

    return (
      <View key={payment.id} style={styles.paymentCard}>
        <View style={styles.paymentCardHeader}>
          <View>
            <Text style={styles.paymentAmount}>
              {formatCurrency(payment.amount, payment.currency)}
            </Text>
            <Text style={styles.paymentDate}>
              {new Date(payment.attempted_at).toLocaleDateString(
                language === 'ru' ? 'ru-RU' : 'en-US',
                { year: 'numeric', month: 'long', day: 'numeric' }
              )}
            </Text>
          </View>
          <View style={getStatusBadgeStyle(payment.status)}>
            <Text style={getStatusTextStyle(payment.status)}>
              {getStatusLabel(payment.status)}
            </Text>
          </View>
        </View>

        <View style={styles.paymentDetails}>
          <View style={styles.paymentDetailRow}>
            <Text style={styles.paymentDetailLabel}>{t.subscriptions.paymentType}:</Text>
            <Text style={styles.paymentDetailValue}>{getTransactionTypeLabel(payment.transaction_type)}</Text>
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
  };

  const renderPlanCard = (plan: SubscriptionPlan) => {
    const displayName = language === 'ru' ? plan.display_name_ru : plan.display_name_en;
    const isCurrentPlan = currentSubscription?.plan_id === plan.id;

    // Convert ILS to USD (approximate: 1 USD ≈ 3.6 ILS)
    const priceUSD = (plan.price_ils / 3.6).toFixed(0);

    // Determine period text
    let periodText = '';
    if (plan.billing_period === 'monthly') {
      periodText = language === 'ru' ? '1 месяц' : '1 Month';
    } else if (plan.billing_period === 'quarterly') {
      periodText = language === 'ru' ? '3 месяца' : '3 Months';
    } else if (plan.billing_period === 'lifetime') {
      periodText = language === 'ru' ? 'Навсегда' : 'Lifetime';
    }

    return (
      <View key={plan.id} style={styles.planCard}>
        <View style={styles.planHeader}>
          <Text style={styles.planName}>{displayName}</Text>
          <View>
            <Text style={styles.planPrice}>${priceUSD}</Text>
            <Text style={styles.planPeriod}>{periodText}</Text>
          </View>
        </View>

        <View style={styles.planFeatures}>
          {plan.features?.map((feature, index) => (
            <View key={index} style={styles.featureItem}>
              <Ionicons name="checkmark-circle-outline" size={18} color={Colors.accent.purple} />
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>

        {isCurrentPlan ? (
          <View style={styles.currentPlanBadge}>
            <Text style={styles.currentPlanText}>
              {language === 'ru' ? 'Текущий план' : 'Current Plan'}
            </Text>
          </View>
        ) : (
          <GlassButton
            title={language === 'ru' ? 'Выбрать план' : 'Select Plan'}
            onPress={() => handleSelectPlan(plan.id)}
            variant="purple"
            loading={selectedPlanId === plan.id}
            disabled={!!currentSubscription || selectedPlanId !== null}
            style={styles.selectPlanButton}
          />
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.accent.purple} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Navigation Header */}
      <View style={styles.navigationHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {language === 'ru' ? 'Подписка' : 'Subscription'}
            </Text>
            <Text style={styles.subtitle}>
              {language === 'ru'
                ? 'Все функции бесплатны.\nПодписка нужна только для создания проектов.'
                : 'All features are free.\nSubscription is only required to create projects.'}
            </Text>
          </View>

          {currentSubscription && !showPlans ? (
            renderManagementView()
          ) : (
            <View style={styles.plansSection}>
              <Text style={styles.sectionTitle}>
                {language === 'ru' ? 'Доступные планы' : 'Available Plans'}
              </Text>
              {plans.map(renderPlanCard)}
            </View>
          )}
        </View>
      </ScrollView>

      {/* AllPay Checkout WebView Modal */}
      <Modal
        visible={!!checkoutUrl}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setCheckoutUrl(null);
          setSelectedPlanId(null);
        }}
      >
        <SafeAreaView style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <Text style={styles.webViewTitle}>
              {language === 'ru' ? 'Оплата' : 'Payment'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                stopPolling();
                setCheckoutUrl(null);
                setSelectedPlanId(null);
                setCurrentOrderId(null);
              }}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={28} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          {checkoutUrl && (
            <WebView
              source={{ uri: checkoutUrl }}
              style={styles.webView}
              onNavigationStateChange={handleWebViewNavigationStateChange}
              onMessage={handleWebViewMessage}
              javaScriptEnabled={true}
              originWhitelist={['*']}
              scalesPageToFit={false}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.log('[WebView] Error loading:', nativeEvent);
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.log('[WebView] HTTP error:', nativeEvent.statusCode, nativeEvent.url);
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
