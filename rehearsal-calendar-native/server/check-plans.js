import { config } from 'dotenv';
config();

import { initDatabase } from './database/db.js';

const db = await initDatabase();
const plans = await db.all('SELECT id, name, price_ils, price_usd FROM native_subscription_plans ORDER BY id');
console.log('\nSubscription Plans:');
console.table(plans);

// Also log full object to see all fields
console.log('\nFull plan objects:');
const allPlans = await db.all('SELECT * FROM native_subscription_plans ORDER BY id');
allPlans.forEach(plan => {
  console.log(JSON.stringify(plan, null, 2));
});

process.exit(0);
