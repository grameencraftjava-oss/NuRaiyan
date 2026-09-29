import rateLimit from 'express-rate-limit';

// General API rate limiter: generous limits to support active real-time social networking
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50000,
  skip: (req) => {
    const ip = req.ip || req.socket?.remoteAddress || '';
    return (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.includes('localhost') ||
      process.env.NODE_ENV !== 'production'
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again shortly.',
  },
});

// Strict limiter for Auth routes (Login, Register): 15 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Account temporarily locked due to repeated failed attempts. Please try again in 15 minutes.',
  },
});

// Targeted Brute-Force Shield for login: 5 failed attempts locks for 15 mins
export const loginBruteForceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true, // Successful logins reset or are never counted
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Security alert: Login blocked for 15 minutes due to 5 incorrect password attempts.',
  },
});

// Post creation limiter: 30 posts per 10 minutes (Anti-spam)
export const postLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'You are posting too fast! Please slow down.',
  },
});
