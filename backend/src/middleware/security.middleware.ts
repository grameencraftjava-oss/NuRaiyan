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
  if (!origin || origin === 'null') return true;
  if (ENV.CLIENT_URL === '*') return true;

  // Allow mobile apps, extensions, webviews, and local environments
  if (
    origin.startsWith('capacitor://') ||
    origin.startsWith('ionic://') ||
    origin.startsWith('file://') ||
    origin.startsWith('http://localhost') ||
    origin.startsWith('https://localhost') ||
    origin.startsWith('http://127.0.0.1') ||
    origin.startsWith('https://127.0.0.1') ||
    origin.startsWith('http://192.168.') ||
    origin.startsWith('http://10.')
  ) {
    return true;
  }

  try {
    const parsed = new URL(origin.startsWith('http') ? origin : `http://${origin}`);
    const hostname = parsed.hostname.toLowerCase();

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.vercel.app') ||
      hostname.endsWith('.onrender.com') ||
      hostname.endsWith('nuraiyan.com')
    ) {
      return true;
    }
  } catch {
    // If URL parsing fails, check substring matches safely
    if (origin.includes('.vercel.app') || origin.includes('.onrender.com')) {
      return true;
    }
  }

  const configured = (ENV.CLIENT_URL || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (configured.length > 0) {
    return configured.some((allowed) => origin.toLowerCase().includes(allowed));
  }

  return true;
}

// 2. CSRF & Origin Guard for Mutating Requests
export function csrfOriginGuard(req: Request, res: Response, next: NextFunction) {
  const mutatingMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
  if (!mutatingMethods.includes(req.method)) {
    return next();
  }

  // Mobile apps, Bearer auth requests, or server-to-server requests are always authorized
  if (req.headers.authorization || req.headers['x-access-token']) {
    return next();
  }

  const origin = req.headers.origin || req.headers.referer;
  if (!origin) {
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
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}
