/**
 * Check latest payment status
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { allpayAPI } from '../utils/allpayClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

async function checkPayment() {
  try {
    const orderId = 'ORDER-9-1770825386367'; // From logs

    console.log(`\n=== Checking latest payment ===`);
    console.log(`Order ID: ${orderId}\n`);

    const status = await allpayAPI.getPaymentStatus(orderId);

    console.log('Payment Status:');
    console.log(JSON.stringify(status, null, 2));

    if (status.status === 1) {
      console.log('\n✅ Payment is SUCCESSFUL');

      try {
        const token = await allpayAPI.getToken(orderId);
        console.log('✅ Token:', token);
      } catch (tokenError) {
        console.log('❌ Token retrieval failed:', tokenError.message);
      }
    } else if (status.status === 0) {
      console.log('\n⏳ Payment is PENDING');
    } else {
      console.log(`\n⚠️  Payment status: ${status.status}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

checkPayment();
