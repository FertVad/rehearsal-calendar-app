/**
 * Escaping guards for the two server-rendered HTML pages.
 *
 * Both take values straight from a public, unauthenticated request. The payload
 * that matters most is `</script>`: the HTML parser closes a script element at
 * the first literal occurrence regardless of JavaScript string context, so
 * JSON.stringify on its own is not enough — that exact gap is what these tests
 * pin down.
 */
import { escapeHtml, jsonForScript, assertSafeUrl } from '../../utils/htmlEscape.js';
import { generateCheckoutPageHTML } from '../../routes/native/subscriptions/checkoutPageTemplate.js';

// Assembled at runtime so this file does not itself contain a literal </script>.
const CLOSING_TAG = '</scr' + 'ipt>';
const BREAKOUT = `${CLOSING_TAG}<scr` + `ipt>alert(1)${CLOSING_TAG}`;

const ALLPAY_HOSTS = ['allpay.to', '.allpay.to', 'allpay.co.il', '.allpay.co.il'];

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

describe('assertSafeUrl', () => {
  it('rejects javascript: URLs, which escaping would not help with', () => {
    expect(assertSafeUrl('javascript:alert(1)', ALLPAY_HOSTS)).toBeNull();
  });

  it('rejects hosts outside the allow-list', () => {
    expect(assertSafeUrl('https://evil.com/x', ALLPAY_HOSTS)).toBeNull();
  });

  it('rejects plain http even on an allowed host', () => {
    expect(assertSafeUrl('http://allpay.to/x', ALLPAY_HOSTS)).toBeNull();
  });

  it('rejects a host merely ending in the allowed name', () => {
    expect(assertSafeUrl('https://notallpay.to/x', ALLPAY_HOSTS)).toBeNull();
  });

  it('accepts the real payment host and its subdomains', () => {
    expect(assertSafeUrl('https://allpay.to/pay', ALLPAY_HOSTS)).toBeTruthy();
    expect(assertSafeUrl('https://secure.allpay.to/pay', ALLPAY_HOSTS)).toBeTruthy();
  });

  it('rejects garbage instead of throwing', () => {
    expect(assertSafeUrl('not a url', ALLPAY_HOSTS)).toBeNull();
    expect(assertSafeUrl(undefined, ALLPAY_HOSTS)).toBeNull();
  });
});

describe('checkout page rendering', () => {
  const render = (overrides = {}) =>
    generateCheckoutPageHTML({ paymentUrl: 'https://allpay.to/x', ...overrides });

  it('does not let orderId escape the script block', () => {
    expect(render({ orderId: BREAKOUT })).not.toContain(BREAKOUT);
  });

  it('escapes markup in plan name, amount and currency', () => {
    const html = render({
      planName: '<script>alert(1)</script>',
      amount: '"><img src=x onerror=alert(2)>',
      currency: '<b>USD</b>',
    });
    expect(html).not.toContain('<script>alert(1)');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<b>USD</b>');
  });

  it('ignores an attacker-supplied lang instead of echoing it', () => {
    const html = render({ lang: 'en" onload="alert(1)' });
    expect(html).not.toContain('onload="alert(1)');
    expect(html).toContain('<html lang="en">');
  });

  it('still renders the legitimate values it was given', () => {
    const html = render({ planName: 'Monthly', amount: '9', currency: 'USD', orderId: 'ord-123' });
    expect(html).toContain('Monthly');
    expect(html).toContain('ord-123');
    expect(html).toContain('https://allpay.to/x');
  });
});
