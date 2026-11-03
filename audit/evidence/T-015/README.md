# T-015 — sign-in and registration

Base `8fae51c`. Fix `68cef65`, flow and Google's label `fd95588`.

| Point | What changed | Proved by |
|---|---|---|
| 1 Failure said once | `handleLogin` no longer alerts; the AuthProvider's error under the fields says it (401, no network, 500, 429); `EMAIL_NOT_VERIFIED` still opens the code screen | `LoginFlow.test.tsx` (real AuthProvider), `LoginScreen.test.tsx`, flow 49 |
| 2 No empty form | Sign In / Sign Up `disabled` until the required fields are filled, the "Fill in all fields" alerts gone; address, password rule, name, mismatch said under their own field; the taken-address alert stays | `LoginScreen.test.tsx`, `RegisterScreen.test.tsx`, flow 49 |
| 3 Return | sign-in: address `next` → password `go` submits; registration: `next` through the fields, `go` on the repeat submits | both screen tests, flow 49 |
| 4 Buttons | Sign In 50 pt; "Forgot password?" a link under the password, "No account? Create one" at the foot, both 44 pt targets | `LoginScreen.test.tsx`, screenshots of flow 49 |
| 5 Password field | placeholder is the word; `PasswordField` with a 44×44 show/hide button (label "Show password"/"Hide password", needed by `iconButtonLabels.test.ts` and flow 49); Google and Apple 50 pt, Google's label 19 pt — the size iOS draws Apple's at that height, matched on the simulator's screenshot | screen tests, flow 49 |
| 6 Rule under the password | `PASSWORD_MIN_LENGTH` in `accountRules.ts`, read by `meetsPasswordRule` and by `t.auth.passwordHint(min)` (13 pt, all four languages, Russian plural) | `RegisterScreen.test.tsx` |

Files: `e2e-red-before.txt`, `e2e-green-after.txt`, `jest-red-before.txt`, `jest-green-after.txt`.

## Review 1

1. Registration's red stopped at ids the old form never had (Jest) and at
   sign-in's `login-submit` (flow 49). `RegisterScreen.test` and
   `RegisterFlow.test` now find the fields by their place in the form and the
   button by its title; on the old screen six tests fail on what it did — Sign
   Up live on an incomplete form, problems in alerts, no Return types, no rule
   under the password (`jest-register-red-before.txt`).
2. Flow 50 (`50-register-says-under-fields.yaml`, tag `auth`) types a
   101-character name, a 6-character password, a repeat that differs and a
   wrong address, and presses Sign Up once: each problem is under its field,
   with no alert. It finds the fields by placeholder and the way in by title,
   so on the old form it reaches the press and fails on the alert "Error /
   Invalid email format" (`e2e-register-red-before.txt`,
   `e2e-register-green-after.txt`).

Flow 50 shows both passwords before any typing: iOS offers a strong password
for a hidden new one even with no address typed, and fills both fields with it.

Flow 49 shows both passwords before typing in registration: with an address
and a hidden new password on screen iOS offers a strong password in place of
the keyboard, and XCTest's typing goes nowhere (seen on three runs; the sign-in
and reset forms do not get the offer). A person sees Apple's usual offer there.

Seen, not changed (outside the task): the AuthProvider's `error` is one for
both screens, so a refused sign-in is still under the fields after "No account?
Create one" opens registration (screenshot in the run of 06:19). It was so
before T-015.
