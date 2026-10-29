import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/db.js';
import { authenticate, requireRole, recordAudit } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';
import { MASTER_CONFIGS, checkMasterRecordDependencies } from './masters.registry.js';
import { MasterCategoryKey } from './masters.types.js';

export const mastersRouter = Router();

// Helper to get Prisma delegate safely by category key
function getPrismaDelegate(categoryKey: MasterCategoryKey): any {
  const config = MASTER_CONFIGS[categoryKey];
  if (!config) throw new AppError(`Invalid master category '${categoryKey}'`, 400);
  const delegate = (prisma as any)[config.model];
  if (!delegate) throw new AppError(`Prisma model '${config.model}' not found`, 500);
  return delegate;
}

// 1. Overview of all Master Categories with live tenant record counts
mastersRouter.get('/categories', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const companyId = req.user!.companyId;
    const categoryKeys = Object.keys(MASTER_CONFIGS) as MasterCategoryKey[];

    const categoriesWithCounts = await Promise.all(
      categoryKeys.map(async (key) => {
        const config = MASTER_CONFIGS[key];
        const delegate = getPrismaDelegate(key);

        let totalCount = 0;
        let activeCount = 0;
        let inactiveCount = 0;

        try {
          if (key === 'companies') {
            const count = await delegate.count({ where: { id: companyId } });
            totalCount = count;
            activeCount = count;
            inactiveCount = 0;
          } else {
            const whereClause = { companyId };
            totalCount = await delegate.count({ where: whereClause });
            if (config.supportsActiveToggle) {
              activeCount = await delegate.count({ where: { ...whereClause, active: true } });
              inactiveCount = totalCount - activeCount;
            } else {
              activeCount = totalCount;
            }
          }
        } catch {
          // Fallback if model count fails
        }

        return {
          ...config,
          totalCount,
          activeCount,
          inactiveCount
        };
      })
    );

    res.status(200).json({ categories: categoriesWithCounts });
  } catch (error) {
    next(error);
  }
});

// 2. Query paginated records for a specific master category
mastersRouter.get('/:category', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categoryKey = req.params.category as MasterCategoryKey;
    const config = MASTER_CONFIGS[categoryKey];
    if (!config) throw new AppError(`Invalid master category '${req.params.category}'`, 400);

    const companyId = req.user!.companyId;
    const delegate = getPrismaDelegate(categoryKey);

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status.toUpperCase() : 'ACTIVE';
    const all = req.query.all === 'true';
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = all ? 1000 : Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
    const skip = (page - 1) * limit;

    const where: any = categoryKey === 'companies' ? { id: companyId } : { companyId };

    if (config.supportsActiveToggle && status !== 'ALL') {
      where.active = status === 'ACTIVE';
    }

    if (search) {
      if (categoryKey === 'companies') {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
          { legalName: { contains: search, mode: 'insensitive' } }
        ];
      } else if (categoryKey === 'helpdesk-categories') {
        where.name = { contains: search, mode: 'insensitive' };
      } else if (categoryKey === 'job-positions') {
        where.OR = [
          { code: { contains: search, mode: 'insensitive' } },
          { title: { contains: search, mode: 'insensitive' } }
        ];
      } else {
        where.OR = [
          { [config.nameField]: { contains: search, mode: 'insensitive' } },
          { [config.codeField]: { contains: search, mode: 'insensitive' } }
        ];
      }
    }

    // Dependent parent filters (branchId for units, departmentId for job-positions, etc.)
    if (req.query.branchId && categoryKey === 'units') {
      where.branchId = req.query.branchId;
    }
    if (req.query.departmentId && categoryKey === 'job-positions') {
      where.departmentId = req.query.departmentId;
    }
    if (req.query.designationId && categoryKey === 'job-positions') {
      where.designationId = req.query.designationId;
    }

    // Includes for relational labels
    let include: any = undefined;
    if (categoryKey === 'units') {
      include = { branch: { select: { id: true, name: true, code: true } } };
    } else if (categoryKey === 'job-positions') {
      include = {
        department: { select: { id: true, name: true, code: true } },
        designation: { select: { id: true, name: true, code: true } },
        grade: { select: { id: true, name: true, code: true } }
      };
    } else if (categoryKey === 'branches' || categoryKey === 'departments' || categoryKey === 'designations' || categoryKey === 'grades' || categoryKey === 'divisions') {
      include = {
        _count: { select: { employees: true } }
      };
    }

    const [records, total] = await Promise.all([
      delegate.findMany({
        where,
        include,
        orderBy: { [config.defaultOrderBy.field]: config.defaultOrderBy.direction },
        skip,
        take: limit
      }),
      delegate.count({ where })
    ]);

    res.status(200).json({
      records,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      category: config
    });
  } catch (error) {
    next(error);
  }
});

// 3. Get single master record
mastersRouter.get('/:category/:id', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categoryKey = req.params.category as MasterCategoryKey;
    const recordId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const config = MASTER_CONFIGS[categoryKey];
    if (!config) throw new AppError(`Invalid master category '${req.params.category}'`, 400);

    const companyId = req.user!.companyId;
    const delegate = getPrismaDelegate(categoryKey);

    const record = await delegate.findFirst({
      where: categoryKey === 'companies' ? { id: recordId } : { id: recordId, companyId }
    });

    if (!record) {
      throw new AppError(`${config.singularLabel} record not found`, 404);
    }

    res.status(200).json({ record, category: config });
  } catch (error) {
    next(error);
  }
});

// 4. Create master record
mastersRouter.post('/:category', authenticate, requireRole(['company_admin', 'platform_admin', 'hr_manager', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categoryKey = req.params.category as MasterCategoryKey;
    const config = MASTER_CONFIGS[categoryKey];
    if (!config) throw new AppError(`Invalid master category '${req.params.category}'`, 400);
    if (!config.canCreate) throw new AppError(`Creating new ${config.label} records is not permitted via this interface`, 403);

    const companyId = req.user!.companyId;
    const delegate = getPrismaDelegate(categoryKey);
    const body = req.body;

    // Build dynamic validation based on field definitions
    const schemaShape: Record<string, z.ZodTypeAny> = {};
    for (const f of config.fields) {
      if (f.readOnly) continue;
      if (f.type === 'number') {
        schemaShape[f.name] = f.required ? z.coerce.number() : z.coerce.number().optional().nullable();
      } else if (f.type === 'boolean') {
        schemaShape[f.name] = z.boolean().default(true);
      } else {
        schemaShape[f.name] = f.required ? z.string().min(1, `${f.label} is required`) : z.string().optional().nullable();
      }
    }

    const parsedData = z.object(schemaShape).parse(body);

    // Enforce code / name uniqueness per company
    if (config.codeField && parsedData[config.codeField]) {
      const codeVal = parsedData[config.codeField];
      const existing = await delegate.findFirst({
        where: {
          companyId,
          [config.codeField]: { equals: codeVal, mode: 'insensitive' }
        }
      });
      if (existing) {
        throw new AppError(`${config.singularLabel} with code '${codeVal}' already exists in your company.`, 400, 'DUPLICATE_CODE');
      }
    }

    const record = await delegate.create({
      data: {
        companyId,
        ...parsedData
      }
    });

    await recordAudit(req, `CREATE_${categoryKey.toUpperCase()}`, config.singularLabel, record.id, parsedData);

    res.status(201).json({ record, category: config, message: `${config.singularLabel} created successfully.` });
  } catch (error) {
    next(error);
  }
});

// 5. Update master record
mastersRouter.patch('/:category/:id', authenticate, requireRole(['company_admin', 'platform_admin', 'hr_manager', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categoryKey = req.params.category as MasterCategoryKey;
    const recordId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const config = MASTER_CONFIGS[categoryKey];
    if (!config) throw new AppError(`Invalid master category '${req.params.category}'`, 400);
    if (!config.canEdit) throw new AppError(`Updating ${config.label} is not permitted`, 403);

    const companyId = req.user!.companyId;
    const delegate = getPrismaDelegate(categoryKey);

    const existing = await delegate.findFirst({
      where: categoryKey === 'companies' ? { id: recordId } : { id: recordId, companyId }
    });
    if (!existing) {
      throw new AppError(`${config.singularLabel} not found or unauthorized`, 404);
    }

    const body = req.body;
    const schemaShape: Record<string, z.ZodTypeAny> = {};
    for (const f of config.fields) {
      if (f.readOnly) continue;
      if (f.type === 'number') {
        schemaShape[f.name] = z.coerce.number().optional().nullable();
      } else if (f.type === 'boolean') {
        schemaShape[f.name] = z.boolean().optional();
      } else {
        schemaShape[f.name] = z.string().optional().nullable();
      }
    }

    const parsedData = z.object(schemaShape).parse(body);

    // If code is being changed, ensure uniqueness
    if (config.codeField && parsedData[config.codeField] && parsedData[config.codeField] !== existing[config.codeField]) {
      const codeVal = parsedData[config.codeField];
      const duplicate = await delegate.findFirst({
        where: {
          companyId,
          [config.codeField]: { equals: codeVal, mode: 'insensitive' },
          id: { not: recordId }
        }
      });
      if (duplicate) {
        throw new AppError(`${config.singularLabel} with code '${codeVal}' already exists.`, 400, 'DUPLICATE_CODE');
      }
    }

    const updated = await delegate.update({
      where: { id: recordId },
      data: parsedData
    });

    await recordAudit(req, `UPDATE_${categoryKey.toUpperCase()}`, config.singularLabel, updated.id, parsedData);

    res.status(200).json({ record: updated, category: config, message: `${config.singularLabel} updated successfully.` });
  } catch (error) {
    next(error);
  }
});

// 6. Toggle Active / Inactive Status
mastersRouter.patch('/:category/:id/status', authenticate, requireRole(['company_admin', 'platform_admin', 'hr_manager', 'payroll_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categoryKey = req.params.category as MasterCategoryKey;
    const recordId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const config = MASTER_CONFIGS[categoryKey];
    if (!config) throw new AppError(`Invalid master category '${req.params.category}'`, 400);
    if (!config.supportsActiveToggle) throw new AppError(`${config.label} does not support status toggling`, 400);

    const companyId = req.user!.companyId;
    const delegate = getPrismaDelegate(categoryKey);

    const existing = await delegate.findFirst({
      where: categoryKey === 'companies' ? { id: recordId } : { id: recordId, companyId }
    });
    if (!existing) {
      throw new AppError(`${config.singularLabel} not found or unauthorized`, 404);
    }

    const newActiveState = typeof req.body.active === 'boolean' ? req.body.active : !existing.active;

    // Check dependencies if deactivating
    let warning: string | undefined = undefined;
    let referenceCount = 0;
    if (!newActiveState) {
      const depCheck = await checkMasterRecordDependencies(categoryKey, recordId, companyId);
      referenceCount = depCheck.referenceCount;
      if (referenceCount > 0) {
        warning = `Note: This ${config.singularLabel.toLowerCase()} is referenced by ${referenceCount} active record(s). Existing records remain intact, but it will be hidden from new dropdown selections.`;
      }
    }

    const updated = await delegate.update({
      where: { id: recordId },
      data: { active: newActiveState }
    });

    await recordAudit(req, `TOGGLE_STATUS_${categoryKey.toUpperCase()}`, config.singularLabel, updated.id, {
      previousActive: existing.active,
      newActive: newActiveState,
      referenceCount
    });

    res.status(200).json({
      record: updated,
      category: config,
      referenceCount,
      warning,
      message: `${config.singularLabel} has been ${newActiveState ? 'activated' : 'deactivated'} successfully.`
    });
  } catch (error) {
    next(error);
  }
});

// 7. Delete master record (Strict Referential Integrity Guard)
mastersRouter.delete('/:category/:id', authenticate, requireRole(['company_admin', 'platform_admin']), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const categoryKey = req.params.category as MasterCategoryKey;
    const recordId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const config = MASTER_CONFIGS[categoryKey];
    if (!config) throw new AppError(`Invalid master category '${req.params.category}'`, 400);
    if (!config.canDelete) throw new AppError(`Deleting ${config.label} records is not permitted`, 403);

    const companyId = req.user!.companyId;
    const delegate = getPrismaDelegate(categoryKey);

    const existing = await delegate.findFirst({
      where: categoryKey === 'companies' ? { id: recordId } : { id: recordId, companyId }
    });
    if (!existing) {
      throw new AppError(`${config.singularLabel} not found or unauthorized`, 404);
    }

    // Referential integrity check
    const depCheck = await checkMasterRecordDependencies(categoryKey, recordId, companyId);
    if (!depCheck.canDelete) {
      throw new AppError(
        `Cannot delete ${config.singularLabel} '${existing[config.nameField] || existing.id}': ${depCheck.reason}`,
        400,
        'REFERENTIAL_INTEGRITY_VIOLATION'
      );
    }

    await delegate.delete({
      where: { id: recordId }
    });

    await recordAudit(req, `DELETE_${categoryKey.toUpperCase()}`, config.singularLabel, recordId, {
      code: existing[config.codeField],
      name: existing[config.nameField]
    });

    res.status(200).json({
      success: true,
      message: `${config.singularLabel} '${existing[config.nameField] || existing.id}' deleted successfully.`
    });
  } catch (error) {
    next(error);
  }
});
