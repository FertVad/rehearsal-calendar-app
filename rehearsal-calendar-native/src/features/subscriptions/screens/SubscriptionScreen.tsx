import { logger } from '../../../shared/utils/logger';
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
import { subscriptionsAPI } from '../../../shared/services/api';
import { useI18n } from '../../../contexts/I18nContext';
import { ProfileStackParamList } from '../../../navigation';
import { styles } from '../styles/subscriptionScreenStyles';
import { Colors } from '../../../shared/constants/colors';
import { PlanCard } from '../components/PlanCard';
import { SubscriptionManagement } from '../components/SubscriptionManagement';
import type { SubscriptionPlan, UserSubscription, PaymentTransaction } from '../types';

type SubscriptionScreenProps = NativeStackScreenProps<ProfileStackParamList, 'Subscription'>;

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
    } finally {
      setLoadingHistory(false);
    }
  };

  const startPolling = (orderId: string) => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        const response = await subscriptionsAPI.checkPendingOrder(orderId);
        const { subscriptionCreated } = response.data;

        if (subscriptionCreated) {
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
      }
    }, 2000);
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  const showSuccessAlert = () => {
    Alert.alert(
      language === 'ru' ? 'Успех!' : 'Success!',
      language === 'ru'
        ? 'Подписка успешно оформлена! Теперь вы можете создавать проекты.'
        : 'Subscription created successfully! You can now create projects.',
      [{ text: 'OK', onPress: () => loadData() }]
    );
  };

  const verifySubscription = async (orderId: string) => {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const response = await subscriptionsAPI.checkPendingOrder(orderId);
      if (!response.data.subscriptionCreated) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        await subscriptionsAPI.checkPendingOrder(orderId);
      }
    } catch (e) {
      console.error('Error verifying subscription:', e);
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

      logger.debug('[DEBUG] Checkout created:', { checkoutUrl: url, orderId });

      setCheckoutUrl(url);
      setCurrentOrderId(orderId);
      startPolling(orderId);
    } catch (error: any) {
      console.error('Failed to create checkout:', error);
      Alert.alert(t.common.error, error.response?.data?.error || 'Failed to create checkout');
      setSelectedPlanId(null);
    }
  };

  const handleWebViewMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      logger.debug('[WebView] Received message:', data);

      if (data.type === 'payment_success') {
        stopPolling();
        setCheckoutUrl(null);
        setSelectedPlanId(null);
        setShowPlans(false);

        const orderId = data.orderId || currentOrderId;
        setCurrentOrderId(null);

        if (orderId) {
          await verifySubscription(orderId);
        }

        showSuccessAlert();
      } else if (data.type === 'payment_error') {
        console.error('[HostedFields] Payment error:', data.error, data.message);
      }
    } catch (e) {
      // Not a JSON message, ignore
    }
  };

  const handleWebViewNavigationStateChange = async (navState: any) => {
    const { url } = navState;

    if (url.includes('rehearsalapp://subscription/success')) {
      stopPolling();
      setCheckoutUrl(null);
      setSelectedPlanId(null);
      setShowPlans(false);

      const orderId = currentOrderId;
      setCurrentOrderId(null);

      if (orderId) {
        await verifySubscription(orderId);
      }

      showSuccessAlert();
    }

    if (url.includes('rehearsalapp://subscription/cancel')) {
      stopPolling();
      setCheckoutUrl(null);
      setSelectedPlanId(null);
      setCurrentOrderId(null);
    }
  };

  const handleCancelSubscription = () => {
    const isLifetime = currentSubscription?.next_billing_date === null;

    Alert.alert(
      t.subscriptions.cancelTitle,
      isLifetime ? t.subscriptions.cancelWarningLifetime : t.subscriptions.cancelWarning,
      [
        { text: language === 'ru' ? 'Назад' : 'Back', style: 'cancel' },
        {
          text: t.subscriptions.cancelConfirm,
          style: 'destructive',
          onPress: async () => {
            try {
              setCancelLoading(true);
              await subscriptionsAPI.cancelSubscription('User requested cancellation');
              Alert.alert(t.subscriptions.cancelSuccess, t.subscriptions.cancelSuccessMessage);
              setShowPlans(false);
              loadData();
            } catch (error: any) {
              console.error('Failed to cancel subscription:', error);
              Alert.alert(t.common.error, error.response?.data?.error || t.subscriptions.cancelError);
            } finally {
              setCancelLoading(false);
            }
          },
        },
      ]
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
            <SubscriptionManagement
              subscription={currentSubscription}
              paymentHistory={paymentHistory}
              loadingHistory={loadingHistory}
              cancelLoading={cancelLoading}
              language={language}
              t={t}
              onCancel={handleCancelSubscription}
              onViewPlans={() => setShowPlans(true)}
            />
          ) : (
            <View style={styles.plansSection}>
              <Text style={styles.sectionTitle}>
                {language === 'ru' ? 'Доступные планы' : 'Available Plans'}
              </Text>
              {plans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  language={language}
                  currentSubscription={currentSubscription}
                  selectedPlanId={selectedPlanId}
                  onSelectPlan={handleSelectPlan}
                />
              ))}
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
                logger.debug('[WebView] Error loading:', nativeEvent);
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                logger.debug('[WebView] HTTP error:', nativeEvent.statusCode, nativeEvent.url);
              }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
