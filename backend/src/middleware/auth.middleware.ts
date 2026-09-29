import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, TokenPayload } from '../lib/security';
import { prisma } from '../lib/prisma';

export type AuthenticatedRequest = Request & {
  user?: TokenPayload;
  file?: any;
  files?: any;
  cookies?: any;
};

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  // Check authorization header or HTTP-only cookie
  let token = req.cookies?.accessToken;

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token && token !== 'undefined' && token !== 'null' && token !== '') {
    const payload = verifyAccessToken(token);
    if (payload && payload.userId) {
      // Verify user actually exists in database
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, role: true, isActive: true, isSuspended: true },
      });

      if (user && user.isActive && !user.isSuspended) {
        req.user = payload;
        return next();
      }
    }
  }

  return res.status(401).json({
    success: false,
    message: 'Unauthorized access. Please log in.',
  });
}

export function requireRole(allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized access.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Security error: You do not have permission to perform this action (Forbidden).',
      });
    }
    next();
  };
}

export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token = req.cookies?.accessToken;

  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token && token !== 'undefined' && token !== 'null' && token !== '') {
    const payload = verifyAccessToken(token);
    if (payload && payload.userId) {
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { id: true, role: true, isActive: true, isSuspended: true },
      });

      if (user && user.isActive && !user.isSuspended) {
        req.user = payload;
      }
    }
  }

  return next();
}

export const authMiddleware = requireAuth;

