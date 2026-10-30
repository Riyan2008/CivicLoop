/**
 * CivicLoop - Enterprise Security Defense Middleware
 * Implements Helmet headers, timing-safe auth, XSS stripping, and prototype pollution guards.
 * @module middleware/security
 */

const crypto = require('crypto');
const helmet = require('helmet');
const { WORKER_SECRET } = require('../config/constants');

/**
 * Configure Helmet with customized CSP to permit Tailwind CDN & Google Fonts
 */
const helmetMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.tailwindcss.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https://images.unsplash.com', 'https://*.basemaps.cartocdn.com'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false
});

/**
 * Timing-safe string comparison to prevent side-channel timing attacks
 * @param {string} a 
 * @param {string} b 
 * @returns {boolean}
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Role-Based Municipal Worker Authentication Guard
 * Protects administrative workflow transitions (PATCH /api/reports/:id/status)
 */
function requireWorkerAuth(req, res, next) {
  const workerKey = req.headers['x-worker-key'];

  if (!workerKey) {
    return res.status(401).json({
      success: false,
      message: 'Security Alert: Valid municipal field worker credentials (X-Worker-Key) required.'
    });
  }

  if (!safeEqual(workerKey, WORKER_SECRET)) {
    return res.status(403).json({
      success: false,
      message: 'Access Denied: Invalid municipal worker security key.'
    });
  }

  next();
}

/**
 * Strict Input Sanitization to strip potential XSS & script injection
 * @param {string} str Input string
 * @param {number} maxLen Maximum allowable length
 * @returns {string} Sanitized string
 */
function sanitizeInput(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[<>]/g, '') // Strip HTML tags
    .replace(/javascript:/gi, '') // Strip javascript: pseudo-protocol
    .trim()
    .slice(0, maxLen);
}

/**
 * Prototype Pollution Defense Middleware
 * Prevents malicious injection into Object.prototype
 */
function preventPrototypePollution(req, res, next) {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return;
    delete obj['__proto__'];
    delete obj['constructor'];
    delete obj['prototype'];
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'object') sanitize(obj[key]);
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  next();
}

/**
 * HTTP Parameter Pollution (HPP) Guard
 * Normalizes repeated query parameters to single strings
 */
function preventParameterPollution(req, res, next) {
  if (req.query) {
    for (const key of Object.keys(req.query)) {
      if (Array.isArray(req.query[key])) {
        req.query[key] = req.query[key][0]; // Pick first value
      }
    }
  }
  next();
}

module.exports = {
  helmetMiddleware,
  requireWorkerAuth,
  sanitizeInput,
  safeEqual,
  preventPrototypePollution,
  preventParameterPollution
};
