-- Migration: Add Test Plan with 1-minute billing for testing recurring billing
-- This plan is for testing purposes only

INSERT INTO native_subscription_plans (
  name,
  display_name_en,
  display_name_ru,
  price_ils,
  price_usd,
  price_currency,
  billing_period,
  max_projects,
  max_members_per_project,
  features_json,
  is_active
) VALUES (
  'test_1min',
  'Test (1 min)',
  'Тест (1 мин)',
  0.04,  -- ~$0.01 USD
  0.01,  -- $0.01 USD
  'ILS',
  'test_1min',  -- Custom billing period for testing
  999,
  999,
  '["TEST ONLY: Recurring billing every 1 minute", "Create unlimited projects", "Full access to all features"]',
  TRUE  -- Active (visible in UI)
);

SELECT 'Test plan with 1-minute billing added successfully!' as message;
