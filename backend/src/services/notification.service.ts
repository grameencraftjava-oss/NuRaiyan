import { prisma } from '../lib/prisma';
import { getSocketIO } from '../sockets/socketHandler';

export interface CreateNotificationInput {
  recipientId: string;
  senderId: string;
  type: string; // 'POST' | 'STORY' | 'LIVE' | 'REACT' | 'COMMENT' | 'FRIEND_REQUEST' | 'FRIEND_ACCEPT'
  entityId?: string | null;
  entityType?: string | null;
  message: string;
  imageUrl?: string | null;
}

export async function createNotification(input: CreateNotificationInput) {
  try {
    // Prevent sending notification to self
    if (input.recipientId === input.senderId) return null;

    const notif = await prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        senderId: input.senderId,
        type: input.type,
        entityId: input.entityId || null,
        entityType: input.entityType || null,
        message: input.message,
        imageUrl: input.imageUrl || null,
        isRead: false,
      },
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

    // Real-time socket delivery directly to recipient's private user room
    const io = getSocketIO();
    if (io) {
      io.to(`user_${input.recipientId}`).emit('notification:new', notif);
      console.log(`[Notification] Delivered to user_${input.recipientId}: "${input.message}"`);
    }

    return notif;
  } catch (err) {
    console.error('[Notification Service] Error creating notification:', err);
    return null;
  }
}

export interface NotifyFriendsInput {
  authorId: string;
  type: string; // 'POST' | 'STORY' | 'LIVE'
  entityId: string;
  entityType: string;
  message: string;
  imageUrl?: string | null;
}

export async function notifyFriends(input: NotifyFriendsInput) {
  try {
    // Find all accepted friends of author
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: input.authorId }, { receiverId: input.authorId }],
      },
    });

    const friendIds = friendships
      .map((f: any) => (f.senderId === input.authorId ? f.receiverId : f.senderId))
      .filter((id: string) => id && id !== input.authorId);

    // Notify each accepted friend
    for (const friendId of friendIds) {
      await createNotification({
        recipientId: friendId,
        senderId: input.authorId,
        type: input.type,
        entityId: input.entityId,
        entityType: input.entityType,
        message: input.message,
        imageUrl: input.imageUrl,
      });
    }
  } catch (err) {
    console.error('[Notification Service] Error notifying friends:', err);
  }
}
