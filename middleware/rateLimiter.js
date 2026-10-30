/**
 * CivicLoop - Tiered In-Memory Rate Limiting & Anti-DDoS Middleware
 * Protects endpoints against brute-force attacks and report flooding.
 * @module middleware/rateLimiter
 */

const { RATE_LIMITS } = require('../config/constants');

/**
 * Creates an in-memory sliding window rate limiter
 * @param {number} maxRequests Maximum requests allowed within window
 * @param {number} windowMs Time window in milliseconds
 * @param {string} customMessage User-facing rejection message
 */
function createRateLimiter(maxRequests, windowMs, customMessage) {
  const ipBuckets = new Map();

  // Garbage collection interval to prevent memory growth
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipBuckets.entries()) {
      if (now - record.startTime > windowMs) {
        ipBuckets.delete(ip);
      }
    }
  }, Math.max(windowMs, 60000));

  return function rateLimitMiddleware(req, res, next) {
    const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';
    const now = Date.now();

    if (!ipBuckets.has(clientIp)) {
      ipBuckets.set(clientIp, { count: 1, startTime: now });
      return next();
    }

    const record = ipBuckets.get(clientIp);

    if (now - record.startTime > windowMs) {
      record.count = 1;
      record.startTime = now;
      return next();
    }

    record.count++;

    // Add standard rate limit headers
    const remaining = Math.max(0, maxRequests - record.count);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil((record.startTime + windowMs) / 1000));

    if (record.count > maxRequests) {
      return res.status(429).json({
        success: false,
        message: customMessage || 'Rate limit exceeded. Please wait a moment before trying again.',
        retryAfterSeconds: Math.ceil((record.startTime + windowMs - now) / 1000)
      });
    }

    next();
  };
}

module.exports = {
  globalApiLimiter: createRateLimiter(RATE_LIMITS.GLOBAL_MAX, RATE_LIMITS.WINDOW_MS, 'Global API request limit reached. Please throttle requests.'),
  submissionLimiter: createRateLimiter(RATE_LIMITS.SUBMISSION_MAX, RATE_LIMITS.WINDOW_MS, 'Anti-Spam Shield: Submission frequency limit reached. Please wait before submitting another report.'),
  mutationLimiter: createRateLimiter(RATE_LIMITS.MUTATION_MAX, RATE_LIMITS.WINDOW_MS, 'Workflow update limit reached. Please slow down status updates.')
};
