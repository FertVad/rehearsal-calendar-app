# T-263 — a sentence that ends in English ends in every language

Test: `rehearsal-calendar-native/src/i18n/__tests__/sentenceEnd.test.ts`
Command: `cd rehearsal-calendar-native && npx jest --selectProjects frontend --testPathPatterns sentenceEnd`

## Red before (auto/main fa0e928, translations unchanged)

Exactly the four strings of the task, nothing else:

```
FAIL frontend src/i18n/__tests__/sentenceEnd.test.ts
  T-263: a sentence that ends in English ends in every language
    ✓ the rule reads the marks it should (465 ms)
    ✕ ru (18 ms)
    ✕ es (15 ms)
    ✕ de (5 ms)
    ✓ every function has sample arguments, and every exception is still a string (3 ms)

  ● ... › ru
    + Array [
    +   "profile.avatarHint: Аватар генерируется автоматически на основе вашего email",
    + ]

  ● ... › es
    + Array [
    +   "profile.avatarHint: El avatar se genera automáticamente a partir de tu correo",
    +   "onboarding.skipMessage: Puedes configurar el inicio de la semana y la sincronización del calendario en cualquier momento en Perfil → Ajustes",
    + ]

  ● ... › de
    + Array [
    +   "profile.avatarHint: Der Avatar wird automatisch aus deiner E-Mail-Adresse erstellt",
    + ]

Tests:       3 failed, 2 passed, 5 total
```

## Green after

A full stop at the end of the four strings (es `onboarding.skipMessage`;
ru, es, de `profile.avatarHint`). Nothing else changed.

```
PASS frontend src/i18n/__tests__/secondReading.test.ts
PASS frontend src/i18n/__tests__/navPlanner.test.ts
PASS frontend src/i18n/__tests__/sentenceEnd.test.ts
PASS frontend src/i18n/__tests__/proofreading.test.ts
PASS frontend src/i18n/__tests__/plurals.test.ts
PASS frontend src/i18n/__tests__/proofreadingEdits.test.ts
PASS frontend src/i18n/__tests__/unusedKeys.test.ts
Tests:       87 passed, 87 total
```

No e2e: only the last mark of four strings changes, their way to the screen is
the same (task text). `git grep` finds the old strings nowhere outside
`src/i18n/translations/`.

## Coverage

- All 456 leaves of the English translations are strings or functions; every
  string is compared.
- All 50 functions are called with sample arguments (counts 0, 1, 2, 3, 5, 11,
  21, 22, 25 for the plural ones, so every ru plural branch is read; a name, an
  email, null where the function takes it). None could not be checked; a new
  function without samples fails the test.
- Exceptions: none. The rule found no disputed string (heading, caption without
  a verb).
