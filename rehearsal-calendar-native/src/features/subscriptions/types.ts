export interface SubscriptionPlan {
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

export interface UserSubscription {
  id: number;
  plan_id: number;
  plan_name: string;
  display_name_en: string;
  display_name_ru: string;
  status: string;
  current_period_end: string;
  next_billing_date: string;
}

export interface PaymentTransaction {
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
