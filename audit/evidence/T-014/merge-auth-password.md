# T-014 on auto/main: the password field's eye is an IconButton

The eight T-014 commits were cherry-picked onto auto/main (`git cherry-pick -x`,
conflict in `shared/constants/spacing.ts` kept both sides: `AUTH_BUTTON_HEIGHT`
from T-015 and `TouchTarget` from T-014).

T-015, which reached auto/main first, added `features/auth/components/PasswordField.tsx`
with its own `TouchableOpacity` show-password button. T-014's rule caught it.

## Red before (auto/main with T-014 picked, PasswordField as T-015 left it)

```
$ npx jest --selectProjects frontend --silent iconButtonLabels
FAIL frontend src/shared/components/__tests__/iconButtonLabels.test.ts
  ● every icon-only button is an IconButton
    - Array []
    + Array [
    +   "features/auth/components/PasswordField.tsx:31",
    + ]
Tests:       1 failed, 2 passed, 3 total
```

## Green after (the eye drawn by IconButton, same 44 pt column)

```
$ npx jest --selectProjects frontend --silent
Tests:       986 passed, 986 total

$ npm run e2e -- e2e/flows/49-sign-in-and-register-forms.yaml
[Passed] Sign-in and registration forms (1m 57s)

$ npm run e2e -- e2e/flows/49-touch-targets.yaml e2e/flows/50-register-says-under-fields.yaml
[Passed] Touch targets are 44 pt (2m 14s)
[Passed] Registration says what is wrong under each field (55s)
2/2 Flows Passed
```

The button's place and size are as before (44 wide, the field's height,
at least 44), so nothing changes on screen; flow 49 (sign-in) still finds and
presses it by its label.

## Review 2 (Astra, P2: an e2e on a 320 pt screen)

Not done, by the owner's decision of 31.10.2026: this machine has no simulator
that wide. iOS 18.2 and 26.x do not run the iPhone SE (1st gen) or iPod touch;
the narrowest are 375 pt (SE 2/3, mini), and 320 pt exists only in Display
Zoom, which cannot be switched on in a simulator from a script. Installing an
old iOS for one check is out of proportion. The proof for the narrow week is
the Jest layout calculation at 320 pt, red on the old `WeeklyCalendar` and
green after (review-1.md); the three first-round remarks were accepted by the
reviewer in the code.
