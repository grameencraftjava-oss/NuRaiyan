import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * GET /api/notifications
 * Get all notifications for current user with unread count
 */
export async function getNotifications(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;

    const notifications = await prisma.notification.findMany({
      where: { recipientId: currentUserId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const unreadCount = await prisma.notification.count({
      where: {
        recipientId: currentUserId,
        isRead: false,
      },
    });

    return res.json({
      success: true,
      data: notifications,
      unreadCount,
    });
  } catch (error) {
    console.error('getNotifications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load notifications.' });
  }
}

/**
 * PATCH /api/notifications/:id/read
 * Mark a single notification as read
 */
export async function markNotificationAsRead(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;
    const { id } = req.params;

    const notif = await prisma.notification.updateMany({
      where: { id, recipientId: currentUserId },
      data: { isRead: true },
    });

    return res.json({
      success: true,
      message: 'Notification marked as read.',
    });
  } catch (error) {
    console.error('markNotificationAsRead error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update notification.' });
  }
}

/**
 * POST /api/notifications/read-all
 * Mark all notifications as read for current user
 */
export async function markAllNotificationsAsRead(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;

    await prisma.notification.updateMany({
      where: { recipientId: currentUserId, isRead: false },
      data: { isRead: true },
    });

    return res.json({
      success: true,
      message: 'All notifications marked as read.',
    });
  } catch (error) {
    console.error('markAllNotificationsAsRead error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update notifications.' });
  }
}

/**
 * DELETE /api/notifications/:id
 * Delete a notification
 */
export async function deleteNotification(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;
    const { id } = req.params;

    await prisma.notification.delete({
      where: { id },
    });

    return res.json({
      success: true,
      message: 'Notification deleted.',
    });
  } catch (error) {
    console.error('deleteNotification error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete notification.' });
  }
}
