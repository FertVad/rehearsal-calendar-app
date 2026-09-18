import { escapeHtml } from '../../utils/htmlEscape.js';

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
