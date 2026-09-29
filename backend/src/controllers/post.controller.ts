import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { notifyFriends, createNotification } from '../services/notification.service';

const createPostSchema = z.object({
  content: z.string().max(5000).optional(),
  mediaUrls: z.array(z.string()).default([]),
  mediaType: z.enum(['IMAGE', 'VIDEO', 'AUDIO', 'FILE', 'MIXED']).optional(),
  privacy: z.enum(['PUBLIC', 'FRIENDS', 'ONLY_ME']).default('PUBLIC'),
  location: z.string().max(100).optional(),
  // 🎵 Music
  musicTitle: z.string().max(100).optional(),
  musicArtist: z.string().max(100).optional(),
  musicUrl: z.string().url().optional(),
  musicStartSec: z.number().int().min(0).optional(),
  musicEndSec: z.number().int().min(0).optional(),
});

const commentSchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().optional(),
  mediaUrl: z.string().url().optional(),
});

export async function getFeed(req: AuthenticatedRequest, res: Response) {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(20, parseInt(req.query.limit as string) || 10);
    const skip = (page - 1) * limit;
    const currentUserId = req.user?.userId;

    // Get who the user follows
    const following = currentUserId
      ? await prisma.follow.findMany({
          where: { followerId: currentUserId },
          select: { followingId: true },
        })
      : [];
    const followingIds = following.map((f) => f.followingId);

    // Feed = own posts (any privacy) + following posts (PUBLIC or FRIENDS)
    const posts = await prisma.post.findMany({
      where: {
        isArchived: false,
        OR: [
          { privacy: 'PUBLIC' },
          ...(currentUserId
            ? [
                { authorId: currentUserId }, // author sees all their own posts
                { authorId: { in: followingIds }, privacy: 'FRIENDS' as any }, // friends' posts
              ]
            : []),
        ],
      },
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
        },
        likes: { select: { type: true, userId: true } },
        _count: { select: { likes: true, comments: true, shares: true } },
      },
    });

    const formattedPosts = posts.map((post) => {
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

    return res.json({
      success: true,
      data: formattedPosts,
      page,
      hasMore: posts.length === limit,
    });
  } catch (error) {
    console.error('Feed error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load feed.' });
  }
}

export async function createPost(req: AuthenticatedRequest, res: Response) {
  try {
    const parse = createPostSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten().fieldErrors });
    }

    const { content, mediaUrls, mediaType, privacy, location, musicTitle, musicArtist, musicUrl, musicStartSec, musicEndSec } = parse.data;

    if (!content && mediaUrls.length === 0) {
      return res.status(400).json({ success: false, message: 'Please add content or media for your post.' });
    }

    let resolvedMediaType = mediaType;
    if (!resolvedMediaType && mediaUrls.length > 0) {
      const hasVideo = mediaUrls.some(url =>
        /\.(mp4|webm|mov|mkv|avi|3gp|m4v|ogv|wmv|flv)(\?|$)/i.test(url) ||
        url.toLowerCase().includes('/video') ||
        url.toLowerCase().includes('video_')
      );
      resolvedMediaType = hasVideo ? 'VIDEO' : 'IMAGE';
    }

    const postData: any = {
      authorId: req.user!.userId,
      content,
      mediaUrls,
      mediaType: resolvedMediaType as any,
      privacy: privacy as any,
      location,
      musicTitle,
      musicArtist,
      musicUrl,
      musicStartSec,
      musicEndSec,
    };

    const post = await prisma.post.create({
      data: postData,
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
        },
        _count: { select: { likes: true, comments: true, shares: true } },
      },
    });

    // Notify all friends about the new post
    const postSnippet = content ? (content.length > 50 ? content.slice(0, 50) + '...' : content) : 'a new photo/video';
    notifyFriends({
      authorId: req.user!.userId,
      type: 'POST',
      entityId: post.id,
      entityType: 'POST',
      message: `${post.author?.displayName || 'Your friend'} shared a new post: "${postSnippet}"`,
      imageUrl: mediaUrls && mediaUrls[0] ? mediaUrls[0] : null,
    }).catch((err) => console.warn('Post friend notify notice:', err));

    return res.status(201).json({
      success: true,
      message: 'Post published successfully! 🎉',
      data: post,
    });
  } catch (error) {
    console.error('Create post error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create post.' });
  }
}

export async function getPost(req: AuthenticatedRequest, res: Response) {
  try {
    const { postId } = req.params;
    const currentUserId = req.user?.userId;

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
        },
        likes: currentUserId ? { where: { userId: currentUserId }, select: { type: true } } : false,
        comments: {
          where: { parentId: null },
          take: 20,
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            replies: {
              take: 5,
              include: {
                user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
              },
            },
          },
        },
        _count: { select: { likes: true, comments: true, shares: true } },
      },
    });

    if (!post || post.isArchived) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    // 🔒 Authorization: Protect ONLY_ME and FRIENDS posts from unauthorized viewing
    if (post.privacy === 'ONLY_ME' && post.authorId !== currentUserId) {
      return res.status(403).json({ success: false, message: 'You do not have permission to view this post.' });
    }

    if (post.privacy === 'FRIENDS' && post.authorId !== currentUserId) {
      const isFollowing = currentUserId
        ? await prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followerId: currentUserId,
                followingId: post.authorId,
              },
            },
          })
        : null;

      if (!isFollowing) {
        return res.status(403).json({ success: false, message: 'This post is only available to friends.' });
      }
    }

    // Increment view count
    await prisma.post.update({ where: { id: postId }, data: { viewsCount: { increment: 1 } } });

    return res.json({ success: true, data: post });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load post.' });
  }
}

export async function deletePost(req: AuthenticatedRequest, res: Response) {
  try {
    const { postId } = req.params;
    const userId = req.user!.userId;
    const role = req.user!.role;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });

    // Only the author or an ADMIN can delete a post
    if (post.authorId !== userId && role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'You cannot delete this post.' });
    }

    await prisma.post.delete({ where: { id: postId } });
    return res.json({ success: true, message: 'Post permanently deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete post.' });
  }
}

// ── Update Post (Caption, Music, Privacy) ──
const updatePostSchema = z.object({
  content: z.string().max(5000).optional(),
  musicTitle: z.string().max(100).nullable().optional(),
  musicArtist: z.string().max(100).nullable().optional(),
  musicUrl: z.string().nullable().optional(),
  privacy: z.enum(['PUBLIC', 'FRIENDS', 'ONLY_ME']).optional(),
});

export async function updatePost(req: AuthenticatedRequest, res: Response) {
  try {
    const { postId } = req.params;
    const userId = req.user!.userId;
    const parse = updatePostSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten().fieldErrors });
    }

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) return res.status(404).json({ success: false, message: 'Post not found.' });
    if (post.authorId !== userId) {
      return res.status(403).json({ success: false, message: 'You do not have permission to edit this post.' });
    }

    const updated = await prisma.post.update({
      where: { id: postId },
      data: parse.data,
      include: {
        author: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
        },
      },
    });

    return res.json({ success: true, message: 'Post updated successfully!', data: updated });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update post.' });
  }
}

export async function toggleLike(req: AuthenticatedRequest, res: Response) {
  try {
    const { postId } = req.params;
    const userId = req.user!.userId;
    const type = (req.body.type as any) || 'LIKE';

    const existingLike = await prisma.like.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    let action: 'unliked' | 'updated' | 'liked' = 'liked';

    if (existingLike) {
      if (existingLike.type === type) {
        await prisma.like.delete({ where: { userId_postId: { userId, postId } } });
        action = 'unliked';
      } else {
        await prisma.like.update({ where: { userId_postId: { userId, postId } }, data: { type } });
        action = 'updated';
        // Notify author on updated reaction
        const targetPost = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
        if (targetPost && targetPost.authorId !== userId) {
          const user = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
          createNotification({
            recipientId: targetPost.authorId,
            senderId: userId,
            type: 'REACT',
            entityId: postId,
            entityType: 'POST',
            message: `${user?.displayName || 'Someone'} reacted with ${type} to your post.`,
          }).catch(() => {});
        }
      }
    } else {
      await prisma.like.create({ data: { userId, postId, type } });
      action = 'liked';
      // Notify author on new like/reaction
      const targetPost = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
      if (targetPost && targetPost.authorId !== userId) {
        const user = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
        createNotification({
          recipientId: targetPost.authorId,
          senderId: userId,
          type: 'REACT',
          entityId: postId,
          entityType: 'POST',
          message: `${user?.displayName || 'Someone'} reacted with ${type} to your post.`,
        }).catch(() => {});
      }
    }

    const currentLikes = await prisma.like.findMany({ where: { postId } });
    const distinctReactions = Array.from(new Set(currentLikes.map((l: any) => l.type).filter(Boolean)));

    // Keep post.likesCount synced to exact likes count
    await prisma.post.update({ where: { id: postId }, data: { likesCount: currentLikes.length } }).catch(() => {});

    return res.json({
      success: true,
      action,
      type: action === 'unliked' ? null : type,
      likesCount: currentLikes.length,
      distinctReactions,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update reaction.' });
  }
}

export async function getPostReactions(req: AuthenticatedRequest, res: Response) {
  try {
    const { postId } = req.params;

    const likes = await prisma.like.findMany({
      where: { postId },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true },
        },
      },
    });

    return res.json({
      success: true,
      data: likes,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch reactions.' });
  }
}

export async function addComment(req: AuthenticatedRequest, res: Response) {
  try {
    const { postId } = req.params;
    const parse = commentSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten().fieldErrors });
    }

    const { content, parentId, mediaUrl } = parse.data;

    // Verify post exists and is not archived or restricted
    const targetPost = await prisma.post.findUnique({ where: { id: postId } });
    if (!targetPost || targetPost.isArchived) {
      return res.status(404).json({ success: false, message: 'Post not found.' });
    }

    if (targetPost.privacy === 'ONLY_ME' && targetPost.authorId !== req.user!.userId) {
      return res.status(403).json({ success: false, message: 'You do not have permission to comment on this post.' });
    }

    const comment = await prisma.comment.create({
      data: { postId, userId: req.user!.userId, content, parentId, mediaUrl },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        replies: {
          take: 10,
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    await prisma.post.update({ where: { id: postId }, data: { commentsCount: { increment: 1 } } });

    const commenterName = comment.user?.displayName || 'Someone';
    const snippet = content.length > 40 ? content.slice(0, 40) + '...' : content;

    if (parentId) {
      // Replying to a comment: notify parent comment author
      try {
        const parentComment = await prisma.comment.findUnique({ where: { id: parentId } });
        if (parentComment && parentComment.userId !== req.user!.userId) {
          createNotification({
            recipientId: parentComment.userId,
            senderId: req.user!.userId,
            type: 'COMMENT',
            entityId: postId,
            entityType: 'POST',
            message: `${commenterName} replied to your comment: "${snippet}"`,
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Parent comment lookup error:', err);
      }
    } else {
      // Top-level comment: Notify post author if not self
      if (targetPost.authorId !== req.user!.userId) {
        createNotification({
          recipientId: targetPost.authorId,
          senderId: req.user!.userId,
          type: 'COMMENT',
          entityId: postId,
          entityType: 'POST',
          message: `${commenterName} commented on your post: "${snippet}"`,
        }).catch(() => {});
      }
    }

    return res.status(201).json({ success: true, data: comment });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to submit comment.' });
  }
}

export async function sharePost(req: AuthenticatedRequest, res: Response) {
  try {
    const { postId } = req.params;
    const { caption } = req.body;

    const share = await prisma.share.create({
      data: { postId, userId: req.user!.userId, caption },
    });

    await prisma.post.update({ where: { id: postId }, data: { sharesCount: { increment: 1 } } });
    return res.status(201).json({ success: true, message: 'Post shared successfully!', data: share });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to share post.' });
  }
}

export async function savePost(req: AuthenticatedRequest, res: Response) {
  try {
    const { postId } = req.params;
    const userId = req.user!.userId;
    const { collectionName } = req.body;

    const existing = await prisma.savedPost.findUnique({
      where: { userId_postId: { userId, postId } },
    });

    if (existing) {
      await prisma.savedPost.delete({ where: { userId_postId: { userId, postId } } });
      return res.json({ success: true, action: 'unsaved' });
    } else {
      await prisma.savedPost.create({ data: { userId, postId, collectionName: collectionName || 'All Saved' } });
      return res.json({ success: true, action: 'saved', message: 'Post saved! 🔖' });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to save post.' });
  }
}

export async function getSavedPosts(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;
    const saved = await prisma.savedPost.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        post: {
          include: {
            author: { select: { id: true, username: true, displayName: true, avatarUrl: true, isVerified: true } },
            _count: { select: { likes: true, comments: true } },
          },
        },
      },
    });

    return res.json({ success: true, data: saved.map((s) => ({ ...s.post, savedAt: s.createdAt })) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load saved posts.' });
  }
}
