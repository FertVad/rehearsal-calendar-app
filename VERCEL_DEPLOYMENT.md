# Vercel Deployment Guide

Пошаговая инструкция для деплоя бэкенда на Vercel и настройки HTTPS webhook для AllPay.

## Шаг 1: Подготовка к деплою

### 1.1. Проверьте что все изменения закоммичены

```bash
cd /Users/vadimfertik/Desktop/reh_app
git status
git add .
git commit -m "feat: add Vercel deployment config and payment success pages"
git push origin features/payments
```

## Шаг 2: Деплой на Vercel

### 2.1. Установите Vercel CLI (если еще не установлен)

```bash
npm install -g vercel
```

### 2.2. Залогиньтесь в Vercel

```bash
vercel login
```

### 2.3. Деплой из директории сервера

```bash
cd rehearsal-calendar-native/server
vercel
```

При первом деплое Vercel спросит:
- **Set up and deploy?** → `Y` (Yes)
- **Which scope?** → Выберите ваш аккаунт
- **Link to existing project?** → `N` (No, создаем новый)
- **What's your project's name?** → `rehearsal-calendar-backend` (или любое имя)
- **In which directory is your code located?** → `.` (текущая директория)

Vercel автоматически:
- Обнаружит `vercel.json`
- Установит зависимости
- Задеплоит сервер

### 2.4. Получите URL деплоя

После деплоя Vercel выведет URL типа:
```
https://rehearsal-calendar-backend-abc123.vercel.app
```

Сохраните этот URL - он понадобится для настройки переменных окружения.

## Шаг 3: Настройка переменных окружения на Vercel

### 3.1. Через Vercel Dashboard (рекомендуется)

1. Откройте https://vercel.com/dashboard
2. Выберите проект `rehearsal-calendar-backend`
3. Settings → Environment Variables
4. Добавьте следующие переменные:

**Обязательные переменные:**

```bash
NODE_ENV=production
PORT=3001

# Database (PostgreSQL на Neon)
DATABASE_URL=postgresql://...your-neon-connection-string...

# JWT
JWT_SECRET=...ваш-секретный-ключ...

# AllPay Payment
ALLPAY_API_LOGIN=pp1016273
ALLPAY_API_KEY=E764DA37F6F96519B89A313DA80AEBBD
ALLPAY_TEST_MODE=true

# Google OAuth
GOOGLE_CLIENT_ID_IOS=...
GOOGLE_CLIENT_ID_ANDROID=...
GOOGLE_CLIENT_ID_WEB=...

# Apple OAuth (если есть)
APPLE_CLIENT_ID=com.rehearsal.app
APPLE_TEAM_ID=...
APPLE_KEY_ID=...
APPLE_PRIVATE_KEY=...
```

**Важно:**
- Для каждой переменной выберите environment: **Production, Preview, Development** (все три)
- После добавления всех переменных нажмите **Save**

### 3.2. Через Vercel CLI (альтернатива)

```bash
cd rehearsal-calendar-native/server

# Добавить переменные окружения
vercel env add NODE_ENV production
vercel env add DATABASE_URL
# ... и так далее для всех переменных
```

## Шаг 4: Проверка деплоя

### 4.1. Проверьте health endpoint

```bash
curl https://ваш-url.vercel.app/api/health
```

Должно вернуть:
```json
{
  "status": "ok",
  "timestamp": "2026-01-26T..."
}
```

### 4.2. Проверьте страницу успеха

Откройте в браузере:
```
https://ваш-url.vercel.app/api/native/payment-success?order_id=TEST123
```

Должна открыться красивая страница с зеленой галочкой.

### 4.3. Проверьте AllPay конфигурацию

```bash
curl https://ваш-url.vercel.app/api/native/subscriptions/test-config
```

Должно вернуть `"configured": true`.

## Шаг 5: Обновление AllPay Webhook URL

Теперь у вас есть HTTPS URL для webhook. Webhook URL автоматически формируется в коде:

```
https://ваш-url.vercel.app/api/native/subscriptions/webhook
```

**Важно:** AllPay будет отправлять POST запросы на этот URL после каждой успешной оплаты.

Проверьте что webhook работает локально:

```bash
# На вашем компьютере
cd rehearsal-calendar-native/server
npm run dev

# В другом терминале - симулируйте webhook
curl -X POST http://localhost:3001/api/native/subscriptions/webhook \
  -H "Content-Type: application/json" \
  -d '{"order_id":"TEST123","status":1}'
```

## Шаг 6: Тестирование платежа end-to-end

### 6.1. Обновите frontend для использования production API

В `.env` файле фронтенда (или просто для теста):

```bash
EXPO_PUBLIC_API_URL=https://ваш-url.vercel.app/api
```

### 6.2. Протестируйте оплату

1. Откройте приложение
2. Profile → Subscription
3. Выберите тариф
4. WebView должен открыть AllPay форму
5. Используйте тестовую карту:
   ```
   Номер: 4580458045804580
   CVV: 123
   Срок: 12/27
   ```
6. После оплаты должна открыться страница "Payment Successful"
7. Через 3 секунды WebView должен закрыться
8. В приложении должен появиться премиум статус

### 6.3. Проверьте webhook

После оплаты проверьте логи Vercel:

```bash
vercel logs
```

Должны быть записи типа:
```
[Webhook] Event already processed: ORDER-3-...
[Subscriptions] Created subscription for user 3
```

## Шаг 7: Настройка production домена (опционально)

### 7.1. Добавьте custom домен

1. Vercel Dashboard → Project → Settings → Domains
2. Add Domain: `api.rehearsal.app` (или любой другой)
3. Настройте DNS согласно инструкциям Vercel
4. Подождите пока SSL сертификат выпустится (5-10 минут)

### 7.2. Обновите BASE_URL

После настройки домена обновите переменную окружения:

```bash
vercel env add BASE_URL production
# Введите: https://api.rehearsal.app
```

Или в Dashboard → Environment Variables:
```
BASE_URL=https://api.rehearsal.app
```

### 7.3. Редеплой

```bash
vercel --prod
```

## Шаг 8: Отключение Test Mode (для продакшена)

Когда готовы принимать реальные платежи:

1. Vercel Dashboard → Environment Variables
2. Измените `ALLPAY_TEST_MODE=false`
3. Редеплойте: `vercel --prod`

**Важно:**
- В test mode карты не списываются
- В production mode будут реальные списания
- Убедитесь что всё работает в test mode перед переключением

## Troubleshooting

### Ошибка: "Database connection failed"

Проверьте что `DATABASE_URL` правильный:
```bash
vercel env ls
```

Убедитесь что PostgreSQL на Neon доступен извне.

### Ошибка: "AllPay signature incorrect"

1. Проверьте что переменные `ALLPAY_API_LOGIN` и `ALLPAY_API_KEY` правильные
2. Проверьте логи: `vercel logs`
3. Убедитесь что в `.vercelignore` нет случайного игнорирования `allpayClient.js`

### Webhook не срабатывает

1. Проверьте что URL доступен: `curl https://ваш-url.vercel.app/api/native/subscriptions/webhook`
2. Проверьте логи AllPay (если есть доступ к их dashboard)
3. Временно используйте скрипт `activate-subscription.js` для тестирования:
   ```bash
   cd rehearsal-calendar-native/server
   node activate-subscription.js ORDER-3-123456
   ```

### Страница успеха не открывается

Проверьте что:
1. Роут `payment-success.js` подключен в `server.js`
2. URL правильный: `/api/native/payment-success`
3. Нет конфликтов с другими роутами

## Мониторинг

### Проверка логов в реальном времени

```bash
vercel logs --follow
```

### Проверка метрик

Vercel Dashboard → Analytics:
- Request count
- Response time
- Error rate

## Следующие шаги

После успешного деплоя:

1. ✅ Webhook работает через HTTPS
2. ✅ Страница успеха отображается
3. ✅ Подписки создаются автоматически
4. ✅ Recurring billing работает (cron job на Vercel)

Проверьте что cron job работает:
- Vercel автоматически запускает cron jobs из кода
- Проверьте логи: `vercel logs` → ищите `[Recurring Billing]`
- Или настройте Vercel Cron Jobs в Dashboard

---

## Полезные команды

```bash
# Деплой в production
vercel --prod

# Деплой в preview (для тестирования)
vercel

# Просмотр логов
vercel logs

# Просмотр переменных окружения
vercel env ls

# Удалить деплой (осторожно!)
vercel rm rehearsal-calendar-backend
```

## Результат

После выполнения всех шагов у вас будет:
- ✅ Backend развернут на Vercel с HTTPS
- ✅ Webhook URL работает: `https://ваш-url.vercel.app/api/native/subscriptions/webhook`
- ✅ Страница успеха: `https://ваш-url.vercel.app/api/native/payment-success`
- ✅ Все переменные окружения настроены
- ✅ AllPay интеграция работает end-to-end
- ✅ Recurring billing настроен

**Время деплоя:** ~10-15 минут
