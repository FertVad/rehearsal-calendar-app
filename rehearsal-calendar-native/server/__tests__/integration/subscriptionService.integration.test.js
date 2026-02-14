/**
 * Subscription Service Integration Tests
 *
 * Uses real in-memory SQLite database with mocked AllPay API and notifications.
 * Tests all 7 exported functions of subscriptionService.js:
 * - getSubscriptionPlans, getUserActiveSubscription, createSubscription,
 *   cancelSubscription, processRecurringBilling, getPaymentHistory, processWebhookEvent
 */
import { jest } from '@jest/globals';
import {
  setupIntegrationDb,
  closeIntegrationDb,
  seedTestData,
  seedSubscriptionPlans,
} from './setup.js';

let testDb;
let testData;

// ─── Mocks ───────────────────────────────────────────────────

const mockDbRun = jest.fn();
const mockDbGet = jest.fn();
const mockDbAll = jest.fn();

jest.unstable_mockModule('../../database/db.js', () => ({
  default: { run: mockDbRun, get: mockDbGet, all: mockDbAll },
  isPostgres: false,
}));

const mockChargeToken = jest.fn();

jest.unstable_mockModule('../../utils/allpayClient.js', () => ({
  allpayAPI: { chargeToken: mockChargeToken },
  verifyWebhookSignature: jest.fn(),
  generateAllPaySignature: jest.fn(),
}));

const mockNotifyPaymentFailed = jest.fn();

jest.unstable_mockModule('../../services/notifications/pushNotificationService.js', () => ({
  notifyPaymentFailed: mockNotifyPaymentFailed,
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// ─── Dynamic imports (after mocks) ──────────────────────────

const {
  getUserActiveSubscription,
  getSubscriptionPlans,
  createSubscription,
  cancelSubscription,
  processRecurringBilling,
  getPaymentHistory,
  processWebhookEvent,
} = await import('../../services/subscriptionService.js');

const { verifyWebhookSignature } = await import('../../utils/allpayClient.js');

// ─── Setup ───────────────────────────────────────────────────

function wireDb() {
  mockDbRun.mockImplementation((sql, params) => testDb.run(sql, params));
  mockDbGet.mockImplementation((sql, params) => testDb.get(sql, params));
  mockDbAll.mockImplementation((sql, params) => testDb.all(sql, params));
}

function clearSubscriptionData() {
  testDb.run('DELETE FROM native_allpay_webhook_events', []);
  testDb.run('DELETE FROM native_payment_transactions', []);
  testDb.run('DELETE FROM native_user_subscriptions', []);
}

beforeAll(async () => {
  testDb = await setupIntegrationDb();
  wireDb();
  seedSubscriptionPlans(testDb);
  testData = await seedTestData(testDb);
});

afterAll(() => {
  closeIntegrationDb();
});

// ─── Tests ───────────────────────────────────────────────────

describe('getSubscriptionPlans', () => {
  it('should return only active plans', async () => {
    const plans = await getSubscriptionPlans();
    expect(plans.length).toBe(4); // monthly, quarterly, lifetime, test_1min
    expect(plans.find(p => p.name === 'deprecated')).toBeUndefined();
  });

  it('should parse features_json into features array', async () => {
    const plans = await getSubscriptionPlans();
    const monthly = plans.find(p => p.name === 'monthly');
    expect(Array.isArray(monthly.features)).toBe(true);
    expect(monthly.features_json).toBeUndefined();
  });

  it('should order plans by price_ils ascending', async () => {
    const plans = await getSubscriptionPlans();
    for (let i = 1; i < plans.length; i++) {
      expect(plans[i].price_ils).toBeGreaterThanOrEqual(plans[i - 1].price_ils);
    }
  });
});

describe('getUserActiveSubscription', () => {
  beforeEach(() => clearSubscriptionData());

  it('should return null when user has no subscriptions', async () => {
    const result = await getUserActiveSubscription(testData.adminId);
    expect(result).toBeNull();
  });

  it('should return active subscription with plan details', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);
    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString();

    testDb.run(
      `INSERT INTO native_user_subscriptions
       (user_id, plan_id, status, current_period_start, current_period_end, started_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testData.adminId, plan.id, 'active', new Date().toISOString(), futureDate, new Date().toISOString()]
    );

    const sub = await getUserActiveSubscription(testData.adminId);
    expect(sub).not.toBeNull();
    expect(sub.status).toBe('active');
    expect(sub.plan_name).toBe('monthly');
    expect(sub.price_usd).toBe(9);
  });

  it('should return cancelled subscription if period has not ended', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);
    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString();

    testDb.run(
      `INSERT INTO native_user_subscriptions
       (user_id, plan_id, status, current_period_end, started_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [testData.adminId, plan.id, 'cancelled', futureDate, new Date().toISOString()]
    );

    const sub = await getUserActiveSubscription(testData.adminId);
    expect(sub).not.toBeNull();
    expect(sub.status).toBe('cancelled');
  });

  it('should return null for cancelled subscription with expired period', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);
    const pastDate = new Date(Date.now() - 86400000).toISOString();

    testDb.run(
      `INSERT INTO native_user_subscriptions
       (user_id, plan_id, status, current_period_end, started_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [testData.adminId, plan.id, 'cancelled', pastDate, new Date().toISOString()]
    );

    const sub = await getUserActiveSubscription(testData.adminId);
    expect(sub).toBeNull();
  });

  it('should NOT return expired or payment_failed subscriptions', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);

    testDb.run(
      `INSERT INTO native_user_subscriptions (user_id, plan_id, status, started_at) VALUES ($1, $2, $3, $4)`,
      [testData.adminId, plan.id, 'expired', new Date().toISOString()]
    );

    expect(await getUserActiveSubscription(testData.adminId)).toBeNull();
  });

  it('should parse metadata_json', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);
    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString();

    testDb.run(
      `INSERT INTO native_user_subscriptions
       (user_id, plan_id, status, current_period_end, started_at, metadata_json)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testData.adminId, plan.id, 'active', futureDate, new Date().toISOString(), '{"source":"web"}']
    );

    const sub = await getUserActiveSubscription(testData.adminId);
    expect(sub.metadata).toEqual({ source: 'web' });
    expect(sub.metadata_json).toBeUndefined();
  });
});

describe('createSubscription', () => {
  beforeEach(() => clearSubscriptionData());

  it('should create monthly subscription with ~30-day billing period', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);

    const result = await createSubscription({
      userId: testData.adminId,
      planId: plan.id,
      allpayToken: 'tok_monthly',
    });

    expect(result.id).toBeDefined();
    expect(result.status).toBe('active');
    expect(result.nextBillingDate).not.toBeNull();

    const diffDays = (result.currentPeriodEnd - result.currentPeriodStart) / 86400000;
    expect(diffDays).toBeGreaterThanOrEqual(28);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  it('should create quarterly subscription with ~90-day billing period', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'quarterly'", []);

    const result = await createSubscription({
      userId: testData.adminId,
      planId: plan.id,
      allpayToken: 'tok_quarterly',
    });

    const diffDays = (result.currentPeriodEnd - result.currentPeriodStart) / 86400000;
    expect(diffDays).toBeGreaterThanOrEqual(89);
    expect(diffDays).toBeLessThanOrEqual(92);
  });

  it('should create lifetime subscription with null nextBillingDate', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'lifetime'", []);

    const result = await createSubscription({
      userId: testData.adminId,
      planId: plan.id,
      allpayToken: 'tok_lifetime',
    });

    expect(result.nextBillingDate).toBeNull();
    const yearsDiff = (result.currentPeriodEnd - result.currentPeriodStart) / (365.25 * 86400000);
    expect(yearsDiff).toBeGreaterThanOrEqual(99);
  });

  it('should create test_1min subscription with ~1-minute billing cycle', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'test_1min'", []);

    const result = await createSubscription({
      userId: testData.adminId,
      planId: plan.id,
      allpayToken: 'tok_test',
    });

    const diffMs = result.currentPeriodEnd - result.currentPeriodStart;
    expect(diffMs).toBeGreaterThanOrEqual(55000);
    expect(diffMs).toBeLessThanOrEqual(65000);
  });

  it('should throw if user already has active subscription', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);

    await createSubscription({ userId: testData.adminId, planId: plan.id, allpayToken: 'tok_1' });

    await expect(
      createSubscription({ userId: testData.adminId, planId: plan.id, allpayToken: 'tok_2' })
    ).rejects.toThrow('User already has an active subscription');
  });

  it('should throw for invalid plan ID', async () => {
    await expect(
      createSubscription({ userId: testData.adminId, planId: 999999, allpayToken: 'tok_x' })
    ).rejects.toThrow('Subscription plan not found');
  });

  it('should update existing pending transaction when allpayOrderId provided', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);

    testDb.run(
      `INSERT INTO native_payment_transactions
       (user_id, allpay_order_id, amount, currency, transaction_type, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testData.adminId, 'ORDER-LINK-1', 9.0, 'USD', 'initial', 'pending']
    );

    const result = await createSubscription({
      userId: testData.adminId,
      planId: plan.id,
      allpayToken: 'tok_linked',
      allpayOrderId: 'ORDER-LINK-1',
    });

    const txns = testDb.all(
      "SELECT * FROM native_payment_transactions WHERE allpay_order_id = 'ORDER-LINK-1'", []
    );
    expect(txns).toHaveLength(1);
    expect(txns[0].status).toBe('completed');
    expect(txns[0].subscription_id).toBe(result.id);
  });
});

describe('cancelSubscription', () => {
  beforeEach(() => clearSubscriptionData());

  it('should cancel an active subscription', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);
    await createSubscription({ userId: testData.adminId, planId: plan.id, allpayToken: 'tok_c1' });

    const result = await cancelSubscription(testData.adminId, 'Too expensive');

    expect(result.status).toBe('cancelled');
    expect(result.reason).toBe('Too expensive');
    expect(result.accessUntil).toBeDefined();
    expect(result.message).toContain('Access will continue');

    const sub = testDb.get('SELECT * FROM native_user_subscriptions WHERE id = $1', [result.id]);
    expect(sub.status).toBe('cancelled');
    expect(sub.cancellation_reason).toBe('Too expensive');
  });

  it('should throw if no active subscription found', async () => {
    await expect(cancelSubscription(testData.adminId)).rejects.toThrow(
      'No active subscription found'
    );
  });

  it('should use default reason if none provided', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);
    await createSubscription({ userId: testData.adminId, planId: plan.id, allpayToken: 'tok_c2' });

    const result = await cancelSubscription(testData.adminId);
    expect(result.reason).toBe('User requested cancellation');
  });
});

describe('processRecurringBilling', () => {
  beforeEach(() => {
    clearSubscriptionData();
    mockChargeToken.mockReset();
    mockNotifyPaymentFailed.mockReset();
  });

  it('should return zero results when no subscriptions are due', async () => {
    const results = await processRecurringBilling();
    expect(results.processed).toBe(0);
    expect(results.successful).toBe(0);
    expect(results.failed).toBe(0);
    expect(results.expired).toBe(0);
  });

  it('should expire cancelled subscriptions past their period end', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);
    const pastDate = new Date(Date.now() - 86400000).toISOString();

    testDb.run(
      `INSERT INTO native_user_subscriptions
       (user_id, plan_id, status, current_period_end, started_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [testData.adminId, plan.id, 'cancelled', pastDate, pastDate]
    );

    const results = await processRecurringBilling();
    expect(results.expired).toBe(1);

    const sub = testDb.get('SELECT * FROM native_user_subscriptions WHERE user_id = $1', [testData.adminId]);
    expect(sub.status).toBe('expired');
  });

  it('should charge due subscriptions and update billing dates', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);
    const pastDate = new Date(Date.now() - 60000).toISOString();

    testDb.run(
      `INSERT INTO native_user_subscriptions
       (user_id, plan_id, status, allpay_token, current_period_start, current_period_end, next_billing_date, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [testData.adminId, plan.id, 'active', 'tok_recur', pastDate, pastDate, pastDate, pastDate]
    );

    mockChargeToken.mockResolvedValue({
      status: 1,
      allpay_payment_status: 1,
      transaction_id: 'txn_recur_1',
    });

    const results = await processRecurringBilling();
    expect(results.processed).toBe(1);
    expect(results.successful).toBe(1);
    expect(results.failed).toBe(0);
    expect(mockChargeToken).toHaveBeenCalledTimes(1);

    // Verify transaction recorded
    const txns = testDb.all(
      'SELECT * FROM native_payment_transactions WHERE user_id = $1', [testData.adminId]
    );
    expect(txns.length).toBe(1);
    expect(txns[0].transaction_type).toBe('recurring');
    expect(txns[0].status).toBe('completed');

    // Verify billing dates updated (next_billing_date should be in the future)
    const sub = testDb.get('SELECT * FROM native_user_subscriptions WHERE user_id = $1', [testData.adminId]);
    expect(new Date(sub.next_billing_date).getTime()).toBeGreaterThan(Date.now() - 5000);
  });

  it('should skip lifetime subscriptions (next_billing_date IS NULL)', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'lifetime'", []);

    testDb.run(
      `INSERT INTO native_user_subscriptions
       (user_id, plan_id, status, allpay_token, next_billing_date, started_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testData.adminId, plan.id, 'active', 'tok_life', null, new Date().toISOString()]
    );

    const results = await processRecurringBilling();
    expect(results.processed).toBe(0);
    expect(mockChargeToken).not.toHaveBeenCalled();
  });

  it('should not charge cancelled subscriptions', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);
    const pastDate = new Date(Date.now() - 60000).toISOString();
    const futureDate = new Date(Date.now() + 30 * 86400000).toISOString();

    testDb.run(
      `INSERT INTO native_user_subscriptions
       (user_id, plan_id, status, allpay_token, current_period_end, next_billing_date, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [testData.adminId, plan.id, 'cancelled', 'tok_canc', futureDate, pastDate, pastDate]
    );

    const results = await processRecurringBilling();
    expect(results.processed).toBe(0);
    expect(mockChargeToken).not.toHaveBeenCalled();
  });

  it('should handle charge failure — set status to payment_failed and notify', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);
    const pastDate = new Date(Date.now() - 60000).toISOString();

    testDb.run(
      `INSERT INTO native_user_subscriptions
       (user_id, plan_id, status, allpay_token, next_billing_date, current_period_start, current_period_end, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [testData.adminId, plan.id, 'active', 'tok_fail', pastDate, pastDate, pastDate, pastDate]
    );

    mockChargeToken.mockRejectedValue(new Error('Card declined'));
    mockNotifyPaymentFailed.mockResolvedValue(undefined);

    const results = await processRecurringBilling();
    expect(results.processed).toBe(1);
    expect(results.failed).toBe(1);
    expect(results.errors[0].error).toBe('Card declined');

    const sub = testDb.get('SELECT * FROM native_user_subscriptions WHERE user_id = $1', [testData.adminId]);
    expect(sub.status).toBe('payment_failed');

    const txns = testDb.all('SELECT * FROM native_payment_transactions WHERE user_id = $1', [testData.adminId]);
    expect(txns.length).toBe(1);
    expect(txns[0].status).toBe('failed');
    expect(txns[0].error_message).toBe('Card declined');

    expect(mockNotifyPaymentFailed).toHaveBeenCalledWith(testData.adminId, 'Card declined');
  });

  it('should handle non-success charge status (status !== 1)', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);
    const pastDate = new Date(Date.now() - 60000).toISOString();

    testDb.run(
      `INSERT INTO native_user_subscriptions
       (user_id, plan_id, status, allpay_token, next_billing_date, current_period_start, current_period_end, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [testData.adminId, plan.id, 'active', 'tok_bad', pastDate, pastDate, pastDate, pastDate]
    );

    mockChargeToken.mockResolvedValue({ status: 0 });
    mockNotifyPaymentFailed.mockResolvedValue(undefined);

    const results = await processRecurringBilling();
    expect(results.failed).toBe(1);

    const sub = testDb.get('SELECT * FROM native_user_subscriptions WHERE user_id = $1', [testData.adminId]);
    expect(sub.status).toBe('payment_failed');
  });

  it('should not crash if notification delivery fails', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);
    const pastDate = new Date(Date.now() - 60000).toISOString();

    testDb.run(
      `INSERT INTO native_user_subscriptions
       (user_id, plan_id, status, allpay_token, next_billing_date, current_period_start, current_period_end, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [testData.adminId, plan.id, 'active', 'tok_nf', pastDate, pastDate, pastDate, pastDate]
    );

    mockChargeToken.mockRejectedValue(new Error('Card expired'));
    mockNotifyPaymentFailed.mockRejectedValue(new Error('Push token invalid'));

    const results = await processRecurringBilling();
    expect(results.failed).toBe(1);
    // Should NOT throw — notification failure is caught
  });
});

describe('getPaymentHistory', () => {
  beforeEach(() => clearSubscriptionData());

  it('should return empty array for user with no payments', async () => {
    const history = await getPaymentHistory(testData.adminId);
    expect(history).toEqual([]);
  });

  it('should return transactions with plan info and parsed JSON', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);
    const sub = testDb.run(
      `INSERT INTO native_user_subscriptions (user_id, plan_id, status, started_at) VALUES ($1, $2, $3, $4)`,
      [testData.adminId, plan.id, 'active', new Date().toISOString()]
    );

    testDb.run(
      `INSERT INTO native_payment_transactions
       (user_id, subscription_id, allpay_order_id, amount, currency, transaction_type, status, attempted_at, allpay_response_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [testData.adminId, sub.lastInsertId, 'ORD-H1', 9.0, 'USD', 'initial', 'completed', new Date().toISOString(), '{"test":true}']
    );

    const history = await getPaymentHistory(testData.adminId);
    expect(history.length).toBe(1);
    expect(history[0].plan_name).toBe('monthly');
    expect(history[0].allpay_response).toEqual({ test: true });
    expect(history[0].allpay_response_json).toBeUndefined();
  });

  it('should respect the limit parameter', async () => {
    const plan = testDb.get("SELECT * FROM native_subscription_plans WHERE name = 'monthly'", []);
    const sub = testDb.run(
      `INSERT INTO native_user_subscriptions (user_id, plan_id, status, started_at) VALUES ($1, $2, $3, $4)`,
      [testData.adminId, plan.id, 'active', new Date().toISOString()]
    );

    for (let i = 0; i < 5; i++) {
      testDb.run(
        `INSERT INTO native_payment_transactions
         (user_id, subscription_id, allpay_order_id, amount, currency, transaction_type, status, attempted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [testData.adminId, sub.lastInsertId, `ORD-L${i}`, 9.0, 'USD', 'recurring', 'completed', new Date().toISOString()]
      );
    }

    const history = await getPaymentHistory(testData.adminId, 3);
    expect(history.length).toBe(3);
  });
});

describe('processWebhookEvent', () => {
  beforeEach(() => {
    clearSubscriptionData();
    verifyWebhookSignature.mockReset();
  });

  it('should reject invalid signature', async () => {
    verifyWebhookSignature.mockReturnValue(false);

    await expect(
      processWebhookEvent({ order_id: 'ORD-1', status: '1' }, 'bad-sig')
    ).rejects.toThrow('Invalid webhook signature');
  });

  it('should process successful payment event and update transaction', async () => {
    verifyWebhookSignature.mockReturnValue(true);

    testDb.run(
      `INSERT INTO native_payment_transactions
       (user_id, allpay_order_id, amount, currency, transaction_type, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testData.adminId, 'ORD-WH-1', 9.0, 'USD', 'initial', 'pending']
    );

    const result = await processWebhookEvent(
      { order_id: 'ORD-WH-1', status: '1', transaction_id: 'txn_wh1' },
      'valid-sig'
    );

    expect(result.success).toBe(true);
    expect(result.eventType).toBe('payment_success');

    const txn = testDb.get("SELECT * FROM native_payment_transactions WHERE allpay_order_id = 'ORD-WH-1'", []);
    expect(txn.status).toBe('completed');
    expect(txn.allpay_transaction_id).toBe('txn_wh1');

    const evt = testDb.get("SELECT * FROM native_allpay_webhook_events WHERE allpay_order_id = 'ORD-WH-1'", []);
    expect(evt.event_type).toBe('payment_success');
    expect(evt.processing_status).toBe('processed');
  });

  it('should normalize status string "1" to number (AllPay quirk)', async () => {
    verifyWebhookSignature.mockReturnValue(true);

    testDb.run(
      `INSERT INTO native_payment_transactions
       (user_id, allpay_order_id, amount, currency, transaction_type, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testData.adminId, 'ORD-NORM', 9.0, 'USD', 'initial', 'pending']
    );

    const result = await processWebhookEvent(
      { order_id: 'ORD-NORM', status: '1' }, 'sig'
    );
    expect(result.eventType).toBe('payment_success');
  });

  it('should handle payment_failed event', async () => {
    verifyWebhookSignature.mockReturnValue(true);

    testDb.run(
      `INSERT INTO native_payment_transactions
       (user_id, allpay_order_id, amount, currency, transaction_type, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testData.adminId, 'ORD-FAIL-WH', 9.0, 'USD', 'initial', 'pending']
    );

    const result = await processWebhookEvent(
      { order_id: 'ORD-FAIL-WH', status: '0', error_message: 'Insufficient funds' },
      'sig'
    );

    expect(result.eventType).toBe('payment_failed');

    const txn = testDb.get("SELECT * FROM native_payment_transactions WHERE allpay_order_id = 'ORD-FAIL-WH'", []);
    expect(txn.status).toBe('failed');
    expect(txn.error_message).toBe('Insufficient funds');
  });

  it('should prevent duplicate processing via idempotency key', async () => {
    verifyWebhookSignature.mockReturnValue(true);

    testDb.run(
      `INSERT INTO native_payment_transactions
       (user_id, allpay_order_id, amount, currency, transaction_type, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testData.adminId, 'ORD-IDEM', 9.0, 'USD', 'initial', 'pending']
    );

    const payload = { order_id: 'ORD-IDEM', status: '1', transaction_id: 'txn_idem' };

    const result1 = await processWebhookEvent(payload, 'sig');
    expect(result1.eventType).toBe('payment_success');

    const result2 = await processWebhookEvent(payload, 'sig');
    expect(result2.message).toBe('Event already processed');
  });

  it('should use order_id + status as idempotency key', async () => {
    verifyWebhookSignature.mockReturnValue(true);

    testDb.run(
      `INSERT INTO native_payment_transactions
       (user_id, allpay_order_id, amount, currency, transaction_type, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [testData.adminId, 'ORD-KEY', 9.0, 'USD', 'initial', 'pending']
    );

    await processWebhookEvent({ order_id: 'ORD-KEY', status: '1' }, 'sig');

    const evt = testDb.get("SELECT * FROM native_allpay_webhook_events WHERE allpay_order_id = 'ORD-KEY'", []);
    expect(evt.idempotency_key).toBe('ORD-KEY-1');
  });

  it('should merge webhook payload with existing transaction metadata', async () => {
    verifyWebhookSignature.mockReturnValue(true);

    testDb.run(
      `INSERT INTO native_payment_transactions
       (user_id, allpay_order_id, amount, currency, transaction_type, status, allpay_response_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [testData.adminId, 'ORD-MERGE', 9.0, 'USD', 'initial', 'pending', '{"planId":4}']
    );

    await processWebhookEvent(
      { order_id: 'ORD-MERGE', status: '1', transaction_id: 'txn_merge' }, 'sig'
    );

    const txn = testDb.get("SELECT * FROM native_payment_transactions WHERE allpay_order_id = 'ORD-MERGE'", []);
    const parsed = JSON.parse(txn.allpay_response_json);
    expect(parsed.planId).toBe(4); // preserved from original
    expect(parsed.transaction_id).toBe('txn_merge'); // added from webhook
  });
});
