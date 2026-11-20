# T-265: the "Update Required" screen, read language by language

Keys: `update.title`, `update.message`, `update.openStore`
(`src/i18n/translations/common.ts`). Three strings in four languages, shown on
one screen: a header, a paragraph under it, a button.

**How this was read.** The review asked for a separate editor per language, as
in T-256 and T-261. This session has no subagents (the supervisor's rules: no
background tasks, monitors or subagents), so the four readings below were done
in this session, one language at a time, each as a native editor of that
language reads an iOS screen: is it what a native speaker writes, does it match
Apple's own wording in that language and the app's own glossary (the editors'
words of T-256/T-261 pinned in `src/i18n/__tests__/proofreadingEdits.test.ts`
and `secondReading.test.ts`), does it fit the screen. They are not independent
readings by a second agent; if the owner wants those, they are for the
supervisor to run, and this file is what they would check.

Result: no string changed. Each verdict with its reason below.

## Русский

| Ключ | Текст | Вердикт |
|---|---|---|
| title | Нужно обновить приложение | Оставить. Заголовок-состояние, как «Нужен доступ»; без точки. «Требуется обновление» — канцелярит. |
| message | Эта версия Rehearsly больше не поддерживается. Обновите приложение в App Store, чтобы пользоваться им дальше. Входить в аккаунт заново не придётся. | Оставить. Обращение на «вы» и повелительное «Обновите», как в остальном приложении. «Входить заново не придётся» снимает главный страх — потерять вход. |
| openStore | Открыть App Store | Оставить. Так пишет сама iOS; App Store не склоняется и не переводится. |

## English

| Key | Text | Verdict |
|---|---|---|
| title | Update Required | Keep. Title Case for titles, as Apple writes them (the T-256 rule, `titleCase` tests). |
| message | This version of Rehearsly is no longer supported. Update the app in the App Store to keep using it. You’ll stay signed in. | Keep. Plain, second person, the typographic apostrophe the app uses (T-256). "in the App Store", with the article, as Apple writes it in running text. |
| openStore | Open App Store | Keep. A button in Title Case; without "the", as on Apple's own buttons (cf. "Open Settings"). |

## Español

| Clave | Texto | Veredicto |
|---|---|---|
| title | Actualización necesaria | Mantener. Mayúscula solo inicial, como en español. «Es necesario actualizar» sería frase, no título. |
| message | Esta versión de Rehearsly ya no es compatible. Actualiza la app en el App Store para seguir usándola. No tendrás que volver a iniciar sesión. | Mantener. Tuteo, como el resto de la app; «la app», como «en la app Rehearsly» (secondReading). «el App Store», masculino, como lo escribe Apple. «ya no es compatible» es la fórmula de Apple en español para «no longer supported». «usándola» concuerda con «la app». |
| openStore | Abrir App Store | Mantener. Infinitivo en botones, como «Abrir Ajustes». |

## Deutsch

| Schlüssel | Text | Urteil |
|---|---|---|
| title | Update erforderlich | Behalten. So schreibt iOS selbst; „Aktualisierung erforderlich“ ist steifer. |
| message | Diese Version von Rehearsly wird nicht mehr unterstützt. Aktualisiere die App im App Store, um sie weiter zu nutzen. Du bleibst angemeldet. | Behalten. Duzen wie überall in der App („Erlaube Mitteilungen …“); Komma vor „um … zu“ korrekt; „im App Store“ wie bei Apple. |
| openStore | App Store öffnen | Behalten. Infinitiv am Ende, wie „Einstellungen öffnen“ (profile.openSettings). |
