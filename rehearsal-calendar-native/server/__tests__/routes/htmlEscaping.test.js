/**
 * Escaping guards for the server-rendered invite page.
 *
 * It takes values straight from a public, unauthenticated request. The payload
 * that matters most is `</script>`: the HTML parser closes a script element at
 * the first literal occurrence regardless of JavaScript string context, so
 * JSON.stringify on its own is not enough — that exact gap is what these tests
 * pin down.
 */
import { escapeHtml, jsonForScript } from '../../utils/htmlEscape.js';

// Assembled at runtime so this file does not itself contain a literal </script>.
const CLOSING_TAG = '</scr' + 'ipt>';
const BREAKOUT = `${CLOSING_TAG}<scr` + `ipt>alert(1)${CLOSING_TAG}`;

describe('escapeHtml', () => {
  it('neutralises tag and attribute delimiters', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    expect(escapeHtml('" onload="x')).toBe('&quot; onload=&quot;x');
    expect(escapeHtml("' onerror='x")).toBe('&#39; onerror=&#39;x');
  });

  it('escapes ampersands before anything else, without double-encoding', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml('<')).toBe('&lt;');
  });

  it('renders nullish as an empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('jsonForScript', () => {
  it('prevents a </script> breakout', () => {
    expect(jsonForScript(BREAKOUT)).not.toContain(CLOSING_TAG);
  });

  it('keeps the value intact once JavaScript decodes it', () => {
    // eslint-disable-next-line no-eval
    expect(eval(jsonForScript(BREAKOUT))).toBe(BREAKOUT);
  });

  it('quotes values so a stray apostrophe cannot terminate the literal', () => {
    const out = jsonForScript("';alert(1);//");
    expect(out.startsWith('"')).toBe(true);
    // eslint-disable-next-line no-eval
    expect(eval(out)).toBe("';alert(1);//");
  });

  it('serialises null for undefined rather than emitting bare undefined', () => {
    expect(jsonForScript(undefined)).toBe('null');
  });
});
