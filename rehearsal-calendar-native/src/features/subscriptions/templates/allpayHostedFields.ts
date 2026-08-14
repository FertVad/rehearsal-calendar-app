/**
 * AllPay Hosted Fields HTML Template
 *
 * Generates embedded HTML for WebView with AllPay Hosted Fields SDK.
 * Provides instant payment feedback via postMessage instead of polling.
 */

export interface AllPayHostedFieldsParams {
  paymentUrl: string;      // checkoutUrl from AllPay API
  language: string;        // User's preferred language (any IETF-style code)
  orderId: string;         // Order ID for tracking
}

export const generateAllPayHostedFieldsHTML = (
  params: AllPayHostedFieldsParams
): string => {
  const { paymentUrl, language, orderId } = params;

  return `
<!DOCTYPE html>
<html lang="${language}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${language === 'ru' ? 'Оплата' : 'Payment'}</title>

  <!-- AllPay Hosted Fields SDK -->
  <script
    src="https://allpay.to/js/allpay-hf.js"
    onload="console.log('[AllPay HF] SDK script loaded successfully');"
    onerror="console.error('[AllPay HF] SDK script FAILED to load - check network/CORS');"
  ></script>

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background-color: #0f0f0f;
      color: #ffffff;
      overflow: hidden;
    }

    #payment-container {
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    #payment-iframe {
      width: 100%;
      height: 100%;
      border: none;
      flex: 1;
    }

    #loading {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      z-index: 10;
    }

    .spinner {
      border: 4px solid rgba(168, 85, 247, 0.2);
      border-top: 4px solid #a855f7;
      border-radius: 50%;
      width: 50px;
      height: 50px;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    #error-container {
      display: none;
      padding: 24px;
      text-align: center;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 12px;
      margin: 24px;
    }

    #error-container.visible {
      display: block;
    }

    .error-title {
      font-size: 18px;
      font-weight: 600;
      color: #ef4444;
      margin-bottom: 8px;
    }

    .error-message {
      font-size: 14px;
      color: #d1d5db;
    }
  </style>
</head>
<body>
  <div id="payment-container">
    <!-- Loading indicator -->
    <div id="loading">
      <div class="spinner"></div>
      <p>${language === 'ru' ? 'Загрузка...' : 'Loading...'}</p>
    </div>

    <!-- Error container -->
    <div id="error-container">
      <p class="error-title" id="error-title"></p>
      <p class="error-message" id="error-message"></p>
    </div>

    <!-- AllPay iframe -->
    <iframe
      id="payment-iframe"
      src="${paymentUrl}"
      allow="payment"
    ></iframe>
  </div>

  <script>
    // Configuration
    const config = {
      paymentUrl: '${paymentUrl}',
      language: '${language}',
      orderId: '${orderId}',
    };

    console.log('[AllPay HF] Script loaded');
    console.log('[AllPay HF] Config:', config);
    console.log('[AllPay HF] Checking AllpayPayment:', typeof AllpayPayment);

    // PostMessage communication with React Native WebView
    function sendMessageToApp(type, data) {
      const message = {
        type: type,
        data: data,
        timestamp: new Date().toISOString(),
        orderId: config.orderId,
      };

      console.log('[AllPay HF] Sending message to app:', message);

      // React Native WebView listens to window.ReactNativeWebView.postMessage
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      } else {
        console.warn('[AllPay HF] ReactNativeWebView not available');
      }
    }

    // Hide loading indicator
    function hideLoading() {
      const loading = document.getElementById('loading');
      if (loading) {
        loading.style.display = 'none';
      }
    }

    // Show error
    function showError(title, message) {
      hideLoading();
      const errorContainer = document.getElementById('error-container');
      const errorTitle = document.getElementById('error-title');
      const errorMessage = document.getElementById('error-message');

      if (errorContainer && errorTitle && errorMessage) {
        errorTitle.textContent = title;
        errorMessage.textContent = message;
        errorContainer.classList.add('visible');
      }
    }

    // Check if AllpayPayment SDK is available
    if (typeof AllpayPayment === 'undefined') {
      console.warn('[AllPay HF] AllpayPayment SDK not loaded - using direct iframe fallback');

      // Hide loader after 2 seconds to show iframe
      setTimeout(function() {
        hideLoading();
        console.log('[AllPay HF] Showing direct iframe (no Hosted Fields)');

        sendMessageToApp('PAYMENT_LOADED', {
          orderId: config.orderId,
        });
      }, 2000);

    } else {
      try {
        console.log('[AllPay HF] Initializing AllpayPayment...');

        // Initialize AllPay Hosted Fields
        const Allpay = new AllpayPayment({
          iframeId: 'payment-iframe',

          onSuccess: function() {
            console.log('[AllPay HF] Payment successful!');
            hideLoading();

            // Send success message to React Native
            sendMessageToApp('PAYMENT_SUCCESS', {
              orderId: config.orderId,
              message: config.language === 'ru'
                ? 'Оплата успешно завершена'
                : 'Payment completed successfully',
            });
          },

          onError: function(error_n, error_msg) {
            console.error('[AllPay HF] Payment error:', error_n, error_msg);

            const errorTitle = config.language === 'ru'
              ? 'Ошибка оплаты'
              : 'Payment Error';

            showError(errorTitle, error_msg || 'Unknown error');

            // Send error message to React Native
            sendMessageToApp('PAYMENT_ERROR', {
              orderId: config.orderId,
              errorCode: error_n,
              errorMessage: error_msg,
            });
          },

          onLoad: function() {
            console.log('[AllPay HF] iframe loaded');
            hideLoading();

            sendMessageToApp('PAYMENT_LOADED', {
              orderId: config.orderId,
            });
          },
        });

        console.log('[AllPay HF] AllpayPayment initialized:', Allpay);

        // CRITICAL: Trigger payment immediately after initialization
        try {
          console.log('[AllPay HF] Calling Allpay.pay()...');
          Allpay.pay();
          console.log('[AllPay HF] Allpay.pay() called successfully');
        } catch (payError) {
          console.error('[AllPay HF] Error calling pay():', payError);
        }

      } catch (error) {
        console.error('[AllPay HF] Initialization error:', error);

        // Fallback: hide loader and show iframe anyway
        setTimeout(function() {
          hideLoading();
          console.log('[AllPay HF] Error during init - showing direct iframe as fallback');

          sendMessageToApp('PAYMENT_LOADED', {
            orderId: config.orderId,
          });
        }, 2000);

        sendMessageToApp('PAYMENT_INIT_ERROR', {
          orderId: config.orderId,
          errorMessage: error.message || 'Init failed - using fallback',
        });
      }
    }

    // Notify app that HTML is ready
    sendMessageToApp('PAYMENT_READY', {
      orderId: config.orderId,
    });
  </script>
</body>
</html>
  `.trim();
};
