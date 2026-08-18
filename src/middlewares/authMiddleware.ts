import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { prisma } from '../lib/prisma.js';

export interface AuthenticatedUser {
  id: string;
  email?: string | null;
  phoneNumber?: string | null;
  roles: string[];
  verificationStatus: string;
  isActive: boolean;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function generateToken(payload: { id: string; email?: string | null; phoneNumber?: string | null; roles: string[] }): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn as any,
  });
}

/**
 * Middleware: Verify Bearer JWT Token
 */
export async function verifyBearerToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Akses ditolak. Token Bearer tidak ditemukan pada header Authorization.',
    });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { id: string; roles?: string[] };

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        roles: true,
        verificationStatus: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        message: 'Sesi tidak valid atau akun pengguna telah dinonaktifkan.',
      });
      return;
    }

    req.user = user;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: 'Token telah kedaluwarsa. Silakan masuk kembali.',
      });
      return;
    }
    res.status(401).json({
      success: false,
      message: 'Token otentikasi tidak valid.',
    });
  }
}

/**
 * Middleware: Optional Bearer Auth (does not reject if missing)
 */
export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as { id: string };
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        roles: true,
        verificationStatus: true,
        isActive: true,
      },
    });
    if (user && user.isActive) {
      req.user = user;
    }
  } catch {
    // Ignore invalid token on optional auth
  }
  next();
}

/**
 * Middleware: Require specific role (e.g. 'admin', 'moderator', 'seller')
 */
export function requireRole(...requiredRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
      return;
    }

    const hasRole = req.user.roles.some((role) => requiredRoles.includes(role) || role === 'super_admin');
    if (!hasRole) {
      res.status(403).json({
        success: false,
        message: 'Akses ditolak. Anda tidak memiliki hak akses yang sesuai untuk tindakan ini.',
      });
      return;
    }

    next();
  };
}

/**
 * Middleware: Require verified alumni status ('approved')
 */
export function requireVerified(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ success: false, message: 'Autentikasi diperlukan.' });
    return;
  }

  if (req.user.verificationStatus !== 'approved' && !req.user.roles.includes('admin')) {
    res.status(403).json({
      success: false,
      message: 'Fitur ini hanya dapat diakses oleh alumni SMAN 59 yang telah terverifikasi.',
    });
    return;
  }

  next();
}
