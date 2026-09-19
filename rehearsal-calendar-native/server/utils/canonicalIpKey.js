import { isIP } from 'node:net';
import { ipKeyGenerator } from 'express-rate-limit';

// Shared identity only: callers retain their existing HMAC namespaces. In
// particular, extracting this helper must not change B04's persisted digests.
export function canonicalIpKey(ip) {
  if (typeof ip !== 'string' || !isIP(ip) || ip.includes('%')) {
    throw new Error('IP budget requires a valid IP address');
  }
  let canonical = ip;
  if (isIP(ip) === 6) {
    canonical = new URL(`http://[${ip}]/`).hostname.slice(1, -1);
    // Normalize hexadecimal and dotted IPv4-mapped IPv6 to the same IPv4 key.
    const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(canonical);
    if (mapped) {
      const high = Number.parseInt(mapped[1], 16);
      const low = Number.parseInt(mapped[2], 16);
      canonical = [high >>> 8, high & 255, low >>> 8, low & 255].join('.');
    }
  }
  return ipKeyGenerator(canonical, 56);
}
