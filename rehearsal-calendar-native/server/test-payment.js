/**
 * Test AllPay payment creation with actual implementation
 */

import { config } from 'dotenv';
config();

import { allpayAPI, generateAllPaySignature } from './utils/allpayClient.js';

console.log('Testing AllPay API with actual implementation...\n');

// Test signature generation with simple params matching AllPay tester
const testParams = {
  login: 'pp1016273',
  order_id: 'TEST123',
  email: 'test@example.com',
  currency: 'ILS',
  items: [{
    name: 'Test Product',
    price: '100',
    qty: '1',
    discount_val: '0',
    discount_type: 'fixed',
    vat: '17'
  }],
  test: '1'
};

console.log('=== Test Parameters ===');
console.log(JSON.stringify(testParams, null, 2));

const signature = generateAllPaySignature(testParams);
console.log('\n=== Generated Signature ===');
console.log(signature);

// Now test the actual API call
console.log('\n=== Testing createSubscriptionPayment ===');
try {
  const result = await allpayAPI.createSubscriptionPayment({
    orderId: 'TEST-' + Date.now(),
    email: 'test@example.com',
    amount: 100,
    currency: 'ILS',
    description: 'Test Subscription',
    successUrl: 'https://example.com/success',
    cancelUrl: 'https://example.com/cancel',
    webhookUrl: 'https://example.com/webhook',
    customData: { test: true }
  });

  console.log('✅ Success!');
  console.log('Payment URL:', result.paymentUrl);
  console.log('Order ID:', result.orderId);
} catch (error) {
  console.error('❌ Error:', error.message);
}
