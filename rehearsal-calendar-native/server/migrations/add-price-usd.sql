-- Migration: Add USD pricing to subscription plans
-- Adds price_usd column and updates existing plans with USD prices

-- Add price_usd column
ALTER TABLE native_subscription_plans ADD COLUMN price_usd DECIMAL(10,2);

-- Update existing plans with USD prices
UPDATE native_subscription_plans
SET price_usd = CASE
  WHEN name = 'monthly' THEN 9.00
  WHEN name = 'quarterly' THEN 15.00
  WHEN name = 'lifetime' THEN 49.00
  ELSE price_ils / 3.6  -- Fallback: convert ILS to USD using rough rate
END;

-- Success message
SELECT 'Added price_usd column successfully!' as message;
