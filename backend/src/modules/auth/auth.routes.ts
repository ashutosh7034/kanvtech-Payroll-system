import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { ENV } from '../../config/env.js';
import { AppError } from '../../middleware/errorHandler.js';
import { authenticate, recordAudit } from '../../middleware/auth.js';

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
        institution: true,
        userRoles: {
          include: {
            role: true,
            ou: true
          }
        },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            email: true,
            ouId: true,
            departmentId: true
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

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    const token = jwt.sign(
      {
        userId: user.id,
        institutionId: user.institutionId,
        username: user.username
      },
      ENV.JWT_SECRET,
      { expiresIn: '12h' }
    );

    const roles = user.userRoles.map(ur => ur.role.code);
    const primaryRole = roles[0] ?? 'employee_self_service';

    // Audit log
    await prisma.auditLog.create({
      data: {
        institutionId: user.institutionId,
        userId: user.id,
        action: 'LOGIN',
        entityType: 'User',
        entityId: user.id,
        details: { username: user.username, roles },
        ipAddress: req.ip ?? req.socket.remoteAddress
      }
    });

    res.status(200).json({
      token,
      user: {
        id: user.id,
        institutionId: user.institutionId,
        institutionName: user.institution.name,
        institutionBrand: user.institution.brandName ?? user.institution.name,
        institutionLogo: user.institution.logoUrl,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        roles,
        primaryRole,
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
        institution: true,
        userRoles: {
          include: {
            role: true,
            ou: true
          }
        },
        employee: {
          include: {
            designation: true,
            department: true,
            ou: true
          }
        }
      }
    });

    if (!user) {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    res.status(200).json({
      user: {
        id: user.id,
        institutionId: user.institutionId,
        institutionName: user.institution.name,
        institutionBrand: user.institution.brandName ?? user.institution.name,
        institutionLogo: user.institution.logoUrl,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        roles: user.userRoles.map(ur => ur.role.code),
        scopedOus: user.userRoles.map(ur => ur.ou).filter(Boolean),
        employee: user.employee
      }
    });
  } catch (error) {
    next(error);
  }
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6, 'Password must be at least 6 characters')
});

authRouter.post('/change-password', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId }
    });

    if (!user) throw new AppError('User not found', 404);

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError('Current password does not match', 400, 'PASSWORD_MISMATCH');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash }
    });

    await recordAudit(req, 'CHANGE_PASSWORD', 'User', user.id);

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
});
