/**
 * Check webhook payload details
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import db, { initDatabase } from '../database/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function checkWebhooks() {
  try {
    await initDatabase();

    console.log('\n=== Recent webhook payloads ===\n');

    const webhooks = await db.all(
      `SELECT id, event_type, allpay_order_id, processing_status, payload_json, created_at
       FROM native_allpay_webhook_events
       ORDER BY created_at DESC
       LIMIT 3`
    );

    for (const webhook of webhooks) {
      console.log(`\n--- Webhook ${webhook.id} ---`);
      console.log(`Event: ${webhook.event_type}`);
      console.log(`Status: ${webhook.processing_status}`);
      console.log(`Order ID: ${webhook.allpay_order_id || 'null'}`);
      console.log(`Created: ${webhook.created_at}`);

      if (webhook.payload_json) {
        const payload = JSON.parse(webhook.payload_json);
        console.log('\nPayload:');
        console.log(JSON.stringify(payload, null, 2));
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkWebhooks();
