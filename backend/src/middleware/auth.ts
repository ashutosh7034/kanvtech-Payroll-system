import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { prisma } from '../config/db.js';
import { AppError } from './errorHandler.js';
import { getEffectivePermissionsForUser } from '../modules/rbac/rbac.service.js';

export interface AuthenticatedUser {
  userId: string;
  companyId: string;
  username: string;
  email: string;
  fullName: string;
  employeeId?: string | null;
  roles: string[];
  permissions: string[];
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
      companyId: string;
      sessionId?: string;
    };

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        userRoles: {
          include: {
            role: true
          }
        }
      }
    });

    if (!user || !user.active) {
      throw new AppError('User not found or account deactivated', 401, 'UNAUTHORIZED');
    }

    if (user.activeSessionId || decoded.sessionId) {
      if (!decoded.sessionId || !user.activeSessionId || user.activeSessionId !== decoded.sessionId) {
        throw new AppError('Session has been revoked or superseded by another login', 401, 'SESSION_REVOKED');
      }
    }

    const roles = user.userRoles.map(ur => ur.role.name);
    const permissions = await getEffectivePermissionsForUser(user.id);

    req.user = {
      userId: user.id,
      companyId: user.companyId,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      employeeId: user.employeeId,
      roles,
      permissions
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
    if (!hasRole && !req.user.roles.includes('company_admin') && !req.user.roles.includes('platform_admin')) {
      next(new AppError(`Access denied. Requires one of roles: ${allowedRoles.join(', ')}`, 403, 'FORBIDDEN'));
      return;
    }

    next();
  };
}

export function requirePermission(required: string | string[]) {
  const reqList = Array.isArray(required) ? required : [required];
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
      return;
    }

    if (req.user.roles.includes('company_admin') || req.user.roles.includes('platform_admin')) {
      next();
      return;
    }

    const userPerms = new Set(req.user.permissions || []);
    const hasPerm = reqList.some(p => userPerms.has(p));
    if (!hasPerm) {
      next(new AppError(`Access denied. Missing required permission: ${reqList.join(' or ')}`, 403, 'FORBIDDEN'));
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
  metadata?: any
): Promise<void> {
  try {
    if (!req.user) return;
    await prisma.auditLog.create({
      data: {
        companyId: req.user.companyId,
        userId: req.user.userId,
        action,
        entityType,
        entityId: entityId ?? null,
        metadata: metadata ?? {},
        ipAddress: req.ip ?? req.socket.remoteAddress
      }
    });
  } catch (e) {
    console.error('Audit logging failed:', e);
  }
}
