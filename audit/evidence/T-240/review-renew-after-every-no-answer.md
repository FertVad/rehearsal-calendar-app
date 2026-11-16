# T-240 review (Astra, P2): the pool is flushed after every attempt with no answer

Before: `_renewed` held back both the resend and `renewConnections()`. When the
app's one resend also got no answer, its connection stayed in the pool, and the
person's next tap began on it.

After: `renewConnections()` runs after every `gotNoAnswer`; `_renewed` limits
only the resend (still once).

Test: `src/shared/services/__tests__/api.deadConnection.test.ts` —
"a sign-in is sent again only once: no answer twice is the network" now also
checks that `renew` ran twice and that the next tap goes down connection 3.

## Red — api.ts from HEAD (97b27d9), the new test

```
FAIL frontend src/shared/services/__tests__/api.deadConnection.test.ts
  ✓ an answer, even a refusal, is not a dead connection: nothing is flushed or sent again
  no answer as ECONNABORTED
    ✓ a Google sign-in that heard nothing is sent again, on a new connection, and goes through
    ✓ so are a sign-in with a password, with Apple, and a read
    ✓ a change is not sent again by the app, and the next try goes down a new connection
    ✕ a sign-in is sent again only once: no answer twice is the network
  no answer as ERR_NETWORK
    ✓ a Google sign-in that heard nothing is sent again, on a new connection, and goes through
    ✓ so are a sign-in with a password, with Apple, and a read
    ✓ a change is not sent again by the app, and the next try goes down a new connection
    ✕ a sign-in is sent again only once: no answer twice is the network

  ● no answer as ECONNABORTED › a sign-in is sent again only once: no answer twice is the network
    expect(jest.fn()).toHaveBeenCalledTimes(expected)
    Expected number of calls: 2
    Received number of calls: 1
    > 112 |     expect(renew).toHaveBeenCalledTimes(2);

Tests:       2 failed, 7 passed, 9 total
```

## Green — with the fix

```
PASS frontend src/shared/services/__tests__/api.deadConnection.test.ts
PASS frontend src/__tests__/integration/authFlow.test.ts
PASS frontend src/features/auth/screens/__tests__/LoginFlow.test.tsx
PASS frontend src/features/auth/utils/__tests__/authErrors.test.ts
PASS frontend src/shared/utils/__tests__/requestError.test.ts
PASS frontend src/features/profile/screens/__tests__/EditProfileScreen.test.tsx
PASS frontend src/features/notifications/screens/__tests__/NotificationsScreenRequestErrors.test.tsx
Tests:       71 passed, 71 total
```

Full frontend suite: 142 suites, 1393 tests passed. `tsc --noEmit` clean.

Wait before the error with a silent server is unchanged: at most two timeouts
(first attempt + one resend); the extra flush adds no request.
