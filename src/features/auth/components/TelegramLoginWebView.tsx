import React, { useRef } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { Colors } from '../../../shared/constants/colors';
import { useAuth } from '../../../contexts/AuthContext';

interface TelegramLoginWebViewProps {
  botName: string; // Bot username (without @)
  onClose?: () => void;
}

export default function TelegramLoginWebView({ botName, onClose }: TelegramLoginWebViewProps) {
  const webViewRef = useRef<WebView>(null);
  const { loginWithTelegram } = useAuth();

  // Use Vercel hosted page instead of inline HTML
  // This ensures the Telegram Login Widget can verify the domain
  const LOGIN_URL = 'https://rehearsal-calendar-tg.vercel.app/mobile-login.html';

  // OLD CODE - using inline HTML (doesn't work with Telegram domain verification)
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
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
            align-items: center;
            justify-content: center;
            padding: 20px;
          }
          .container {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px 30px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            text-align: center;
            max-width: 400px;
            width: 100%;
          }
          h1 {
            color: #333;
            font-size: 24px;
            margin-bottom: 10px;
            font-weight: 600;
          }
          p {
            color: #666;
            font-size: 14px;
            margin-bottom: 30px;
            line-height: 1.5;
          }
          #telegram-login {
            display: inline-block;
            margin: 20px 0;
          }
          .loader {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #667eea;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 20px auto;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Вход через Telegram</h1>
          <p>Нажмите кнопку ниже, чтобы авторизоваться через ваш Telegram аккаунт</p>
          <div id="telegram-login"></div>
          <div class="loader" id="loader"></div>
        </div>

        <script>
          window.onTelegramAuth = function(user) {
            try {
              // Hide loader
              document.getElementById('loader').style.display = 'none';

              // Send user data to React Native
              const userData = {
                id: user.id,
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                username: user.username || '',
                photo_url: user.photo_url || '',
                auth_date: user.auth_date,
                hash: user.hash
              };

              window.ReactNativeWebView.postMessage(JSON.stringify(userData));
            } catch (error) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                error: 'Failed to process authentication: ' + error.message
              }));
            }
          };

          // Load Telegram widget
          setTimeout(() => {
            const script = document.createElement('script');
            script.src = 'https://telegram.org/js/telegram-widget.js?22';
            script.setAttribute('data-telegram-login', '${botName}');
            script.setAttribute('data-size', 'large');
            script.setAttribute('data-radius', '10');
            script.setAttribute('data-onauth', 'onTelegramAuth(user)');
            script.setAttribute('data-request-access', 'write');
            script.async = true;

            script.onload = () => {
              document.getElementById('loader').style.display = 'none';
            };

            script.onerror = () => {
              document.getElementById('loader').style.display = 'none';
              window.ReactNativeWebView.postMessage(JSON.stringify({
                error: 'Failed to load Telegram widget. Please check bot configuration.'
              }));
            };

            document.getElementById('telegram-login').appendChild(script);
          }, 500);
        </script>
      </body>
    </html>
  `;

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.error) {
        Alert.alert('Ошибка', data.error);
        onClose?.();
        return;
      }

      // Authenticate with backend
      await loginWithTelegram(data);
      onClose?.();
    } catch (error: any) {
      console.error('Telegram auth error:', error);
      Alert.alert('Ошибка входа', error.message || 'Не удалось войти через Telegram');
      onClose?.();
    }
  };

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: LOGIN_URL }}
        onMessage={handleMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.accent.purple} />
          </View>
        )}
        style={styles.webview}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bg.primary,
  },
});
