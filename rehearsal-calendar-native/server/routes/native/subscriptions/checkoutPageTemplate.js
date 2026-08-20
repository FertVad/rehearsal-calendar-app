/**
 * HTML template for the AllPay Hosted Fields checkout page
 * Rendered in WebView with dark theme and pay button
 *
 * Every value here arrives from the query string of a public, unauthenticated
 * route, so nothing may be interpolated raw — see utils/htmlEscape.js for which
 * helper belongs in which context.
 */

import { escapeHtml, jsonForScript } from '../../../utils/htmlEscape.js';

export function generateCheckoutPageHTML({ paymentUrl, orderId, planName, amount, currency, lang }) {
  const isRu = lang === 'ru';
  // Constrain to the two locales the page actually renders rather than echoing
  // whatever arrived, which would land unescaped in the lang attribute.
  const htmlLang = isRu ? 'ru' : 'en';
  const safeAmount = escapeHtml(amount || '0');
  const payBtnText = isRu ? `Оплатить $${safeAmount}` : `Pay $${safeAmount}`;
  const processingText = isRu ? 'Обработка платежа...' : 'Processing payment...';
  const secureText = isRu ? 'Безопасная оплата через AllPay' : 'Secure payment via AllPay';
  const title = isRu ? 'Оплата' : 'Payment';

  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0d1117;
      color: #e6edf3;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      padding: 16px 20px;
      text-align: center;
      border-bottom: 1px solid rgba(139, 148, 158, 0.2);
    }
    .header h1 {
      font-size: 18px;
      font-weight: 600;
      color: #e6edf3;
    }
    .plan-info {
      padding: 16px 20px;
      text-align: center;
      background: #161b22;
      border-bottom: 1px solid rgba(139, 148, 158, 0.2);
    }
    .plan-name {
      font-size: 16px;
      font-weight: 500;
      color: #A855F7;
    }
    .plan-price {
      font-size: 24px;
      font-weight: 700;
      margin-top: 4px;
    }
    .iframe-container {
      flex: 1;
      padding: 0;
      background: #0d1117;
    }
    .iframe-container iframe {
      width: 100%;
      height: 350px;
      border: none;
      background: #0d1117;
    }
    .footer {
      padding: 16px 20px;
      background: #0d1117;
      border-top: 1px solid rgba(139, 148, 158, 0.2);
    }
    .pay-btn {
      width: 100%;
      padding: 16px;
      font-size: 18px;
      font-weight: 600;
      color: #fff;
      background: linear-gradient(135deg, #A855F7, #9333EA);
      border: none;
      border-radius: 12px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .pay-btn:active { opacity: 0.8; }
    .pay-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .secure-badge {
      text-align: center;
      margin-top: 12px;
      font-size: 12px;
      color: #8b949e;
    }
    .processing {
      display: none;
      text-align: center;
      padding: 12px;
      color: #A855F7;
      font-size: 14px;
    }
    .error-msg {
      display: none;
      text-align: center;
      padding: 12px;
      color: #ef4444;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
  </div>
  <div class="plan-info">
    <div class="plan-name">${escapeHtml(planName || 'Subscription')}</div>
    <div class="plan-price">$${safeAmount} ${escapeHtml(currency || 'USD')}</div>
  </div>
  <div class="iframe-container">
    <iframe id="allpay-iframe" src="${escapeHtml(paymentUrl)}" allow="payment *"></iframe>
  </div>
  <div class="footer">
    <div class="processing" id="processing">${processingText}</div>
    <div class="error-msg" id="error-msg"></div>
    <button class="pay-btn" id="pay-btn" onclick="handlePay()">${payBtnText}</button>
    <div class="secure-badge">${secureText}</div>
  </div>

  <script src="https://allpay.to/js/allpay-hf.js"></script>
  <script>
    var payBtn = document.getElementById('pay-btn');
    var processingEl = document.getElementById('processing');
    var errorEl = document.getElementById('error-msg');

    var Allpay = new AllpayPayment({
      iframeId: 'allpay-iframe',
      onSuccess: function() {
        payBtn.style.display = 'none';
        processingEl.style.display = 'none';
        errorEl.style.display = 'none';
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'payment_success',
            orderId: ${jsonForScript(String(orderId || ''))}
          }));
        }
      },
      onError: function(errorNum, errorMsg) {
        payBtn.disabled = false;
        payBtn.textContent = '${payBtnText}';
        processingEl.style.display = 'none';
        errorEl.textContent = errorMsg || 'Payment failed. Please try again.';
        errorEl.style.display = 'block';
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'payment_error',
            error: errorNum,
            message: errorMsg
          }));
        }
      }
    });

    function handlePay() {
      payBtn.disabled = true;
      payBtn.textContent = '${processingText}';
      processingEl.style.display = 'block';
      errorEl.style.display = 'none';
      Allpay.pay();
    }
  </script>
</body>
</html>`;
}
