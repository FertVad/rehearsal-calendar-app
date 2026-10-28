// Express 4 does not consume returned promises. Every async HTTP callback must
// enter this boundary; detached background work needs its own error handling.
export function asyncHandler(handler) {
  return function asyncRequestHandler(req, res, next) {
    return Promise.resolve()
      .then(() => handler.call(this, req, res, next))
      .catch(reason => {
        // Falsy values and Express's 'route'/'router' sentinels must never turn
        // a rejection into successful middleware continuation.
        const error = reason instanceof Error
          ? reason
          : new Error('Async request handler rejected with a non-Error value', { cause: reason });
        next(error);
      });
  };
}
