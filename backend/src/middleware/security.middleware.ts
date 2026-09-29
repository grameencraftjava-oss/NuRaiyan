import { Request, Response, NextFunction } from 'express';
import { ENV } from '../config/env';

// 1. Recursive String Sanitizer (XSS & Injection Protection)
function sanitizeValue(val: any): any {
  if (typeof val === 'string') {
    // Strip malicious script tags, event handlers, and javascript: protocols
    return val
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .trim();
  }
  if (Array.isArray(val)) {
    return val.map(sanitizeValue);
  }
  if (val !== null && typeof val === 'object') {
    const cleanObj: Record<string, any> = {};
    for (const key of Object.keys(val)) {
      // Prevent Prototype Pollution & NoSQL Injection:
      if (
        key === '__proto__' ||
        key === 'constructor' ||
        key === 'prototype' ||
        key.startsWith('$') ||
        key.includes('.')
      ) {
        continue;
      }
      cleanObj[key] = sanitizeValue(val[key]);
    }
    return cleanObj;
  }
  return val;
}

export function sanitizeInputMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.body) {
      req.body = sanitizeValue(req.body);
    }
    if (req.query) {
      req.query = sanitizeValue(req.query);
    }
    if (req.params) {
      req.params = sanitizeValue(req.params);
    }
    next();
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: 'Malformed request payload.',
    });
  }
}

export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  if (ENV.NODE_ENV !== 'production') return true;
  if (ENV.CLIENT_URL === '*') return true;

  const configured = (ENV.CLIENT_URL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const defaultAllowed = [
    ...configured,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://nuraiyan.com',
  ];

  return defaultAllowed.some((allowed) => {
    if (!allowed) return false;
    return origin === allowed || origin.startsWith(allowed) || origin.endsWith('.vercel.app');
  });
}


// 2. CSRF & Origin Guard for Mutating Requests
export function csrfOriginGuard(req: Request, res: Response, next: NextFunction) {
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!mutatingMethods.includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin || req.headers.referer;
  if (!origin) {
    // In strict production, allow requests if mobile/bearer token present or non-browser
    if (ENV.NODE_ENV === 'production' && !req.headers.authorization) {
      return res.status(403).json({
        success: false,
        message: 'Security error: Origin could not be verified (Forbidden Origin).',
      });
    }
    return next();
  }

  if (!isAllowedOrigin(origin) && ENV.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      message: 'Request from untrusted origin rejected.',
    });
  }

  next();
}

// 3. Security Headers Enforcer
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(), interest-cohort=()'
  );
  next();
}
