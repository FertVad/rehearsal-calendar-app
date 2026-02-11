/**
 * Check payment status from AllPay API
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
    const orderId = 'ORDER-9-1770824336246';

    console.log(`\n=== Checking AllPay payment status ===`);
    console.log(`Order ID: ${orderId}\n`);

    const status = await allpayAPI.getPaymentStatus(orderId);

    console.log('Payment Status:');
    console.log(JSON.stringify(status, null, 2));

    // Status codes: 0=unpaid, 1=paid, 3=refunded, 4=partially_refunded
    if (status.status === 1) {
      console.log('\n✅ Payment is SUCCESSFUL (status=1)');
      console.log('Attempting to get token...\n');

      try {
        const token = await allpayAPI.getToken(orderId);
        console.log('✅ Token retrieved successfully:', token);
      } catch (tokenError) {
        console.log('❌ Token retrieval failed:', tokenError.message);
      }
    } else if (status.status === 0) {
      console.log('\n⏳ Payment is PENDING (status=0)');
    } else {
      console.log(`\n⚠️  Payment status: ${status.status}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  }
}

checkPayment();
