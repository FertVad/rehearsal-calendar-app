-- Migration: Add price_usd column to native_subscription_plans
-- This allows us to bill in USD and let AllPay handle conversion

-- Add price_usd column if it doesn't exist
ALTER TABLE native_subscription_plans
ADD COLUMN IF NOT EXISTS price_usd DECIMAL(10,2);

-- Update existing plans with USD prices (approximate conversion from ILS at 3.6 rate)
-- Monthly: 32 ILS ≈ $9 USD
-- Quarterly: 54 ILS ≈ $15 USD
-- Lifetime: 176 ILS ≈ $49 USD
-- test_1min: 46.80 ILS ≈ $13 USD (for testing)

UPDATE native_subscription_plans SET price_usd = 9.00 WHERE name = 'monthly';
UPDATE native_subscription_plans SET price_usd = 15.00 WHERE name = 'quarterly';
UPDATE native_subscription_plans SET price_usd = 49.00 WHERE name = 'lifetime';
UPDATE native_subscription_plans SET price_usd = 13.00 WHERE name = 'test_1min';

-- Set default currency to USD (more stable than ILS)
UPDATE native_subscription_plans SET price_currency = 'USD';

SELECT 'price_usd column added and plans updated!' as message;
