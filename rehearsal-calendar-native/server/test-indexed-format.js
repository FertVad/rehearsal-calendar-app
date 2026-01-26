/**
 * Test AllPay with indexed items format
 */

import { config } from 'dotenv';
config();

import crypto from 'crypto';

const ALLPAY_API_LOGIN = process.env.ALLPAY_API_LOGIN;
const ALLPAY_API_KEY = process.env.ALLPAY_API_KEY;

// Generate signature for indexed format
function generateSignature(params, apiKey) {
  const filtered = Object.entries(params)
    .filter(([key, value]) =>
      key !== 'sign' &&
      value !== '' &&
      value !== null &&
      value !== undefined
    )
    .sort(([a], [b]) => a.localeCompare(b));

  const values = filtered.map(([_, value]) => String(value));
  const signatureBase = values.join(':') + ':' + apiKey;

  console.log('Signature base:', signatureBase);

  return crypto.createHash('sha256').update(signatureBase).digest('hex');
}

// Test with indexed format
const params = {
  login: ALLPAY_API_LOGIN,
  order_id: 'TEST-INDEXED-' + Date.now(),
  email: 'test@example.com',
  currency: 'ILS',
  'items[0][name]': 'Test Product',
  'items[0][price]': '100',
  'items[0][qty]': '1',
  'items[0][discount_val]': '0',
  'items[0][discount_type]': 'fixed',
  'items[0][vat]': '17',
  test: '1'
};

const signature = generateSignature(params, ALLPAY_API_KEY);
params.sign = signature;

console.log('\n=== Testing Indexed Format ===');
console.log('Params:', params);

// Make API request
const urlParams = new URLSearchParams();
for (const [key, value] of Object.entries(params)) {
  urlParams.append(key, String(value));
}

console.log('\n=== Request Body ===');
console.log(decodeURIComponent(urlParams.toString()));

const url = 'https://allpay.to/app/?show=getpayment&mode=api10';

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: urlParams.toString()
  });

  const data = await response.json();
  console.log('\n=== API Response ===');
  console.log(JSON.stringify(data, null, 2));

  if (data.payment_url) {
    console.log('\n✅ SUCCESS! Payment URL:', data.payment_url);
  } else {
    console.log('\n❌ Error:', data.error_msg);
  }
} catch (error) {
  console.error('Request failed:', error.message);
}

process.exit(0);
