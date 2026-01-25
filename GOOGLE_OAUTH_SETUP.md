# Настройка Google OAuth для Rehearsal Calendar

Это руководство описывает все шаги для настройки Google Sign-In в вашем приложении.

## Шаг 1: Создание проекта в Google Cloud Console

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
   - Нажмите на выпадающий список проектов вверху страницы
   - Нажмите "New Project" (Создать проект)
   - Введите название: например, "Rehearsal Calendar"
   - Нажмите "Create" (Создать)

## Шаг 2: Включение Google Sign-In API

1. В Google Cloud Console перейдите в **APIs & Services** → **Library**
2. Найдите "Google+ API" или "Google Identity"
3. Нажмите **Enable** (Включить)

## Шаг 3: Настройка OAuth Consent Screen

1. Перейдите в **APIs & Services** → **OAuth consent screen**
2. Выберите тип пользователей:
   - **External** (для публичного приложения) - рекомендуется
   - **Internal** (только для организации) - если у вас Google Workspace
3. Нажмите **Create**
4. Заполните обязательные поля:
   - **App name**: Rehearsal Calendar
   - **User support email**: ваш email
   - **Developer contact information**: ваш email
5. Нажмите **Save and Continue**
6. На странице **Scopes** нажмите **Add or Remove Scopes**
   - Добавьте следующие scope:
     - `email`
     - `profile`
     - `openid`
   - Эти scope уже включены по умолчанию при использовании Google Sign-In
7. Нажмите **Save and Continue**
8. На странице **Test users** (если выбрали External):
   - В режиме тестирования добавьте email-адреса тестовых пользователей
   - Позже можно будет опубликовать приложение для всех пользователей
9. Нажмите **Save and Continue**

## Шаг 4: Создание OAuth Client IDs

Вам нужно создать **3 разных Client ID** для каждой платформы:

### 4.1. iOS Client ID

1. Перейдите в **APIs & Services** → **Credentials**
2. Нажмите **Create Credentials** → **OAuth client ID**
3. Выберите **Application type**: **iOS**
4. Заполните поля:
   - **Name**: Rehearsal Calendar iOS
   - **Bundle ID**: `com.rehearsal.app` (из вашего app.json)
5. Нажмите **Create**
6. **ВАЖНО**: Скопируйте **Client ID** - он выглядит так:
   ```
   123456789-abcdefgh.apps.googleusercontent.com
   ```
7. Также скопируйте **iOS URL scheme** - это перевернутый Client ID:
   ```
   com.googleusercontent.apps.123456789-abcdefgh
   ```

### 4.2. Android Client ID

1. Снова нажмите **Create Credentials** → **OAuth client ID**
2. Выберите **Application type**: **Android**
3. Заполните поля:
   - **Name**: Rehearsal Calendar Android
   - **Package name**: `com.rehearsal.app` (из вашего app.json)
   - **SHA-1 certificate fingerprint**: получите с помощью команды ниже

#### Получение SHA-1 fingerprint для Android:

**Для разработки (debug keystore):**
```bash
# На macOS/Linux
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# На Windows
keytool -list -v -keystore %USERPROFILE%\.android\debug.keystore -alias androiddebugkey -storepass android -keypass android
```

**Для продакшена (release keystore):**
```bash
keytool -list -v -keystore /path/to/your/release.keystore -alias your_alias
```

Скопируйте значение **SHA1** из вывода команды.

4. Вставьте SHA-1 fingerprint в поле
5. Нажмите **Create**
6. **ВАЖНО**: Скопируйте **Client ID**

### 4.3. Web Client ID

1. Снова нажмите **Create Credentials** → **OAuth client ID**
2. Выберите **Application type**: **Web application**
3. Заполните поля:
   - **Name**: Rehearsal Calendar Web
4. Нажмите **Create**
5. **ВАЖНО**: Скопируйте **Client ID**

**Примечание**: Web Client ID используется для верификации токенов на бэкенде.

## Шаг 5: Настройка переменных окружения

### 5.1. Backend (server/.env)

Откройте файл `rehearsal-calendar-native/server/.env` и добавьте:

```env
# OAuth Configuration (Google)
GOOGLE_CLIENT_ID_IOS=YOUR_IOS_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_ID_ANDROID=YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com
GOOGLE_CLIENT_ID_WEB=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
```

**Замените** `YOUR_IOS_CLIENT_ID`, `YOUR_ANDROID_CLIENT_ID`, `YOUR_WEB_CLIENT_ID` на реальные значения, которые вы скопировали.

### 5.2. Frontend (app.json)

Откройте файл `rehearsal-calendar-native/app.json` и обновите:

```json
{
  "expo": {
    "ios": {
      "config": {
        "googleSignIn": {
          "reservedClientId": "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID"
        }
      },
      "infoPlist": {
        "CFBundleURLTypes": [
          {
            "CFBundleURLSchemes": [
              "rehearsalapp",
              "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID"
            ]
          }
        ]
      }
    },
    "extra": {
      "googleIosClientId": "YOUR_IOS_CLIENT_ID.apps.googleusercontent.com",
      "googleAndroidClientId": "YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com",
      "googleWebClientId": "YOUR_WEB_CLIENT_ID.apps.googleusercontent.com"
    }
  }
}
```

**Замените**:
- `YOUR_IOS_CLIENT_ID` на числовую часть iOS Client ID (без `.apps.googleusercontent.com`)
- `YOUR_ANDROID_CLIENT_ID.apps.googleusercontent.com` на полный Android Client ID
- `YOUR_WEB_CLIENT_ID.apps.googleusercontent.com` на полный Web Client ID

**Пример**:
```json
{
  "expo": {
    "ios": {
      "config": {
        "googleSignIn": {
          "reservedClientId": "com.googleusercontent.apps.123456789-abcdefgh"
        }
      },
      "infoPlist": {
        "CFBundleURLTypes": [
          {
            "CFBundleURLSchemes": [
              "rehearsalapp",
              "com.googleusercontent.apps.123456789-abcdefgh"
            ]
          }
        ]
      }
    },
    "extra": {
      "googleIosClientId": "123456789-abcdefgh.apps.googleusercontent.com",
      "googleAndroidClientId": "987654321-xyz.apps.googleusercontent.com",
      "googleWebClientId": "555555555-web.apps.googleusercontent.com"
    }
  }
}
```

## Шаг 6: Пересборка приложения

После изменения `app.json` нужно **обязательно** пересобрать нативную часть приложения:

### iOS:
```bash
cd rehearsal-calendar-native

# Очистить кеш и пересобрать
rm -rf ios/Pods
npx pod-install

# Запустить приложение
npm run ios
```

### Android:
```bash
cd rehearsal-calendar-native

# Очистить сборку
cd android && ./gradlew clean && cd ..

# Запустить приложение
npm run android
```

## Шаг 7: Тестирование

1. Запустите backend сервер:
   ```bash
   cd rehearsal-calendar-native/server
   npm run dev
   ```

2. Запустите приложение:
   ```bash
   cd rehearsal-calendar-native
   npm start
   # Затем нажмите 'i' для iOS или 'a' для Android
   ```

3. На экране входа нажмите кнопку "Sign in with Google"
4. Должно открыться окно браузера для авторизации Google
5. После успешной авторизации вы должны автоматически войти в приложение

## Шаг 8: Публикация приложения (опционально)

Когда ваше приложение готово к публикации:

1. Перейдите в Google Cloud Console → **APIs & Services** → **OAuth consent screen**
2. Нажмите **Publish App**
3. Подтвердите публикацию
4. Если требуется, пройдите процесс верификации Google

## Проверка настройки

Вы можете проверить, правильно ли настроена Google авторизация, запустив следующий код в приложении:

```typescript
import { isGoogleAuthConfigured } from './src/shared/services/googleAuth';

console.log('Google Auth configured:', isGoogleAuthConfigured());
```

Должно вывести `true`, если все Client ID настроены правильно.

## Частые проблемы

### 1. "Developer Error" при авторизации

**Причина**: Неправильный Client ID или Bundle ID не совпадает

**Решение**:
- Проверьте, что Bundle ID в Google Cloud Console совпадает с `com.rehearsal.app`
- Проверьте, что Client ID в app.json и .env совпадают с теми, что в Google Cloud Console

### 2. "redirect_uri_mismatch"

**Причина**: Неправильный URL scheme в iOS

**Решение**:
- Убедитесь, что в `app.json` в `CFBundleURLSchemes` указан правильный reversed Client ID
- Пересоберите приложение: `rm -rf ios/Pods && npx pod-install && npm run ios`

### 3. Авторизация проходит, но backend возвращает ошибку

**Причина**: Web Client ID не настроен на backend

**Решение**:
- Проверьте, что в `server/.env` правильно указаны все три Client ID
- Перезапустите backend сервер: `npm run dev`

### 4. "Token verification failed"

**Причина**: Backend не может проверить токен

**Решение**:
- Убедитесь, что `GOOGLE_CLIENT_ID_WEB` в server/.env совпадает с Web Client ID из Google Cloud Console
- Проверьте, что указаны ВСЕ три Client ID (iOS, Android, Web)

## Резюме: Какие данные нужны

После выполнения всех шагов у вас должны быть следующие данные:

### Для backend (server/.env):
```env
GOOGLE_CLIENT_ID_IOS=123456789-abc.apps.googleusercontent.com
GOOGLE_CLIENT_ID_ANDROID=987654321-xyz.apps.googleusercontent.com
GOOGLE_CLIENT_ID_WEB=555555555-web.apps.googleusercontent.com
```

### Для frontend (app.json):
- iOS Client ID (полный): `123456789-abc.apps.googleusercontent.com`
- iOS URL Scheme (reversed): `com.googleusercontent.apps.123456789-abc`
- Android Client ID (полный): `987654321-xyz.apps.googleusercontent.com`
- Web Client ID (полный): `555555555-web.apps.googleusercontent.com`

## Дополнительные ресурсы

- [Google Sign-In for iOS](https://developers.google.com/identity/sign-in/ios/start-integrating)
- [Google Sign-In for Android](https://developers.google.com/identity/sign-in/android/start-integrating)
- [Expo Google Authentication](https://docs.expo.dev/guides/google-authentication/)
- [OAuth 2.0 для мобильных приложений](https://developers.google.com/identity/protocols/oauth2/native-app)

---

Если возникнут проблемы, проверьте логи на backend сервере - там будут подробные сообщения об ошибках верификации токенов.
