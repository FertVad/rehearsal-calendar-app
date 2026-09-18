# I — Зависимости: lock metadata, advisories и Apple audience

Первично сохранено 2026-09-15, завершено 2026-09-16; внешние advisories проверялись 2026-09-11, точный исходник Apple дочитан при возобновлениях 2026-09-15/16. Root сообщил HEAD `0f655e2` и неизменность manifests/locks относительно `25475e8`; новая дельта workflow/docs проверяется отдельно. Все локальные пути ниже относительно `/Users/vadimfertik/Desktop/reh_app/rehearsal-calendar-native`.

## Метод и границы

Полностью прочитаны оба package.json (корневой 66 строк, server 43). Оба package-lock.json версии 3 обработаны как JSON metadata через `jq`: 1622 и 544 записи packages, включая root. Извлечены все прямые production dependencies, версии selected security-relevant транзитивных пакетов, parents/dependency ranges и dev-флаги. Это **зафиксированные lock-версии**, не доказательство фактически установленного или развёрнутого набора. `node_modules`, tarball содержимое, native SDK binaries и весь CVE-каталог для каждой из 2164 нерутовых записей не исследовались. Установки, `npm audit`, npm/node/package code, сборки и тесты не запускались; lock-файлы не менялись.

Проверка advisories — выборочная и ориентирована на сеть/auth/parsing/build tools. Использованы первичные GitHub advisories/репозитории; поисковые результаты чужих проектов и issue-репорты scanner не служат доказательством уязвимости этого проекта. Новая версия сама по себе не finding. Отсутствие найденной применимой CVE не означает, что пакет полностью безопасен. До квалификации учитывались affected range, реально используемый API/adapter и контролируемость входа.

## Все прямые production lock-версии

Клиент (`package.json:19–47`, соответствующие `packages["node_modules/<name>"]` в корневом lock):

| Пакеты | Locked versions |
| --- | --- |
| @expo/vector-icons; @react-native-async-storage/async-storage; @react-native-community/datetimepicker | 15.0.3; 2.2.0; 8.4.4 |
| @react-navigation/bottom-tabs; @react-navigation/native; @react-navigation/native-stack | 7.8.5; 7.1.20; 7.6.3 |
| axios; date-fns-tz | 1.13.2; 3.2.0 |
| expo; expo-apple-authentication; expo-auth-session; expo-calendar | 54.0.37; 8.0.8; 7.0.11; 15.0.8 |
| expo-clipboard; expo-constants; expo-device; expo-haptics | 8.0.8; 18.0.14; 8.0.10; 15.0.8 |
| expo-linear-gradient; expo-linking; expo-notifications; expo-status-bar; expo-web-browser | 15.0.8; 8.0.12; 0.32.17; 3.0.9; 15.0.11 |
| react; react-native; react-native-calendars | 19.1.0; 0.81.5; 1.1313.0 |
| react-native-gesture-handler; react-native-safe-area-context; react-native-screens; react-native-svg | 2.28.0; 5.6.2; 4.16.0; 15.12.1 |

Backend (`server/package.json:15–29`):

| Пакеты | Locked versions |
| --- | --- |
| apple-signin-auth; jsonwebtoken; google-auth-library | 1.7.9; 9.0.2; 9.15.1 |
| bcrypt; better-sqlite3; pg | 5.1.1; 12.4.1; 8.16.3 |
| express; express-rate-limit; cors; helmet | 4.21.2; 8.3.2; 2.8.5; 8.1.0 |
| date-fns; date-fns-tz; dotenv; expo-server-sdk | 4.1.0; 3.2.0; 17.2.3; 3.15.0 |

Не все эти пакеты имеют проверенный в этом проходе отдельный advisory: таблица — покрытие metadata, а не полный security verdict по каждому пакету.

## Сверка применимости advisories — без автоматического начисления finding

### jsonwebtoken → jws: affected версия есть, используемый API исключён advisory

`server/package-lock.json:4782` jsonwebtoken 9.0.2 зависит от jws `^3.2.2`; `4821` фиксирует jws 3.2.2. Google-auth-library и gtoken имеют отдельные jws 4.0.1 (`3484`, `3546`). [GHSA-869p-cjfg-cm3x / CVE-2025-65945](https://github.com/auth0/node-jws/security/advisories/GHSA-869p-cjfg-cm3x) затрагивает jws `<3.2.3` и `4.0.0`, исправлено в 3.2.3/4.0.1. Однако он требует `jws.createVerify()` + HMAC + lookup ключа по пользовательскому header/payload и прямо исключает пользователей jsonwebtoken, вызывающих `jws.verify()`. В production project используются импорты jsonwebtoken в middleware/mailTokens; прямого jws.createVerify не найдено. **Не заявлено signature bypass.** Плановое обновление transitive jws полезно, но не отдельный проектный дефект. Effort обновления/проверки JWT flows: 1–3 часа.

### express/body-parser → qs: диапазон совпадает, практический DoS не подтверждён

`server/package-lock.json:2965` express 4.21.2 и `2084` body-parser 1.20.3 требуют qs 6.13.0 (`5786`). `server/server.js:119–120` использует стандартные `express.json()` и `express.urlencoded({ extended: true })`; custom query parser/большой parameterLimit/comma:true поиском production не найден.

- [GHSA-6rw7-vpxm-498p / CVE-2025-15284](https://github.com/advisories/GHSA-6rw7-vpxm-498p): `<6.14.1`, patch 6.14.1; пропуск arrayLimit для bracket notation. В обновлённом advisory прямо уточнено, что default parameterLimit=1000 ограничивает массив, а практический DoS при defaults negligible. Не превращено в High только из версии.
- [GHSA-w7fw-mjwx-w883 / CVE-2026-2391](https://github.com/advisories/GHSA-w7fw-mjwx-w883): `>=6.7.0 <=6.14.1`, patch 6.14.2; требует `comma:true`, которого в конфигурации не обнаружено.
- [GHSA-x5fp-wj9c-mxmx / CVE-2026-82562](https://github.com/ljharb/qs/security/advisories/GHSA-x5fp-wj9c-mxmx): `>=6.14.2 <=6.15.3`, patch 6.16.0, опять comma:true. Production qs 6.13.0 вне этого конкретного диапазона; вложенная dev-копия `superagent/node_modules/qs` 6.15.3 присутствует в test-only цепочке (`server/package-lock:6405`).

Итого: совпадение старого qs с advisories записано как зависимость к плановому обновлению, **подтверждённого неограниченного server DoS здесь нет**. Минимум — обновление Express/body-parser совместно с qs после сверки форм/query parsing; не слепой override major. Effort 2–4 часа плюс разрешённые regression checks.

### axios 1.13.2: несколько новых диапазонов, условия эксплуатации не доказаны

`package-lock.json:8083` содержит axios 1.13.2, только в клиентском manifest. Приложение использует фиксированный API wrapper; прямых `formToJSON`, FormData, xsrfCookieName, proxy/httpVersion/paramsSerializer и передачи непроверенного Axios config поиском production src/server не найдено.

| Advisory | Affected/patch для линии 1.x | Reachability и решение |
| --- | --- | --- |
| [GHSA-qj83-cq47-w5f8 / CVE-2026-39865](https://github.com/advisories/GHSA-qj83-cq47-w5f8) | >=1.13.0 <1.13.2 / 1.13.2 | Locked уже patched; HTTP/2 Node-specific. |
| [GHSA-43fc-jf86-j433 / CVE-2026-25639](https://github.com/advisories/GHSA-43fc-jf86-j433) | До 1.13.5 / 1.13.5 | MergeConfig требует вредоносного config key, а не обычного JSON body; контролируемый извне Axios config не найден. |
| [GHSA-p92q-9vqr-4j8v](https://github.com/axios/axios/security/advisories/GHSA-p92q-9vqr-4j8v) | 1.x до 1.16.0 / 1.16.0 | Proxy-Authorization leak — только Node HTTP adapter при специальной proxy→direct redirect цепочке; advisory исключает RN/XHR/fetch. |
| [GHSA-hfxv-24rg-xrqf](https://github.com/axios/axios/security/advisories/GHSA-hfxv-24rg-xrqf) | 1.x до 1.16.0 / 1.16.0 | Browser cookie regex требует attacker-controlled xsrfCookieName; RN прямо исключён. |
| [GHSA-pmv8-rq9r-6j72](https://github.com/axios/axios/security/advisories/GHSA-pmv8-rq9r-6j72) | 1.x до 1.18.0 / 1.18.0 | Требует untrusted FormData key names→formToJSON/JSON serializer; такой caller не найден. |
| [GHSA-mmx7-hfxf-jppx](https://github.com/axios/axios/security/advisories/GHSA-mmx7-hfxf-jppx), [GHSA-3w6x-2g7m-8v23](https://github.com/axios/axios/security/advisories/GHSA-3w6x-2g7m-8v23) | Patch соответственно 1.18.0 и 1.15.2 | Read-side gadgets требуют уже существующего Object.prototype pollution; цепочка до такого write в приложении не подтверждена. |

Это не исчерпывающий каталог многочисленных Axios advisories 2026 года. Подтверждённой эксплуатации в текущем native caller не заявлено. Обновление в поддерживаемой 1.x ветке после проверки интерсепторов/ошибок/отмены запросов: ориентировочно 0.5 дня. Не предлагать искусственное повышение severity на основании общего CVSS библиотеки.

### Build/install зависимости: отделены от server runtime

- Backend `bcrypt@5.1.1` (`server/package-lock:2027`) → `@mapbox/node-pre-gyp@1.0.11` (`1213`, tar `^6.1.11`) → `tar@6.2.1` (`6463`). [GHSA-34x7-hfp2-rc4v / CVE-2026-24842](https://github.com/advisories/GHSA-34x7-hfp2-rc4v) затрагивает `<7.5.7`, patch 7.5.7 (hardlink extraction traversal); [GHSA-23hp-3jrh-7fpw](https://github.com/isaacs/node-tar/security/advisories/GHSA-23hp-3jrh-7fpw) — `<=7.5.18`, patch 7.5.19 (archive expansion DoS). Цепочка до install helper доказана metadata; endpoint, принимающий пользовательский tar и распаковывающий его этим пакетом, не найден. Реальная атака требует подменённого install archive/другого контролируемого источника, происхождение и защиту загрузки здесь не исследовали. **Не заявлен remote API file write; условный build/install риск без нового finding ID.** Минимум обновить parent bcrypt/pre-gyp до совместимого patched дерева, не подменять tar 6→7 без проверки API. Effort 0.5–1 день с проверкой native builds после разрешения.
- Корневой tar 7.5.22 (`package-lock:20933`) в Expo CLI chain новее перечисленных patches. Наличие его в dependencies/dev=false не означает, что extractor доступен из production mobile UI.
- В обоих locks есть minimatch 3.1.2/9.0.5, а root glob13→minimatch10.1.1; отдельно @expo/fingerprint содержит 10.2.6. [GHSA-23c5-xmqv-rm74 / CVE-2026-27904](https://github.com/advisories/GHSA-23c5-xmqv-rm74) затрагивает `<3.1.4`, `>=9 <9.0.7`, `>=10 <10.2.3` (и другие major-линии), исправлено в 3.1.4/9.0.7/10.2.3. Parents: ESLint/TypeScript-eslint, Jest glob, RN codegen, Expo CLI, rimraf/test-exclude. Требуется контролируемый атакующим glob pattern; production caller не найден, toolchain patterns/third-party package bodies не исследовались. **Не заявлен mobile/server runtime ReDoS.** Parent updates и проверка toolchain: 0.5 дня.

### Прочие relevant metadata и исключения

- Корневой `react-native-calendars@1.1313.0` → lodash 4.17.21 (`package-lock:17770`). [GHSA-r5fr-rjxr-66jc / CVE-2026-4800](https://github.com/lodash/lodash/security/advisories/GHSA-r5fr-rjxr-66jc): lodash >=4.0.0 <=4.17.23, patch 4.18.0, требует untrusted `template` imports key names. [GHSA-f23m-r3pf-42rh / CVE-2026-2950](https://github.com/lodash/lodash/security/advisories/GHSA-f23m-r3pf-42rh): <=4.17.23, patch 4.18.0, требует untrusted paths в unset/omit; эффект — удаление prototype properties. В production исходниках приложения lodash/template/unset/omit callers не найдены; тела react-native-calendars не читались. **Reachability не подтверждена; не выдавать это за доказанное RCE/prototype pollution приложения.** Обновление parent/совместимый lodash после проверки календаря: 2–4 часа.
- Expo 54.0.37 вне диапазона [GHSA-wr5g-q49g-548w / CVE-2023-28131](https://github.com/advisories/GHSA-wr5g-q49g-548w) `<48.0.0`, patch 48.0.0. React 19.1.0 — не автоматическое доказательство React Server Components CVE: соответствующий server package/path в этой проверке не установлен.
- Проверены выбранные metadata: client follow-redirects 1.15.11, form-data 4.0.5, node-forge 1.4.0, undici 6.28.0, ws 6.2.3/7.5.10/8.21.3, @react-native/dev-middleware 0.81.5, metro 0.83.2 и @expo/metro nested metro 0.83.3; server node-fetch 2.7.0, path-to-regexp 0.1.12, cookie 0.7.1, send 0.19.0, serve-static 1.16.2, tar-fs 2.1.4, prebuild-install 7.1.3, node-rsa 1.1.1/asn1 0.2.6, superagent test-only form-data4.0.6/qs6.15.3. Этот список **не равен полной индивидуальной проверке всех их advisories**.

## IA01 — High, условный configuration flow — Apple ID token принимается без проверки приложения-получателя, если APPLE_CLIENT_ID отсутствует/пуст

`server/package-lock.json:1822` фиксирует apple-signin-auth 1.7.9 → jsonwebtoken `^9.0.0`, разрешённый root jsonwebtoken 9.0.2 (`4782`). `server/utils/oauthVerification.js:101–107` вызывает `appleSignin.verifyIdToken(idToken, { audience: process.env.APPLE_CLIENT_ID, ignoreExpiration: false })`. `server/routes/auth.js:186` принимает этот путь входа. Чтение production refs не обнаружило другого APPLE_CLIENT_ID guard. Наличие настройки в `.env.example` не доказывает её наличие в production.

[Официальный список tags](https://github.com/a-tokyo/apple-signin-auth/tags) связывает 1.7.9 с commit `ac8b453253ec776ddbcd769a18a1aea3424fe76d`. Версионный исходник GitHub web выдавал Cache miss; после сетевого разрешения получен read-only HTTP GET этого точного commit без установки/исполнения пакета. В [apple-signin-auth 1.7.9 src/index.js:374–393](https://github.com/a-tokyo/apple-signin-auth/blob/ac8b453253ec776ddbcd769a18a1aea3424fe76d/src/index.js#L374) wrapper передаёт jwt.verify объект с `algorithms: 'RS256', issuer: ENDPOINT_URL, ...options`; обязательной проверки audience/default audience нет. В связанной locked [jsonwebtoken 9.0.2 verify.js:194–207](https://github.com/auth0/node-jsonwebtoken/blob/v9.0.2/verify.js#L194) audience проверяется только внутри `if (options.audience)`. Следовательно, undefined/пустая строка из process.env проходит wrapper и полностью пропускает этот блок.

**Сценарий и условие.** Развёртывание принимает Apple login, но APPLE_CLIENT_ID не задан либо пуст. Caller передаёт настоящий, ещё действительный Apple ID token, выданный другому client/application. Подпись и issuer продолжают проверяться библиотекой, но aud этого токена не сравнивается с приложением Rehearsal. `verifyAppleToken` возвращает доверенные sub/email/emailVerified в обычный auth flow, который теперь не различает intended recipient. Если злоумышленник получил токен жертвы для другого relying party, он может попытаться использовать его здесь; сопоставление с существующим пользователем дополнительно зависит от account-linking правил A. Для самого подтверждённого дефекта достаточно принятия токена с чужим audience. **Не утверждается возможность подделать подпись, изменить token claims или взять произвольный аккаунт без настоящего Apple token.**

Это доказанный по исходникам условный fail-open, не утверждение об уже уязвимом production deployment: **реальные значения production env не читались/не проверялись**. Непустое корректное APPLE_CLIENT_ID сохраняет нормальную audience-проверку. High относится к нарушению границы аутентификации при указанной конфигурации; runtime exploitation не проводилась. Закрывает ранее оставленный в A вопрос о поведении именно locked library, повторно как два finding не считать.

**Минимум.** До verifyIdToken проверять наличие непустого ожидаемого client ID; при отсутствии отклонять Apple login с configuration error. Плюс: небольшой fail-closed фикс, не требует обновлять библиотеку. Минус: неправильный, но непустой ID будет давать отказ всем Apple входам; конфигурацию надо проверять при развёртывании. **Правильно.** Валидировать Apple audiences при startup/deploy, задавать явный разрешённый список native/service IDs, при выключенном Apple provider не открывать соответствующий login flow. Добавить негативные contract tests с отсутствующим/пустым audience и токеном другого client ID, позитивный intended-audience test. Плюс: предсказуемая конфигурация и проверенная граница; минус: затронут env/schema, deployment и auth tests. **Effort:** 1–2 часа / 0.5 дня. Обновление package version само по себе не исправляет неверный caller config.

Итог: **1 новая условная High находка IA01 по Apple audience**, закрывающая A-styk, и **0 подтверждённых новых CVE findings для runtime приложения** в выборочном advisory sweep. Affected metadata с исключёнными/неподтверждёнными условиями эксплуатации отдельно; build/install-only риски не приравнены к server API уязвимостям. Это не исчерпывающая CVE-инвентаризация. Никаких runtime proof-of-concept, установок или project/test/package execution не выполнялось. Проверка I dependencies завершена; advisory sweep после 2026-09-11 не расширялся.
