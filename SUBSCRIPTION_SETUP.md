# AllPay Subscription Setup Guide

## ✅ Что изменилось

Подписки теперь управляются **полностью на нашей стороне через токены**:

- ❌ Убрали зависимость от AllPay Subscriptions API
- ✅ Используем только токенизацию карт
- ✅ Полный контроль над циклом подписки
- ✅ WebView автоматически закрывается после оплаты (polling каждые 2 секунды)

## 🔑 Конфигурация (уже настроено)

Файл `server/.env`:
```env
ALLPAY_API_LOGIN=pp1016273
ALLPAY_API_KEY=E764DA37F6F96519B89A313DA80AEBBD
ALLPAY_TEST_MODE=true
```

## 🧪 Как протестировать

### 1. Проверить конфигурацию AllPay

```bash
# Запустить сервер
cd rehearsal-calendar-native/server
npm run dev

# В другом терминале - проверить конфигурацию
curl http://localhost:3001/api/native/subscriptions/test-config
```

**Ожидаемый ответ:**
```json
{
  "configured": true,
  "testMode": true,
  "login": "pp1016273",
  "connectionTest": { ... },
  "message": "AllPay configuration is valid"
}
```

### 2. Тестовый платёж

**В приложении:**
1. Зайти в Profile → Subscription
2. Выбрать любой план (например, Monthly - ₪32)
3. Нажать "Select Plan"
4. WebView откроется с формой AllPay
5. Заполнить **тестовую карту** (в тестовом режиме):
   - Номер карты: `4580458045804580`
   - CVV: `123`
   - Срок: любая будущая дата (например `12/25`)
   - Имя: любое
6. Нажать "Pay"
7. **WebView автоматически закроется через 2-3 секунды**
8. Появится сообщение "Subscription created successfully!"

### 3. Что происходит за кулисами

1. **Backend создает checkout** → получает `payment_url` и `order_id`
2. **AllPay принимает платёж** → отправляет webhook
3. **Webhook обработчик**:
   - Проверяет подпись
   - Вызывает `gettoken` API
   - Сохраняет токен в БД
   - Создает подписку
4. **Frontend polling**:
   - Каждые 2 секунды проверяет `GET /check-pending/:orderId`
   - Когда `subscriptionCreated: true` → закрывает WebView

## 🎯 Что видит пользователь

**До оплаты:**
- Выбор плана с ценами в долларах ($9, $15, $49)
- Кнопка "Select Plan"

**Форма AllPay (WebView):**
```
╔══════════════════════════╗
║   AllPay Payment Form    ║
╠══════════════════════════╣
║ Amount: ₪32.00          ║
║                          ║
║ Card Number:             ║
║ [____________________]   ║
║                          ║
║ CVV:        Expiry:      ║
║ [___]       [___]        ║
║                          ║
║ [       Pay Now       ]  ║
╚══════════════════════════╝
```

**После успешной оплаты:**
- WebView закрывается автоматически
- Alert: "Subscription created successfully!"
- Экран подписки показывает статус "Active"

## 🔄 Recurring Billing (автоматический)

Cron job запускается **ежедневно в 2:00 AM**:
```bash
# Ручной запуск (для тестирования)
cd rehearsal-calendar-native/server
node jobs/recurringBilling.js
```

**Что делает:**
1. Находит подписки с `next_billing_date <= NOW()`
2. Для каждой подписки:
   - Берёт `allpay_token` из БД
   - Вызывает `getpayment` с `allpay_token`
   - Если успешно → обновляет `next_billing_date`
   - Если ошибка → ставит статус `payment_failed`

## ❌ Отмена подписки

**В приложении:**
1. Profile → Subscription
2. Нажать "Cancel Subscription"
3. Подтвердить

**Что происходит:**
- Обновляется только локальная БД (`status = 'cancelled'`)
- **НЕ вызывается** AllPay API
- Cron job перестанет списывать деньги (нет `next_billing_date`)

## 🐛 Troubleshooting

### WebView не закрывается автоматически
**Причина**: Polling не работает (нет интернета / сервер упал)
**Решение**: Пользователь может закрыть вручную кнопкой "X"

### "Failed to create checkout"
**Причина**: Неверные AllPay креденшелы
**Решение**: Проверить `server/.env` и перезапустить сервер

### Webhook не срабатывает
**Причина**: AllPay не может достучаться до вашего сервера
**Решение**:
- Для тестирования локально используйте [ngrok](https://ngrok.com)
- Для продакшна используйте Render/Railway/Heroku

### Тестовый платёж не проходит
**Причина**: Неправильная тестовая карта
**Решение**: Используйте `4580458045804580` (тестовая карта AllPay)

## 📝 Логи

Все операции логируются:
```bash
# Смотреть логи сервера
cd rehearsal-calendar-native/server
npm run dev

# Фильтр по AllPay событиям
npm run dev | grep '\[AllPay\]'
npm run dev | grep '\[Webhook\]'
npm run dev | grep '\[Recurring Billing\]'
```

## 🚀 Production Deploy

Перед деплоем в продакшн:

1. **Отключить тестовый режим**:
   ```env
   ALLPAY_TEST_MODE=false
   ```

2. **Обновить webhook URL** в AllPay панели:
   ```
   https://your-domain.com/api/native/subscriptions/webhook
   ```

3. **Проверить cron job** на сервере (должен быть запущен)

4. **Протестировать с реальной картой** малую сумму

## 📚 Документация

- [AllPay API Reference](https://www.allpay.co.il/api-reference)
- [AllPay Tokens Guide](https://www.allpay.co.il/api-reference#tokens)
- [Проект README](./CLAUDE.md)
