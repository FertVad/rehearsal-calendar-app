import { config } from 'dotenv';
config();

import { db } from './database/db.js';

const plan = await db.get('SELECT * FROM native_subscription_plans WHERE id = $1', [4]);
console.log('Monthly Plan:', JSON.stringify(plan, null, 2));

process.exit(0);
