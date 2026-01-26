/**
 * Payment Success Page
 * Displayed after successful AllPay payment
 */

import express from 'express';

const router = express.Router();

/**
 * Success page - shown after payment completion
 * AllPay redirects here with payment details
 */
router.get('/payment-success', (req, res) => {
  const { order_id, transaction_id, status } = req.query;

  // Simple HTML success page
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Successful</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }

    .checkmark {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #10b981;
      margin: 0 auto 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: scaleIn 0.5s ease-out;
    }

    .checkmark svg {
      width: 50px;
      height: 50px;
      stroke: white;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
      animation: drawCheck 0.5s ease-out 0.3s forwards;
      stroke-dasharray: 100;
      stroke-dashoffset: 100;
    }

    @keyframes scaleIn {
      from {
        transform: scale(0);
      }
      to {
        transform: scale(1);
      }
    }

    @keyframes drawCheck {
      to {
        stroke-dashoffset: 0;
      }
    }

    h1 {
      color: #1f2937;
      font-size: 28px;
      margin-bottom: 15px;
      font-weight: 600;
    }

    p {
      color: #6b7280;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 10px;
    }

    .order-id {
      background: #f3f4f6;
      padding: 12px 20px;
      border-radius: 10px;
      margin: 25px 0;
      font-family: 'Courier New', monospace;
      color: #374151;
      font-size: 14px;
    }

    .message {
      background: #dbeafe;
      color: #1e40af;
      padding: 20px;
      border-radius: 10px;
      margin-top: 25px;
      font-size: 14px;
      line-height: 1.5;
    }

    .auto-close {
      margin-top: 20px;
      color: #9ca3af;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">
      <svg viewBox="0 0 52 52">
        <path d="M14 27l10 10 20-20"/>
      </svg>
    </div>

    <h1>Payment Successful!</h1>
    <p>Your subscription has been activated successfully.</p>

    ${order_id ? `<div class="order-id">Order ID: ${order_id}</div>` : ''}

    <div class="message">
      <strong>✨ Welcome to Premium!</strong><br>
      You now have access to all features. You can close this window and return to the app.
    </div>

    <p class="auto-close">This window will close automatically in a few seconds...</p>
  </div>

  <script>
    // Auto-close after 3 seconds for mobile webview
    setTimeout(() => {
      window.close();

      // If window.close() doesn't work (some browsers block it),
      // try to redirect back to app
      setTimeout(() => {
        window.location.href = 'rehearsalapp://payment-success';
      }, 500);
    }, 3000);
  </script>
</body>
</html>
  `;

  res.send(html);
});

/**
 * Cancel page - shown when user cancels payment
 */
router.get('/payment-cancel', (req, res) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Cancelled</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }

    .container {
      background: white;
      border-radius: 20px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      text-align: center;
    }

    .icon {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: #ef4444;
      margin: 0 auto 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: scaleIn 0.5s ease-out;
    }

    .icon svg {
      width: 50px;
      height: 50px;
      stroke: white;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
    }

    @keyframes scaleIn {
      from {
        transform: scale(0);
      }
      to {
        transform: scale(1);
      }
    }

    h1 {
      color: #1f2937;
      font-size: 28px;
      margin-bottom: 15px;
      font-weight: 600;
    }

    p {
      color: #6b7280;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 10px;
    }

    .message {
      background: #fee2e2;
      color: #991b1b;
      padding: 20px;
      border-radius: 10px;
      margin-top: 25px;
      font-size: 14px;
      line-height: 1.5;
    }

    .auto-close {
      margin-top: 20px;
      color: #9ca3af;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg viewBox="0 0 52 52">
        <line x1="16" y1="16" x2="36" y2="36"/>
        <line x1="36" y1="16" x2="16" y2="36"/>
      </svg>
    </div>

    <h1>Payment Cancelled</h1>
    <p>Your payment was not completed.</p>

    <div class="message">
      No charges have been made. You can try again anytime.
    </div>

    <p class="auto-close">This window will close automatically...</p>
  </div>

  <script>
    setTimeout(() => {
      window.close();
      setTimeout(() => {
        window.location.href = 'rehearsalapp://payment-cancel';
      }, 500);
    }, 3000);
  </script>
</body>
</html>
  `;

  res.send(html);
});

export default router;
