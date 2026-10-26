import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/db.js';
import { authenticate } from '../../middleware/auth.js';
import { AppError } from '../../middleware/errorHandler.js';

export const notificationRouter = Router();

// 1. Get current user's in-app notifications
notificationRouter.get('/', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 30)));

    const where: any = {
      userId: req.user!.userId,
      companyId: req.user!.companyId
    };

    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.inAppNotification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit
      }),
      prisma.inAppNotification.count({
        where: {
          userId: req.user!.userId,
          companyId: req.user!.companyId,
          isRead: false
        }
      })
    ]);

    res.status(200).json({ notifications, unreadCount });
  } catch (error) {
    next(error);
  }
});

// 2. Mark specific notification as read
notificationRouter.patch('/:id/read', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const notification = await prisma.inAppNotification.findUnique({
      where: { id: String(req.params.id) }
    });

    if (!notification || notification.userId !== req.user!.userId || notification.companyId !== req.user!.companyId) {
      throw new AppError('Notification not found or access denied', 404);
    }

    const updated = await prisma.inAppNotification.update({
      where: { id: notification.id },
      data: { isRead: true, readAt: new Date() }
    });

    res.status(200).json({ notification: updated });
  } catch (error) {
    next(error);
  }
});

// 3. Mark all notifications as read
notificationRouter.post('/mark-all-read', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await prisma.inAppNotification.updateMany({
      where: {
        userId: req.user!.userId,
        companyId: req.user!.companyId,
        isRead: false
      },
      data: { isRead: true, readAt: new Date() }
    });

    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
});
