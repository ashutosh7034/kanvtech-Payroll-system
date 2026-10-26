import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const assetRouter = Router();

// List Assets
assetRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const assets = await prisma.companyAsset.findMany({
      where: { companyId: req.user!.companyId },
      include: {
        allocations: {
          include: {
            employee: { select: { id: true, employeeCode: true, firstName: true, lastName: true, department: true } }
          },
          orderBy: { allocatedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.status(200).json({ assets });
  } catch (error) {
    next(error);
  }
});

const requireAssetManager = (permission: 'asset:create' | 'asset:allocate') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
      return;
    }
    const hasAllowedRole = req.user.roles.some(r => ['company_admin', 'asset_manager', 'platform_admin'].includes(r));
    const hasExplicitPerm = req.user.permissions?.includes(permission);
    if (!hasAllowedRole && !hasExplicitPerm) {
      next(new AppError('Access denied. Requires one of roles: company_admin, asset_manager', 403, 'FORBIDDEN'));
      return;
    }
    next();
  };
};

// Create Asset
assetRouter.post('/', authenticate, requireAssetManager('asset:create'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      assetTag: z.string().min(1),
      name: z.string().min(1),
      category: z.enum(['LAPTOP', 'DESKTOP', 'MOBILE', 'MONITOR', 'ACCESS_CARD', 'VEHICLE', 'OTHER']),
      serialNumber: z.string().optional(),
      condition: z.enum(['NEW', 'GOOD', 'DAMAGED', 'LOST']).default('NEW')
    });
    const data = schema.parse(req.body);

    const asset = await prisma.companyAsset.create({
      data: {
        companyId: req.user!.companyId,
        assetTag: data.assetTag,
        name: data.name,
        category: data.category as any,
        serialNumber: data.serialNumber,
        condition: data.condition as any
      }
    });

    await recordAudit(req, 'CREATE_ASSET', 'CompanyAsset', asset.id, data);
    res.status(201).json({ asset });
  } catch (error) {
    next(error);
  }
});

// Allocate Asset to Employee
assetRouter.post('/:id/allocate', authenticate, requireAssetManager('asset:allocate'), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const schema = z.object({
      employeeId: z.string().min(1)
    });
    const { employeeId } = schema.parse(req.body);

    const asset = await prisma.companyAsset.findUnique({ where: { id: String(req.params.id) } });
    if (!asset) throw new AppError('Asset not found', 404);

    const allocation = await prisma.assetAllocation.create({
      data: {
        assetId: asset.id,
        employeeId,
        status: 'ALLOCATED'
      }
    });

    res.status(200).json({ allocation });
  } catch (error) {
    next(error);
  }
});
