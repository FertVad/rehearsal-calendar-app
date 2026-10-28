import crypto from 'node:crypto';
import helmet from 'helmet';

// Keep this middleware free of startup/database side effects so HTTP tests can
// exercise exactly the policy used by the running server.
export const securityHeaders = [
  (_req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
  },
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Public/admin scripts and styles are same-origin assets. The nonce
        // remains available for explicitly authorized script elements.
        scriptSrc: ["'self'", (_req, res) => `'nonce-${res.locals.cspNonce}'`],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  }),
];
