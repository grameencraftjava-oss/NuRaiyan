import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  hashPassword,
  verifyPassword,
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  setAuthCookies,
  clearAuthCookies,
  DUMMY_ARGON2_HASH,
} from '../lib/security';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const registerSchema = z.object({
  username: z
    .string()
    .min(2, 'Username must be at least 2 characters')
    .max(30, 'Username can be at most 30 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Please provide a valid email address'),
  password: z
    .string()
    .min(4, 'Password must be at least 4 characters'),
  displayName: z.string().min(1, 'Please enter your name').max(50, 'Name cannot exceed 50 characters'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  login: z.string().min(1, 'Please enter username or email'),
  password: z.string().min(1, 'Please enter password'),
  deviceName: z.string().optional(),
  deviceType: z.string().optional(),
});

export async function register(req: AuthenticatedRequest, res: Response) {
  try {
    const parse = registerSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        errors: parse.error.flatten().fieldErrors,
      });
    }

    const { username, email, password, displayName, phone } = parse.data;

    // Check uniqueness
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ username }, { email }],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'This username or email is already registered.',
      });
    }

    // Argon2id hashing - enterprise grade
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        phone,
        passwordHash,
        displayName,
        avatarUrl: (req.body.avatarUrl as string) || null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        createdAt: true,
      },
    });

    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Track device session
    await prisma.deviceSession.create({
      data: {
        userId: user.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        deviceType: 'web',
      },
    });

    setAuthCookies(res, accessToken, refreshToken);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully! Welcome 🎉',
      data: { user, accessToken },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'A server error occurred.' });
  }
}

export async function login(req: AuthenticatedRequest, res: Response) {
  try {
    const parse = loginSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        errors: parse.error.flatten().fieldErrors,
      });
    }

    const { login, password, deviceName, deviceType } = parse.data;

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: login.toLowerCase() }, { username: login.toLowerCase() }],
        isActive: true,
        isSuspended: false,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password.',
      });
    }

    const isValidPassword = await verifyPassword(user.passwordHash, password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username/email or password.',
      });
    }


    const accessToken = generateAccessToken({ userId: user.id, role: user.role });
    const refreshToken = generateRefreshToken({ userId: user.id, role: user.role });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    // Update lastSeen & create device session
    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    await prisma.deviceSession.create({
      data: {
        userId: user.id,
        deviceName,
        deviceType: deviceType || 'web',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      },
    });

    setAuthCookies(res, accessToken, refreshToken);

    return res.json({
      success: true,
      message: 'Login successful! 👋',
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          role: user.role,
        },
        accessToken,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'A server error occurred.' });
  }
}

export async function refreshTokenHandler(req: AuthenticatedRequest, res: Response) {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token not found.' });
    }

    const decoded = verifyRefreshToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token.' });
    }

    const savedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!savedToken) {
      return res.status(401).json({ success: false, message: 'Invalid or nonexistent refresh token.' });
    }

    // 🔒 Critical Security: Refresh Token Reuse Detection (RFC 6819)
    // If a token is presented that has ALREADY been revoked, this indicates theft!
    if (savedToken.isRevoked) {
      console.warn(`[SECURITY WARNING] Refresh token reuse detected for userId: ${savedToken.userId}. Invalidating all active sessions.`);
      await prisma.refreshToken.updateMany({
        where: { userId: savedToken.userId },
        data: { isRevoked: true },
      });
      clearAuthCookies(res);
      return res.status(401).json({
        success: false,
        message: 'Security warning: All sessions revoked due to unauthorized token reuse. Please log in again.',
      });
    }

    if (savedToken.expiresAt < new Date()) {
      return res.status(401).json({ success: false, message: 'Token has expired.' });
    }

    // Rotate: revoke old, issue new
    await prisma.refreshToken.update({ where: { token }, data: { isRevoked: true } });

    const newAccessToken = generateAccessToken({ userId: savedToken.user.id, role: savedToken.user.role });
    const newRefreshToken = generateRefreshToken({ userId: savedToken.user.id, role: savedToken.user.role });

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: savedToken.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    setAuthCookies(res, newAccessToken, newRefreshToken);
    return res.json({ success: true, accessToken: newAccessToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

export async function logout(req: AuthenticatedRequest, res: Response) {
  try {
    const token = req.cookies?.refreshToken;
    if (token) {
      await prisma.refreshToken.updateMany({
        where: { token },
        data: { isRevoked: true },
      });
    }
    clearAuthCookies(res);
    return res.json({ success: true, message: 'Logout successful.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Logout failed.' });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true, username: true, email: true, phone: true,
        displayName: true, bio: true, avatarUrl: true, coverUrl: true,
        isVerified: true, isPrivate: true, role: true, twoFactorEnabled: true,
        lastSeenAt: true, createdAt: true,
        _count: {
          select: { followers: true, following: true, posts: true },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
}

export async function getActiveSessions(req: AuthenticatedRequest, res: Response) {
  try {
    const sessions = await prisma.deviceSession.findMany({
      where: { userId: req.user!.userId, isActive: true },
      orderBy: { lastActiveAt: 'desc' },
    });
    return res.json({ success: true, data: sessions });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load session.' });
  }
}

// ── Profile Update (Zero IDOR: Strictly targets req.user.userId) ──
const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  bio: z.string().max(500).optional(),
  avatarUrl: z.string().optional(),
  coverUrl: z.string().optional(),
  isPrivate: z.boolean().optional(),
  worksAt: z.string().max(150).optional().nullable(),
  education: z.string().max(150).optional().nullable(),
  college: z.string().max(150).optional().nullable(),
  school: z.string().max(150).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  hometown: z.string().max(100).optional().nullable(),
  relationship: z.string().max(100).optional().nullable(),
  website: z.string().max(150).optional().nullable(),
});

export async function updateProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const parse = updateProfileSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten().fieldErrors });
    }

    const userId = req.user!.userId;
    const {
      displayName,
      bio,
      avatarUrl,
      coverUrl,
      isPrivate,
      worksAt,
      education,
      college,
      school,
      location,
      hometown,
      relationship,
      website,
    } = parse.data;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(displayName && { displayName }),
        ...(bio !== undefined && { bio }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(coverUrl !== undefined && { coverUrl }),
        ...(isPrivate !== undefined && { isPrivate }),
        ...(worksAt !== undefined && { worksAt }),
        ...(education !== undefined && { education }),
        ...(college !== undefined && { college }),
        ...(school !== undefined && { school }),
        ...(location !== undefined && { location }),
        ...(hometown !== undefined && { hometown }),
        ...(relationship !== undefined && { relationship }),
        ...(website !== undefined && { website }),
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        coverUrl: true,
        isPrivate: true,
        isVerified: true,
        worksAt: true,
        education: true,
        college: true,
        school: true,
        location: true,
        hometown: true,
        relationship: true,
        website: true,
        role: true,
      },
    });

    return res.json({ success: true, message: 'Profile updated successfully!', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
}

// ── Change Password (Re-authenticates current password & purges sessions) ──
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Please enter current password'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
});

export async function changePassword(req: AuthenticatedRequest, res: Response) {
  try {
    const parse = changePasswordSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten().fieldErrors });
    }

    const userId = req.user!.userId;
    const { currentPassword, newPassword } = parse.data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isValid = await verifyPassword(user.passwordHash, currentPassword);
    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
    }

    const newHash = await hashPassword(newPassword);

    // Update password in database
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoke all existing sessions to terminate any unauthorized access on other devices
    await prisma.refreshToken.updateMany({
      where: { userId },
      data: { isRevoked: true },
    });

    // Issue clean new session for current device
    const accessToken = generateAccessToken({ userId, role: user.role });
    const refreshToken = generateRefreshToken({ userId, role: user.role });

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    setAuthCookies(res, accessToken, refreshToken);

    return res.json({
      success: true,
      message: 'Password updated successfully and all other sessions logged out! 🔒',
      accessToken,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update password.' });
  }
}
