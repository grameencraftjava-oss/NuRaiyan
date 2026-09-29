import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { isUserOnline } from '../sockets/socketHandler';
import { createNotification } from '../services/notification.service';

/**
 * GET /api/friends/status/:targetUserId
 * Get current friendship status with a specific user
 */
export async function getFriendshipStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;
    const { targetUserId } = req.params;

    if (currentUserId === targetUserId) {
      return res.json({ success: true, data: { status: 'SELF', isMe: true } });
    }

    const friendship = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: currentUserId },
        ],
      },
    });

    if (!friendship) {
      return res.json({ success: true, data: { status: 'NONE' } });
    }

    if (friendship.status === 'ACCEPTED') {
      return res.json({ success: true, data: { status: 'FRIENDS', friendshipId: friendship.id } });
    }

    if (friendship.status === 'PENDING') {
      if (friendship.senderId === currentUserId) {
        return res.json({
          success: true,
          data: { status: 'PENDING_SENT', friendshipId: friendship.id },
        });
      } else {
        return res.json({
          success: true,
          data: { status: 'PENDING_RECEIVED', friendshipId: friendship.id },
        });
      }
    }

    return res.json({ success: true, data: { status: 'NONE' } });
  } catch (error) {
    console.error('getFriendshipStatus error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve friend status.' });
  }
}

/**
 * POST /api/friends/request/:targetUserId
 * Send a friend request to a user
 */
export async function sendFriendRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;
    const { targetUserId } = req.params;

    if (currentUserId === targetUserId) {
      return res.status(400).json({ success: false, message: 'You cannot add yourself as a friend.' });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // Check existing friendship
    const existing = await prisma.friendship.findFirst({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: targetUserId },
          { senderId: targetUserId, receiverId: currentUserId },
        ],
      },
    });

    if (existing) {
      if (existing.status === 'ACCEPTED') {
        return res.status(400).json({ success: false, message: 'You are already friends with this user.' });
      }
      if (existing.status === 'PENDING') {
        if (existing.senderId === currentUserId) {
          return res.json({
            success: true,
            message: 'Friend request already sent.',
            status: 'PENDING_SENT',
          });
        } else {
          // If the other user already sent a request, auto-accept it!
          await prisma.friendship.update({
            where: { id: existing.id },
            data: { status: 'ACCEPTED' },
          });

          // Notify sender that request was accepted
          prisma.user.findUnique({
            where: { id: currentUserId },
            select: { displayName: true, username: true, avatarUrl: true },
          }).then((u: any) => {
            const name = u?.displayName || u?.username || 'Someone';
            createNotification({
              recipientId: targetUserId,
              senderId: currentUserId,
              type: 'FRIEND_ACCEPT',
              entityId: existing.id,
              entityType: 'friendship',
              message: `${name} accepted your friend request. You are now friends!`,
              imageUrl: u?.avatarUrl,
            });
          }).catch(console.error);

          return res.json({
            success: true,
            message: 'Friend request accepted! You are now friends.',
            status: 'FRIENDS',
          });
        }
      }
    }

    // Create new friend request
    const created = await prisma.friendship.create({
      data: {
        senderId: currentUserId,
        receiverId: targetUserId,
        status: 'PENDING',
      },
    });

    // Notify recipient of friend request
    prisma.user.findUnique({
      where: { id: currentUserId },
      select: { displayName: true, username: true, avatarUrl: true },
    }).then((u: any) => {
      const name = u?.displayName || u?.username || 'Someone';
      createNotification({
        recipientId: targetUserId,
        senderId: currentUserId,
        type: 'FRIEND_REQUEST',
        entityId: created.id,
        entityType: 'friendship',
        message: `${name} sent you a friend request.`,
        imageUrl: u?.avatarUrl,
      });
    }).catch(console.error);

    return res.json({
      success: true,
      message: 'Friend request sent successfully.',
      status: 'PENDING_SENT',
      data: created,
    });
  } catch (error) {
    console.error('sendFriendRequest error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send friend request.' });
  }
}

/**
 * POST /api/friends/accept/:senderId
 * Accept an incoming friend request
 */
export async function acceptFriendRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;
    const { senderId } = req.params;

    const request = await prisma.friendship.findFirst({
      where: {
        senderId,
        receiverId: currentUserId,
        status: 'PENDING',
      },
    });

    if (!request) {
      return res.status(404).json({ success: false, message: 'Friend request not found.' });
    }

    await prisma.friendship.update({
      where: { id: request.id },
      data: { status: 'ACCEPTED' },
    });

    // Notify original sender that request was accepted
    prisma.user.findUnique({
      where: { id: currentUserId },
      select: { displayName: true, username: true, avatarUrl: true },
    }).then((u: any) => {
      const name = u?.displayName || u?.username || 'Someone';
      createNotification({
        recipientId: senderId,
        senderId: currentUserId,
        type: 'FRIEND_ACCEPT',
        entityId: request.id,
        entityType: 'friendship',
        message: `${name} accepted your friend request. You are now friends!`,
        imageUrl: u?.avatarUrl,
      });
    }).catch(console.error);

    return res.json({
      success: true,
      message: 'Friend request accepted!',
      status: 'FRIENDS',
    });
  } catch (error) {
    console.error('acceptFriendRequest error:', error);
    return res.status(500).json({ success: false, message: 'Failed to accept friend request.' });
  }
}

/**
 * POST /api/friends/reject/:senderId
 * Reject or cancel a friend request
 */
export async function rejectFriendRequest(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;
    const { senderId } = req.params;

    // Delete whether current user is receiver (reject) or sender (cancel)
    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { senderId, receiverId: currentUserId, status: 'PENDING' },
          { senderId: currentUserId, receiverId: senderId, status: 'PENDING' },
        ],
      },
    });

    return res.json({
      success: true,
      message: 'Friend request removed.',
      status: 'NONE',
    });
  } catch (error) {
    console.error('rejectFriendRequest error:', error);
    return res.status(500).json({ success: false, message: 'Failed to remove friend request.' });
  }
}

/**
 * DELETE /api/friends/unfriend/:targetUserId
 * Unfriend an existing friend
 */
export async function unfriend(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;
    const { targetUserId } = req.params;

    await prisma.friendship.deleteMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: targetUserId, status: 'ACCEPTED' },
          { senderId: targetUserId, receiverId: currentUserId, status: 'ACCEPTED' },
        ],
      },
    });

    return res.json({
      success: true,
      message: 'User unfriended successfully.',
      status: 'NONE',
    });
  } catch (error) {
    console.error('unfriend error:', error);
    return res.status(500).json({ success: false, message: 'Failed to unfriend.' });
  }
}

/**
 * GET /api/friends/requests
 * Get all incoming pending friend requests for current user
 */
export async function getFriendRequests(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;

    const requests = await prisma.friendship.findMany({
      where: {
        receiverId: currentUserId,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            bio: true,
            isVerified: true,
            location: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({
      success: true,
      data: requests,
      count: requests.length,
    });
  } catch (error) {
    console.error('getFriendRequests error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load friend requests.' });
  }
}

/**
 * GET /api/friends/suggestions
 * Get suggested friends (people you may know)
 */
export async function getFriendSuggestions(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;

    // Get all users who are already connected or have pending requests
    const activeFriendships = await prisma.friendship.findMany({
      where: {
        OR: [{ senderId: currentUserId }, { receiverId: currentUserId }],
      },
    });

    const excludedUserIds = new Set<string>([currentUserId]);
    activeFriendships.forEach((f) => {
      excludedUserIds.add(f.senderId);
      excludedUserIds.add(f.receiverId);
    });

    const allUsers = await prisma.user.findMany({
      where: {
        id: { notIn: Array.from(excludedUserIds) },
        isActive: true,
        isSuspended: false,
      },
      take: 20,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        bio: true,
        isVerified: true,
        location: true,
      },
    });

    return res.json({
      success: true,
      data: allUsers,
      count: allUsers.length,
    });
  } catch (error) {
    console.error('getFriendSuggestions error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load friend suggestions.' });
  }
}

/**
 * GET /api/friends/list/:userId?
 * Get friends of a user or current user
 */
export async function getFriendsList(req: AuthenticatedRequest, res: Response) {
  try {
    const targetUserId = req.params.userId || req.user!.userId;

    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: targetUserId }, { receiverId: targetUserId }],
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
            location: true,
            lastSeenAt: true,
          },
        },
        receiver: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
            location: true,
            lastSeenAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const friends = friendships
      .map((f: any) => {
        const u = f.senderId === targetUserId ? f.receiver : f.sender;
        if (!u) return null;
        return {
          ...u,
          isOnline: isUserOnline(u.id),
        };
      })
      .filter(Boolean);

    return res.json({
      success: true,
      data: friends,
      count: friends.length,
    });
  } catch (error) {
    console.error('getFriendsList error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load friends list.' });
  }
}
