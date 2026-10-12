/**
 * BankSim In-Memory Sliding-Window Rate Limiter
 * Guards API endpoints against automated flooding and brute-force attacks.
 * Automatic memory cleanup ensures no memory leaks from inactive client IPs.
 */

class SlidingWindowRateLimiter {
  constructor(windowMs = 60000, maxRequests = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.clients = new Map();

    // Periodic sweep every 2 minutes to prune stale IPs from memory
    this.cleanupTimer = setInterval(() => this.cleanup(), 120000);
    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref();
    }
  }

  cleanup() {
    const cutoff = Date.now() - this.windowMs;
    for (const [ip, timestamps] of this.clients.entries()) {
      const valid = timestamps.filter(ts => ts > cutoff);
      if (valid.length === 0) {
        this.clients.delete(ip);
      } else {
        this.clients.set(ip, valid);
      }
    }
  }

  isAllowed(ip) {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const timestamps = this.clients.get(ip) || [];

    // Filter out timestamps outside current sliding window
    const recent = timestamps.filter(ts => ts > cutoff);

    if (recent.length >= this.maxRequests) {
      return {
        allowed: false,
        retryAfterSec: Math.ceil((recent[0] + this.windowMs - now) / 1000),
        remaining: 0
      };
    }

    recent.push(now);
    this.clients.set(ip, recent);

    return {
      allowed: true,
      remaining: this.maxRequests - recent.length
    };
  }

  reset() {
    this.clients.clear();
  }
}

// 120 requests per minute for firewall analysis endpoints
const limiterInstance = new SlidingWindowRateLimiter(60000, 120);

export function rateLimiter(req, res, next) {
  // Allow unrestricted testing during automated test suites
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  const check = limiterInstance.isAllowed(clientIp);

  res.setHeader('X-RateLimit-Limit', '120');
  res.setHeader('X-RateLimit-Remaining', String(check.remaining || 0));

  if (!check.allowed) {
    res.setHeader('Retry-After', String(check.retryAfterSec || 1));
    return res.status(429).json({
      status: 'BLOCKED',
      risk_score: 85,
      threat_category: 'RATE_LIMIT_EXCEEDED',
      explanation: `Too many requests from this address. Rate limit exceeded. Please retry after ${check.retryAfterSec} seconds.`,
      intent: 'UNKNOWN',
      transaction_allowed: false
    });
  }

  next();
}

export { limiterInstance };
