-- Migration: Add AllPay Recurring Payments Support
-- Creates tables for subscription plans, user subscriptions, payment transactions, and webhook events

-- Table 1: Subscription Plans (catalog of available plans)
CREATE TABLE IF NOT EXISTS native_subscription_plans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR(50) NOT NULL UNIQUE,           -- 'basic', 'pro', 'premium'
  display_name_en VARCHAR(100) NOT NULL,      -- 'Basic Plan'
  display_name_ru VARCHAR(100) NOT NULL,      -- 'Базовый тариф'
  price_ils DECIMAL(10,2) NOT NULL,           -- Price in Israeli Shekels
  price_currency VARCHAR(3) DEFAULT 'ILS',
  billing_period VARCHAR(20) DEFAULT 'monthly',
  features_json TEXT,                          -- JSON array of features
  max_projects INTEGER,                        -- Feature limit: max projects
  max_members_per_project INTEGER,             -- Feature limit: max members per project
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table 2: User Subscriptions (active user subscriptions)
CREATE TABLE IF NOT EXISTS native_user_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  plan_id INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'active', 'cancelled', 'expired', 'payment_failed'

  -- AllPay integration fields
  allpay_token VARCHAR(255),                      -- Tokenized payment method for recurring charges
  allpay_subscription_id VARCHAR(255),            -- AllPay subscription ID
  allpay_customer_id VARCHAR(255),                -- AllPay customer identifier

  -- Billing cycle
  current_period_start DATETIME,
  current_period_end DATETIME,
  next_billing_date DATETIME,

  -- Subscription lifecycle
  started_at DATETIME,
  cancelled_at DATETIME,
  cancellation_reason TEXT,
  trial_ends_at DATETIME,                         -- For future free trials

  -- Metadata
  metadata_json TEXT,                             -- Additional data from AllPay
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  FOREIGN KEY (plan_id) REFERENCES native_subscription_plans(id),

  CHECK (status IN ('pending', 'active', 'cancelled', 'expired', 'payment_failed'))
);

-- Table 3: Payment Transactions (payment history and audit trail)
CREATE TABLE IF NOT EXISTS native_payment_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  subscription_id INTEGER,

  -- AllPay transaction details
  allpay_order_id VARCHAR(255) UNIQUE NOT NULL,
  allpay_transaction_id VARCHAR(255),
  allpay_payment_status INTEGER,                  -- 0=unpaid, 1=paid, 3=refunded, 4=partially_refunded

  -- Payment details
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'ILS',
  payment_method VARCHAR(50),                     -- 'credit_card', 'google_pay', etc.

  -- Transaction type
  transaction_type VARCHAR(20) NOT NULL,          -- 'initial', 'recurring', 'refund'

  -- Status tracking
  status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- 'pending', 'completed', 'failed', 'refunded'
  error_message TEXT,

  -- Timestamps
  attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,

  -- Metadata
  allpay_response_json TEXT,                      -- Full AllPay callback data

  FOREIGN KEY (user_id) REFERENCES native_users(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES native_user_subscriptions(id) ON DELETE SET NULL,

  CHECK (transaction_type IN ('initial', 'recurring', 'refund')),
  CHECK (status IN ('pending', 'completed', 'failed', 'refunded'))
);

-- Table 4: AllPay Webhook Events (audit log for all webhook callbacks)
CREATE TABLE IF NOT EXISTS native_allpay_webhook_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type VARCHAR(100) NOT NULL,               -- 'payment_success', 'payment_failed', 'subscription_cancelled'
  allpay_order_id VARCHAR(255),

  -- Webhook verification
  signature VARCHAR(255),
  is_verified BOOLEAN DEFAULT 0,

  -- Processing status
  processing_status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'processed', 'failed'
  processing_error TEXT,
  processed_at DATETIME,

  -- Raw payload
  payload_json TEXT NOT NULL,

  -- Idempotency (prevent duplicate processing)
  idempotency_key VARCHAR(255) UNIQUE,            -- Hash of order_id + timestamp

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  CHECK (processing_status IN ('pending', 'processed', 'failed'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON native_user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON native_user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_next_billing ON native_user_subscriptions(next_billing_date);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_allpay_token ON native_user_subscriptions(allpay_token);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_user_id ON native_payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_subscription_id ON native_payment_transactions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_id ON native_payment_transactions(allpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON native_payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_attempted_at ON native_payment_transactions(attempted_at);

CREATE INDEX IF NOT EXISTS idx_webhook_events_order_id ON native_allpay_webhook_events(allpay_order_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON native_allpay_webhook_events(processing_status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON native_allpay_webhook_events(created_at);

-- Seed Data: Insert subscription plans
-- All features are free except project creation
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
)
VALUES
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
SELECT 'AllPay subscription tables created successfully!' as message;
