import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { ENV } from '../../config/env.js';
import { AppError } from '../../middleware/errorHandler.js';
import { authenticate, recordAudit } from '../../middleware/auth.js';
import { getEffectivePermissionsForUser } from '../rbac/rbac.service.js';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required')
});

authRouter.post('/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username },
          { email: username }
        ]
      },
      include: {
        company: true,
        userRoles: {
          include: {
            role: true
          }
        },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            workEmail: true,
            departmentId: true,
            branchId: true,
            designationId: true
          }
        }
      }
    });

    if (!user || !user.active) {
      throw new AppError('Invalid username or password', 401, 'INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Invalid username or password', 401, 'INVALID_CREDENTIALS');
    }

    // Generate unique active session ID
    const sessionId = crypto.randomUUID();

    // Update lastLoginAt and activeSessionId (invalidating any prior active session)
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lastLoginAt: new Date(),
        activeSessionId: sessionId
      }
    });

    const token = jwt.sign(
      {
        userId: user.id,
        companyId: user.companyId,
        username: user.username,
        sessionId
      },
      ENV.JWT_SECRET,
      { expiresIn: '12h' }
    );

    const roles = user.userRoles.map(ur => ur.role.name);
    const primaryRole = roles[0] ?? 'employee';
    const permissions = await getEffectivePermissionsForUser(user.id);

    // Audit log
    await prisma.auditLog.create({
      data: {
        companyId: user.companyId,
        userId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: user.id,
        metadata: { username: user.username, roles },
        ipAddress: req.ip ?? req.socket.remoteAddress
      }
    });

    res.status(200).json({
      token,
      user: {
        id: user.id,
        companyId: user.companyId,
        companyName: user.company.name,
        companyBrand: user.company.brandName ?? user.company.name,
        companyCode: user.company.code,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        roles,
        primaryRole,
        permissions,
        employee: user.employee
      }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      include: {
        company: true,
        userRoles: {
          include: {
            role: true
          }
        },
        employee: {
          include: {
            department: true,
            designation: true,
            branch: true
          }
        }
      }
    });

    if (!user) {
      throw new AppError('User not found', 404, 'NOT_FOUND');
    }

    const roles = user.userRoles.map(ur => ur.role.name);
    const permissions = req.user?.permissions || await getEffectivePermissionsForUser(user.id);

    res.status(200).json({
      user: {
        id: user.id,
        companyId: user.companyId,
        companyName: user.company.name,
        companyBrand: user.company.brandName ?? user.company.name,
        companyCode: user.company.code,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        roles,
        primaryRole: roles[0] ?? 'employee',
        permissions,
        employee: user.employee
      }
    });
  } catch (error) {
    next(error);
  }
});

authRouter.post('/logout', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (req.user?.userId) {
      await prisma.user.update({
        where: { id: req.user.userId },
        data: { activeSessionId: null }
      });
    }
    await recordAudit(req, 'LOGOUT', 'User', req.user!.userId);
    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});
