import { useCallback, useRef } from 'react';

/** A key the server takes (services/idempotency.js): 16–100 of [A-Za-z0-9_-]. */
export function newIdempotencyKey(): string {
  const part = () => Math.random().toString(36).slice(2, 12).padEnd(10, '0');
  return `${Date.now().toString(36)}-${part()}-${part()}`;
}

/**
 * The Idempotency-Key a create form sends (R4, cause fix 10: B02, D03).
 *
 * A create whose answer was lost — a timeout, a dropped connection — reads as
 * a failure, and the user taps again. Each tap used to make another project or
 * rehearsal. Now a tap sends the key of the request it repeats: the same
 * request as the last attempt keeps its key, so the server answers with what
 * the first one made; a changed request is a new create and gets a new key.
 * `settle` after success: the next create on a form left open is a new one,
 * even if it asks for the same.
 */
export function useIdempotencyKey() {
  const last = useRef<{ request: string; key: string } | null>(null);

  const keyFor = useCallback((request: unknown): string => {
    const asked = JSON.stringify(request);
    if (last.current?.request !== asked) {
      last.current = { request: asked, key: newIdempotencyKey() };
    }
    return last.current.key;
  }, []);

  const settle = useCallback(() => {
    last.current = null;
  }, []);

  return { keyFor, settle };
}
