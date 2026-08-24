/**
 * HTML escaping for server-rendered pages.
 *
 * The invite landing page is the only route that returns HTML built from
 * request values, but it interpolates them straight into the markup, so
 * anything reaching a template must go through here.
 *
 * Pick by context, not habit:
 *   - text and attribute values  → escapeHtml()
 *   - inside a <script> block    → jsonForScript()
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
