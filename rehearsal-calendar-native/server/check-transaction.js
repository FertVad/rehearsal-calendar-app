import { config } from 'dotenv';
config();

import { initDatabase } from './database/db.js';

const db = await initDatabase();

const orderId = 'ORDER-3-1769416585322';

console.log(`\nChecking transaction: ${orderId}\n`);

const transaction = await db.get(
  'SELECT * FROM native_payment_transactions WHERE allpay_order_id = $1',
  [orderId]
);

if (transaction) {
  console.log('Transaction:');
  console.log(JSON.stringify(transaction, null, 2));
} else {
  console.log('Transaction not found');
}

const subscription = await db.get(
  'SELECT * FROM native_user_subscriptions WHERE user_id = 3 ORDER BY id DESC LIMIT 1'
);

if (subscription) {
  console.log('\nUser subscription:');
  console.log(JSON.stringify(subscription, null, 2));
} else {
  console.log('\nNo subscription found for user 3');
}

process.exit(0);
