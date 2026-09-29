import { Response } from 'express';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { isUserOnline } from '../sockets/socketHandler';

export async function globalSearch(req: AuthenticatedRequest, res: Response) {
  try {
    const query = (req.query.q as string)?.trim();
    if (!query) {
      return res.json({ success: true, data: { users: [], posts: [] } });
    }

    // Search users by username or displayName
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query, mode: 'insensitive' } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isVerified: true,
        bio: true,
        lastSeenAt: true,
        _count: { select: { followers: true } },
      },
      take: 10,
    });

    const mappedUsers = users.map((u: any) => ({
      ...u,
      isOnline: isUserOnline(u.id),
    }));

    // Search posts by content
    const posts = await prisma.post.findMany({
      where: {
        content: { contains: query, mode: 'insensitive' },
        privacy: 'PUBLIC',
      },
      include: {
        author: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            isVerified: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
            shares: true,
          },
        },
      },
      take: 20,
    });

    return res.json({
      success: true,
      data: {
        users: mappedUsers,
        posts,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Search failed.' });
  }
}

export async function getSuggestedUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;

    // Users not already followed by current user
    const following = await prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    });
    const excludedIds = [currentUserId, ...following.map((f) => f.followingId)];

    const suggested = await prisma.user.findMany({
      where: {
        id: { notIn: excludedIds },
      },
      take: 10,
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        isVerified: true,
      },
    });

    return res.json({ success: true, data: suggested });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load suggestions.' });
  }
}

export async function getUserProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const { username } = req.params;
    const currentUserId = req.user?.userId;

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        coverUrl: true,
        bio: true,
        isPrivate: true,
        isVerified: true,
        worksAt: true,
        education: true,
        college: true,
        school: true,
        location: true,
        hometown: true,
        relationship: true,
        website: true,
        createdAt: true,
        lastSeenAt: true,
        _count: {
          select: {
            followers: true,
            following: true,
            posts: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isMe = currentUserId === user.id;
    let isFollowing = false;
    if (currentUserId && !isMe) {
      const followRecord = await prisma.follow.findUnique({
        where: { followerId_followingId: { followerId: currentUserId, followingId: user.id } },
      });
      isFollowing = !!followRecord;
    }

    // Calculate Friends count (Facebook style)
    const userFriendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: user.id }, { receiverId: user.id }],
      },
    });
    const friendsCount = userFriendships.length;

    let friendshipStatus: 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS' | 'SELF' = 'NONE';
    let friendshipId: string | null = null;
    if (isMe) {
      friendshipStatus = 'SELF';
    } else if (currentUserId) {
      const friendship = await prisma.friendship.findFirst({
        where: {
          OR: [
            { senderId: currentUserId, receiverId: user.id },
            { senderId: user.id, receiverId: currentUserId },
          ],
        },
      });
      if (friendship) {
        friendshipId = friendship.id;
        if (friendship.status === 'ACCEPTED') {
          friendshipStatus = 'FRIENDS';
        } else if (friendship.status === 'PENDING') {
          friendshipStatus = friendship.senderId === currentUserId ? 'PENDING_SENT' : 'PENDING_RECEIVED';
        }
      }
    }

    const isFriend = friendshipStatus === 'FRIENDS';

    // 🔒 Security & Privacy: If account is private and viewer is not friend/following, hide posts
    let visiblePosts: any[] = [];
    if (isMe || !user.isPrivate || isFriend || isFollowing) {
      visiblePosts = await prisma.post.findMany({
        where: {
          authorId: user.id,
          isArchived: false,
          OR: [
            { privacy: 'PUBLIC' },
            ...(isMe ? [{ privacy: 'ONLY_ME' as any }, { privacy: 'FRIENDS' as any }] : (isFriend || isFollowing) ? [{ privacy: 'FRIENDS' as any }] : []),
          ],
        },
        orderBy: { createdAt: 'desc' },
        include: {
          author: {
            select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
          },
          likes: { select: { type: true, userId: true } },
          _count: { select: { likes: true, comments: true, shares: true } },
        },
      });

      visiblePosts = visiblePosts.map((post) => {
        const userLike = Array.isArray(post.likes)
          ? post.likes.find((l: any) => l.userId === currentUserId)
          : null;
        const distinctReactions = Array.isArray(post.likes)
          ? Array.from(new Set(post.likes.map((l: any) => l.type).filter(Boolean)))
          : [];
        return {
          ...post,
          hasLiked: !!userLike,
          userReaction: userLike ? userLike.type : null,
          distinctReactions,
        };
      });
    }

    // 🎥 Live Streams & Replays by this user (permanent retention)
    const liveStreams = await prisma.liveStream.findMany({
      where: { hostId: user.id },
      orderBy: { startedAt: 'desc' },
      include: {
        comments: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    return res.json({
      success: true,
      data: {
        ...user,
        posts: visiblePosts,
        liveStreams,
        isFollowing,
        isFriend,
        friendsCount,
        friendshipStatus,
        friendshipId,
        isMe,
        isOnline: isUserOnline(user.id),
        isLocked: user.isPrivate && !isMe && !isFriend && !isFollowing,
      },
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load profile.' });
  }
}

export async function toggleFollow(req: AuthenticatedRequest, res: Response) {
  try {
    const { targetUserId } = req.body;
    const currentUserId = req.user!.userId;

    if (!targetUserId || currentUserId === targetUserId) {
      return res.status(400).json({ success: false, message: 'Invalid request.' });
    }

    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: currentUserId, followingId: targetUserId } },
    });

    if (existing) {
      await prisma.follow.delete({
        where: { followerId_followingId: { followerId: currentUserId, followingId: targetUserId } },
      });
      return res.json({ success: true, isFollowing: false });
    } else {
      await prisma.follow.create({
        data: { followerId: currentUserId, followingId: targetUserId },
      });
      return res.json({ success: true, isFollowing: true });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update follow status.' });
  }
}

