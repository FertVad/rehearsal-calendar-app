-- Migration: Update Subscription Plans
-- Changes pricing model to:
-- - Monthly: $9
-- - 3 Months: $15
-- - Lifetime: $49
-- All features available for free except project creation

-- Delete old plans
DELETE FROM native_subscription_plans;

-- Insert new subscription plans
INSERT INTO native_subscription_plans (
  name,
  display_name_en,
  display_name_ru,
  price_ils,
  price_currency,
  billing_period,
  max_projects,
  max_members_per_project,
  features_json
) VALUES
  (
    'monthly',
    'Monthly',
    'Месяц',
    32.00,  -- ~$9 USD in ILS (1 USD ≈ 3.6 ILS)
    'ILS',
    'monthly',
    999,
    999,
    '["Create unlimited projects", "Unlimited members per project", "Full access to all features"]'
  ),
  (
    'quarterly',
    '3 Months',
    '3 месяца',
    54.00,  -- ~$15 USD in ILS
    'ILS',
    'quarterly',
    999,
    999,
    '["Create unlimited projects", "Unlimited members per project", "Full access to all features", "Save 40% vs monthly"]'
  ),
  (
    'lifetime',
    'Lifetime',
    'Навсегда',
    176.00,  -- ~$49 USD in ILS
    'ILS',
    'lifetime',
    999,
    999,
    '["Create unlimited projects", "Unlimited members per project", "Full access to all features", "One-time payment", "Lifetime access"]'
  );

-- Success message
SELECT 'Subscription plans updated successfully!' as message;
