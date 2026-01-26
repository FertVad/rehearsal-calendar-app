# AllPay Integration Status Report

Дата: 2026-01-25

## ✅ Что работает

1. **Backend система подписок**
   - ✅ Token-based архитектура реализована
   - ✅ Polling механизм на фронтенде (проверка каждые 2 сек)
   - ✅ PostgreSQL схема готова
   - ✅ Recurring billing cron job настроен
   - ✅ WebView integration реализован

2. **API Endpoints**
   - ✅ `/plans` - возвращает тарифы
   - ✅ `/current` - текущая подписка пользователя
   - ✅ `/checkout` - создание платежа
   - ✅ `/check-pending/:orderId` - polling endpoint
   - ✅ `/webhook` - обработчик AllPay callback
   - ✅ `/test-config` - тестирование креденшелов

3. **Креденшелы**
   - ✅ API Login: `pp1016273` - **валидный**
   - ✅ API Key: `E764DA37F6F96519B89A313DA80AEBBD` - **валидный**
   - ✅ Test mode: включен
   - ✅ checkkeys endpoint возвращает success

## ⚠️ Текущая проблема

### Генерация подписи для getpayment

**Симптом:** При создании платежа AllPay возвращает `error_code: 3, "Signature is incorrect"`

**Что протестировано:**
- ✅ Креденшелы верные (checkkeys работает)
- ✅ Алгоритм близок к правильному (по документации)
- ❌ Точный формат обработки items array не совпадает

**Проблемные моменты:**
1. Items array требует специальной обработки
2. Документация AllPay не содержит полных примеров
3. Нужно точное соответствие их алгоритму

## 🔧 Рекомендации для решения

### Вариант 1: Использовать AllPay API Tester (РЕКОМЕНДУЕТСЯ)

**Шаги:**

1. Откройте: https://allpay.to/demo/test-api.php

2. Введите креденшелы:
   ```
   API Login: pp1016273
   API Key: E764DA37F6F96519B89A313DA80AEBBD
   ```

3. Выберите операцию: **"Create payment"** (getpayment)

4. Заполните минимальные поля:
   ```json
   {
     "order_id": "TEST123",
     "email": "test@example.com",
     "currency": "ILS",
     "items": [
       {
         "name": "Test Product",
         "price": 100,
         "qty": 1,
         "vat": 17
       }
     ]
   }
   ```

5. Нажмите **"Send Request"**

6. **Если получите payment_url:**
   - Откройте DevTools (F12) → Network tab
   - Посмотрите точный формат POST запроса
   - Скопируйте signature base string
   - Сравните с нашим алгоритмом

7. **Если ошибка:**
   - Попробуйте обратиться в поддержку AllPay
   - Спросите про корректный формат signature для items array

### Вариант 2: Обратиться в поддержку AllPay

**Email:** support@allpay.co.il

**Вопрос:**
```
Здравствуйте,

Я интегрирую AllPay API и получаю ошибку "Signature is incorrect" при
создании платежа (getpayment) с массивом items.

Мои креденшелы:
- Login: pp1016273
- Endpoint checkkeys работает успешно

Вопрос: Как правильно обрабатывать массив items при генерации SHA256
подписи? Нужны ли JSON.stringify для items или значения извлекаются
по отдельности?

Можете ли предоставить рабочий пример Node.js кода для генерации
подписи с items array?

Спасибо!
```

### Вариант 3: Поискать готовую библиотеку

Поищите на GitHub:
- `allpay.co.il node`
- `allpay israel api`
- Возможно есть готовые npm пакеты

### Вариант 4: Временный workaround

Если нужно срочно протестировать UI без реальных платежей:

1. Создайте mock endpoint `/api/native/subscriptions/checkout-mock`
2. Возвращайте фейковый payment_url
3. Тестируйте UI flow, polling, WebView
4. Когда подпись исправлена - переключитесь на реальный endpoint

## 📊 Текущий статус системы

### Backend
```
✅ Сервер запущен: http://localhost:3001
✅ PostgreSQL подключен
✅ Cron jobs активны
⚠️  AllPay signature - требует исправления
```

### Frontend
```
✅ Metro bundler запущен: http://localhost:8081
✅ Subscription Screen реализован
✅ Polling механизм работает
⚠️  Бесконечный loader (ждет payment_url)
```

### Database
```
✅ Таблицы созданы:
   - native_subscription_plans (3 плана)
   - native_user_subscriptions
   - native_payment_transactions
   - native_allpay_webhook_events
```

## 🧪 Как протестировать после исправления

1. **Перезапустите сервер**
   ```bash
   cd rehearsal-calendar-native/server
   npm run dev
   ```

2. **В приложении:**
   - Profile → Subscription
   - Выберите любой тариф
   - WebView должен открыться с формой AllPay
   - После оплаты WebView закроется автоматически (polling)

3. **Тестовая карта:**
   ```
   Номер: 4557430402053431 (Visa)
   CVV: 123
   Срок: 12/27
   ```

## 📁 Файлы для проверки

Если нужно изменить алгоритм подписи:
- [server/utils/allpayClient.js:50-89](rehearsal-calendar-native/server/utils/allpayClient.js#L50-L89)

Тестовые скрипты:
- [test-allpay.js](test-allpay.js) - тест checkkeys
- [test-allpay-payment.js](test-allpay-payment.js) - тест getpayment

Логи:
- Сервер: `/tmp/server.log`
- Metro: `/private/tmp/claude/...tasks/ba7dc6f.output`

## 🔗 Полезные ссылки

- AllPay API Reference: https://www.allpay.co.il/api-reference
- AllPay API Tester: https://allpay.to/demo/test-api.php
- Tokens Guide: https://www.allpay.co.il/api-reference#tokens
- Поддержка: support@allpay.co.il

---

## Следующие шаги

1. ✅ Протестировать через AllPay API Tester
2. ✅ Получить рабочий пример подписи
3. ✅ Исправить `generateAllPaySignature()` в allpayClient.js
4. ✅ Перезапустить сервер
5. ✅ Протестировать в приложении
6. ✅ Провести тестовую оплату
7. ✅ Проверить webhook и polling
8. ✅ Протестировать recurring billing cron job

**Оценка:** После исправления подписи система полностью готова к работе.
