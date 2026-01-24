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

export default function SubscriptionScreen({ navigation }: SubscriptionScreenProps) {
  const { t, language } = useI18n();
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<UserSubscription | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansResponse, subscriptionResponse] = await Promise.all([
        subscriptionsAPI.getPlans(),
        subscriptionsAPI.getCurrentSubscription(),
      ]);

      setPlans(plansResponse.data.plans || []);
      setCurrentSubscription(subscriptionResponse.data.subscription);
    } catch (error: any) {
      console.error('Failed to load subscription data:', error);
      Alert.alert(t.common.error, error.response?.data?.error || 'Failed to load subscription data');
    } finally {
      setLoading(false);
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
      const response = await subscriptionsAPI.createCheckout(planId);
      setCheckoutUrl(response.data.checkoutUrl);
    } catch (error: any) {
      console.error('Failed to create checkout:', error);
      Alert.alert(t.common.error, error.response?.data?.error || 'Failed to create checkout');
      setSelectedPlanId(null);
    }
  };

  const handleWebViewNavigationStateChange = (navState: any) => {
    const { url } = navState;

    // Handle success redirect
    if (url.includes('/subscription/success')) {
      setCheckoutUrl(null);
      setSelectedPlanId(null);
      Alert.alert(
        language === 'ru' ? 'Успех!' : 'Success!',
        language === 'ru'
          ? 'Подписка успешно оформлена! Теперь вы можете создавать проекты.'
          : 'Subscription created successfully! You can now create projects.',
        [{ text: 'OK', onPress: () => loadData() }]
      );
    }

    // Handle cancel redirect
    if (url.includes('/subscription/cancel')) {
      setCheckoutUrl(null);
      setSelectedPlanId(null);
    }
  };

  const handleCancelSubscription = () => {
    // Check if it's a lifetime subscription
    const isLifetime = currentSubscription?.next_billing_date === null;

    Alert.alert(
      language === 'ru' ? 'Отменить подписку?' : 'Cancel Subscription?',
      language === 'ru'
        ? (isLifetime
            ? 'Вы уверены, что хотите отменить подписку? Вы больше не сможете создавать новые проекты.'
            : 'Вы уверены, что хотите отменить подписку? Вы потеряете возможность создавать проекты в конце текущего периода.')
        : (isLifetime
            ? 'Are you sure you want to cancel your subscription? You will no longer be able to create new projects.'
            : 'Are you sure you want to cancel your subscription? You will lose the ability to create projects at the end of the current period.'),
      [
        { text: language === 'ru' ? 'Назад' : 'Back', style: 'cancel' },
        {
          text: language === 'ru' ? 'Отменить подписку' : 'Cancel Subscription',
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
        language === 'ru' ? 'Подписка отменена' : 'Subscription Cancelled',
        language === 'ru'
          ? 'Ваша подписка была успешно отменена.'
          : 'Your subscription has been cancelled successfully.'
      );
      loadData();
    } catch (error: any) {
      console.error('Failed to cancel subscription:', error);
      Alert.alert(t.common.error, error.response?.data?.error || 'Failed to cancel subscription');
    } finally {
      setCancelLoading(false);
    }
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

          {currentSubscription && (
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
                    ? (language === 'ru' ? 'Активна' : 'Active')
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
                title={language === 'ru' ? 'Отменить подписку' : 'Cancel Subscription'}
                onPress={handleCancelSubscription}
                variant="glass"
                loading={cancelLoading}
                style={styles.cancelButton}
              />
            </View>
          )}

          <View style={styles.plansSection}>
            <Text style={styles.sectionTitle}>
              {language === 'ru' ? 'Доступные планы' : 'Available Plans'}
            </Text>
            {plans.map(renderPlanCard)}
          </View>
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
                setCheckoutUrl(null);
                setSelectedPlanId(null);
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
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webViewLoading}>
                  <ActivityIndicator size="large" color={Colors.accent.purple} />
                </View>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
