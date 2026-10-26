import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { ALL_SYSTEM_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, getEffectivePermissionsForUser } from './rbac.service.js';

export const rbacRouter = Router();

// 1. Get System Permissions Dictionary
rbacRouter.get('/permissions', authenticate, async (_req: Request, res: Response, _next: NextFunction): Promise<void> => {
  res.status(200).json({
    permissions: ALL_SYSTEM_PERMISSIONS
  });
});

// 2. Get Caller's Effective Permissions
rbacRouter.get('/me/permissions', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const permissions = await getEffectivePermissionsForUser(req.user!.userId);
    res.status(200).json({
      userId: req.user!.userId,
      roles: req.user!.roles,
      permissions
    });
  } catch (error) {
    next(error);
  }
});

// 3. List Roles & Assigned Permissions (Admin only)
rbacRouter.get('/roles', authenticate, requireRole(['company_admin', 'platform_admin']), async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const roles = await prisma.role.findMany({
      include: {
        _count: {
          select: { userRoles: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    const enrichedRoles = roles.map(r => {
      const activePermissions = r.permissions && r.permissions.length > 0
        ? r.permissions
        : (DEFAULT_ROLE_PERMISSIONS[r.name] || []);
      return {
        id: r.id,
        name: r.name,
        description: r.description,
        permissions: activePermissions,
        userCount: r._count.userRoles,
        createdAt: r.createdAt
      };
    });

    res.status(200).json({ roles: enrichedRoles });
  } catch (error) {
    next(error);
  }
});

// 4. Update Role Permissions (Admin only) - Supports PUT and PATCH
const updateRolePermissionsHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id } = req.params;
    const schema = z.object({
      permissions: z.array(z.string())
    });
    const { permissions } = schema.parse(req.body);

    const role = await prisma.role.findUnique({ where: { id: String(id) } });
    if (!role) {
      throw new AppError('Role not found', 404);
    }

    // Safety: Non-platform admins cannot alter platform_admin role
    if (role.name === 'platform_admin' && !req.user!.roles.includes('platform_admin')) {
      throw new AppError('Only Platform Administrators can alter platform_admin permissions', 403);
    }

    // Validate that all permissions exist in the system dictionary
    const validKeys = new Set(ALL_SYSTEM_PERMISSIONS.map(p => p.key));
    const invalid = permissions.filter(p => !validKeys.has(p));
    if (invalid.length > 0) {
      throw new AppError(`Invalid permissions specified: ${invalid.join(', ')}`, 400);
    }

    const updated = await prisma.role.update({
      where: { id: role.id },
      data: { permissions }
    });

    await recordAudit(req, 'UPDATE_ROLE_PERMISSIONS', 'Role', role.id, {
      roleName: role.name,
      permissionCount: permissions.length
    });

    res.status(200).json({
      role: updated,
      message: `Permissions updated successfully for role '${role.name}'.`
    });
  } catch (error) {
    next(error);
  }
};

rbacRouter.put('/roles/:id/permissions', authenticate, requireRole(['company_admin', 'platform_admin']), updateRolePermissionsHandler);
rbacRouter.patch('/roles/:id/permissions', authenticate, requireRole(['company_admin', 'platform_admin']), updateRolePermissionsHandler);
