# Asynchronous HTTP errors (Express 4)

Wrap every asynchronous route or middleware with `asyncHandler` at its definition
or registration. Return/await all work that belongs to that request:

```js
router.get('/example', requireAuth, asyncHandler(async (req, res) => {
  const value = await service.read(req.userId);
  res.json(value);
}));
```

`authenticateToken` / `requireAuth` and `adminLogin` already include the boundary.
The wrapper forwards thrown errors and rejected promises to `next(error)`;
it does not automatically advance the chain on success or rethrow after forwarding.
It cannot observe detached timers, callbacks or unreturned background promises.

Keep deliberate business responses (401/403/404, known validation errors) where
the contract is known. Unexpected DB/crypto failures must not be reported as bad
credentials. Validate request types before property access, expensive work or
writes. Do not turn partial data operations into success in an error handler.

The final `errorHandler` is mounted after routes. It emits safe generic JSON,
preserves parser 4xx status codes, and delegates when headers are already sent.
It does not send SQL, stack traces or request bodies to the client or its own log.
Existing local route catches keep their current contracts; this is not a claim
that all application validation and logging findings have been resolved.

Ordinary `npm test` includes `asyncRoutes.test.js`, which traverses the actual
mounted Express stack (including aliases) and rejects bare async callbacks.
Promise-returning non-async callbacks also need the wrapper even though they
cannot be identified by that structural guard. `authFailure`, `asyncBoundary`
and `errorHttp` tests cover rejection forwarding, safe responses and recovery.
The `postgres-a02` CI job exercises the real PostgreSQL adapter in a disposable
database; see `__tests__/postgres/README.md` for the local command and boundaries.
