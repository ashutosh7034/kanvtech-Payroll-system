import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { prisma } from '../config/db.js';
import { AppError } from './errorHandler.js';

export interface AuthenticatedUser {
  userId: string;
  institutionId: string;
  username: string;
  fullName: string;
  employeeId?: string | null;
  roles: string[];
  scopedOuIds: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Authentication token required', 401, 'UNAUTHORIZED');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as {
      userId: string;
      institutionId: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        userRoles: {
          include: {
            role: true,
            ou: true
          }
        }
      }
    });

    if (!user || !user.active) {
      throw new AppError('User not found or account deactivated', 401, 'UNAUTHORIZED');
    }

    const roles = user.userRoles.map(ur => ur.role.code);
    const scopedOuIds = user.userRoles
      .map(ur => ur.ouId)
      .filter((ouId): ouId is string => Boolean(ouId));

    req.user = {
      userId: user.id,
      institutionId: user.institutionId,
      username: user.username,
      fullName: user.fullName,
      employeeId: user.employeeId,
      roles,
      scopedOuIds
    };

    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      next(new AppError('Invalid or expired authentication token', 401, 'INVALID_TOKEN'));
      return;
    }
    next(error);
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
      return;
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
    if (!hasRole && !req.user.roles.includes('payroll_admin') && !req.user.roles.includes('platform_admin')) {
      next(new AppError(`Access denied. Requires one of roles: ${allowedRoles.join(', ')}`, 403, 'FORBIDDEN'));
      return;
    }

    next();
  };
}

export async function recordAudit(
  req: Request,
  action: string,
  entityType: string,
  entityId?: string | null,
  details?: any
): Promise<void> {
  try {
    if (!req.user) return;
    await prisma.auditLog.create({
      data: {
        institutionId: req.user.institutionId,
        userId: req.user.userId,
        action,
        entityType,
        entityId: entityId ?? null,
        details: details ?? {},
        ipAddress: req.ip ?? req.socket.remoteAddress
      }
    });
  } catch (e) {
    console.error('Audit logging failed:', e);
  }
}
