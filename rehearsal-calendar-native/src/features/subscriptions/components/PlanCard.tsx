import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlassButton } from '../../../shared/components';
import { Colors } from '../../../shared/constants/colors';
import { styles } from '../styles/subscriptionScreenStyles';
import type { SubscriptionPlan, UserSubscription } from '../types';

interface PlanCardProps {
  plan: SubscriptionPlan;
  language: string;
  currentSubscription: UserSubscription | null;
  selectedPlanId: number | null;
  onSelectPlan: (planId: number) => void;
}

export function PlanCard({ plan, language, currentSubscription, selectedPlanId, onSelectPlan }: PlanCardProps) {
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
    <View style={styles.planCard}>
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
          onPress={() => onSelectPlan(plan.id)}
          variant="purple"
          loading={selectedPlanId === plan.id}
          disabled={!!currentSubscription || selectedPlanId !== null}
          style={styles.selectPlanButton}
        />
      )}
    </View>
  );
}
