/**
 * HTML escaping for server-rendered pages.
 *
 * Only a handful of routes return HTML (the AllPay checkout wrapper and the
 * invite landing page), but both interpolate values straight from the request,
 * so anything reaching a template must go through here.
 *
 * Pick by context, not habit:
 *   - text and attribute values  → escapeHtml()
 *   - inside a <script> block    → jsonForScript()
 *   - a URL used as href/src     → assertSafeUrl(), because escaping does
 *                                  nothing about `javascript:`
 */

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Escape a value for use in HTML text or a quoted attribute.
 * Nullish becomes an empty string so callers can keep using `|| 'default'`.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
}

/**
 * Serialise a value for embedding inside an inline <script> block.
 *
 * `JSON.stringify` alone is NOT enough here. The HTML parser closes the script
 * element at the first literal `</script>`, whatever the JavaScript context —
 * so a value of `</script><script>alert(1)</script>` breaks out even though it
 * sits inside a quoted string. Escaping `<` as `<` keeps the parser out of
 * it while JavaScript still decodes the original character.
 *
 * U+2028/U+2029 are also escaped: they are valid JSON but were illegal inside
 * JavaScript string literals before ES2019.
 *
 * @param {unknown} value
 * @returns {string} a JavaScript literal safe to paste into a script block
 */
export function jsonForScript(value) {
  return JSON.stringify(value === undefined ? null : value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/**
 * Validate a URL destined for an iframe `src` or a link `href`.
 *
 * Escaping cannot make `javascript:alert(1)` safe — the scheme itself is the
 * problem — so untrusted URLs are checked against a scheme and host allow-list
 * instead.
 *
 * @param {unknown} value - candidate URL
 * @param {string[]} allowedHosts - exact hostnames, or ".example.com" to allow subdomains
 * @returns {string|null} the URL when acceptable, otherwise null
 */
export function assertSafeUrl(value, allowedHosts = []) {
  if (!value) return null;

  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:') return null;

  const host = parsed.hostname.toLowerCase();
  const allowed = allowedHosts.some((entry) => {
    const candidate = entry.toLowerCase();
    return candidate.startsWith('.')
      ? host === candidate.slice(1) || host.endsWith(candidate)
      : host === candidate;
  });

  return allowed ? parsed.toString() : null;
}
