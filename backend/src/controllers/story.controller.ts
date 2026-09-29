import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { notifyFriends } from '../services/notification.service';

const createStorySchema = z.object({
  mediaUrl: z.string().min(1, 'Please provide valid media'),
  mediaType: z.enum(['IMAGE', 'VIDEO']),
  caption: z.string().max(280).optional(),
  // 🎵 Music on Story
  musicTitle: z.string().max(100).optional(),
  musicArtist: z.string().max(100).optional(),
  musicUrl: z.string().optional(),
  musicStartSec: z.number().int().min(0).optional(),
  musicEndSec: z.number().int().min(0).optional(),
});

export async function getActiveStories(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;
    const now = new Date();

    const following = await prisma.follow.findMany({
      where: { followerId: currentUserId },
      select: { followingId: true },
    });
    const userIds = [currentUserId, ...following.map((f) => f.followingId)];

    const stories = await prisma.story.findMany({
      where: {
        userId: { in: userIds },
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
        views: {
          where: { viewerId: currentUserId },
          select: { id: true },
        },
      },
    });

    // Group by user
    const grouped: Record<string, any> = {};
    for (const story of stories) {
      const uid = story.userId;
      if (!grouped[uid]) {
        grouped[uid] = { user: story.user, hasUnseen: false, stories: [] };
      }
      const isSeen = story.views.length > 0;
      if (!isSeen && uid !== currentUserId) grouped[uid].hasUnseen = true;
      grouped[uid].stories.push({
        id: story.id,
        mediaUrl: story.mediaUrl,
        mediaType: story.mediaType,
        caption: story.caption,
        musicTitle: story.musicTitle,
        musicArtist: story.musicArtist,
        musicUrl: story.musicUrl,
        musicStartSec: story.musicStartSec,
        musicEndSec: story.musicEndSec,
        viewsCount: story.viewsCount,
        createdAt: story.createdAt,
        expiresAt: story.expiresAt,
        isSeen,
      });
    }

    // Sort groups so current user's story is first, then unseen stories
    const groupList = Object.values(grouped);
    groupList.sort((a: any, b: any) => {
      if (a.user.id === currentUserId) return -1;
      if (b.user.id === currentUserId) return 1;
      if (a.hasUnseen && !b.hasUnseen) return -1;
      if (!a.hasUnseen && b.hasUnseen) return 1;
      return 0;
    });

    return res.json({ success: true, data: groupList });
  } catch (error) {
    console.error('Stories error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load stories.' });
  }
}

export async function createStory(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Support batch creation of multiple stories at once
    if (Array.isArray(req.body.items) && req.body.items.length > 0) {
      const items = req.body.items;
      const createdStories = await prisma.$transaction(
        items.map((item: any) =>
          prisma.story.create({
            data: {
              userId: currentUserId,
              mediaUrl: item.mediaUrl,
              mediaType: (item.mediaType as any) || 'IMAGE',
              caption: item.caption,
              musicTitle: item.musicTitle,
              musicArtist: item.musicArtist,
              musicUrl: item.musicUrl,
              musicStartSec: item.musicStartSec,
              musicEndSec: item.musicEndSec,
              expiresAt,
            },
            include: {
              user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
            },
          })
        )
      );

      return res.status(201).json({
        success: true,
        message: `${createdStories.length} stories uploaded successfully! (Active for 24 hours) 🌟`,
        data: createdStories,
      });
    }

    // Single story creation fallback
    const parse = createStorySchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten().fieldErrors });
    }

    const { mediaUrl, mediaType, caption, musicTitle, musicArtist, musicUrl, musicStartSec, musicEndSec } = parse.data;

    const story = await prisma.story.create({
      data: {
        userId: currentUserId,
        mediaUrl,
        mediaType: mediaType as any,
        caption,
        musicTitle,
        musicArtist,
        musicUrl,
        musicStartSec,
        musicEndSec,
        expiresAt,
      },
      include: {
        user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Story uploaded successfully! (Active for 24 hours) 🌟',
      data: story,
    });
  } catch (error) {
    console.error('Create story error:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload story.' });
  }
}

export async function viewStory(req: AuthenticatedRequest, res: Response) {
  try {
    const { storyId } = req.params;
    const viewerId = req.user!.userId;

    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) return res.status(404).json({ success: false, message: 'Story not found.' });

    const existing = await prisma.storyView.findUnique({
      where: { storyId_viewerId: { storyId, viewerId } },
    });

    if (!existing) {
      await prisma.storyView.create({ data: { storyId, viewerId } });
      await prisma.story.update({ where: { id: storyId }, data: { viewsCount: { increment: 1 } } });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to record story view.' });
  }
}

export async function getStoryViewers(req: AuthenticatedRequest, res: Response) {
  try {
    const { storyId } = req.params;
    const currentUserId = req.user!.userId;

    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found.' });
    }

    // Only the story owner can see who viewed
    if (story.userId !== currentUserId) {
      return res.status(403).json({ success: false, message: 'Only the story owner can see viewers.' });
    }

    // Get all views for this story with viewer info
    const views = await prisma.storyView.findMany({
      where: { storyId },
      include: {
        viewer: {
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        },
      },
      orderBy: { viewedAt: 'desc' },
    });

    return res.json({ success: true, data: views });
  } catch (error) {
    console.error('Get story viewers error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load story viewers.' });
  }
}

export async function deleteStory(req: AuthenticatedRequest, res: Response) {
  try {
    const { storyId } = req.params;
    const currentUserId = req.user!.userId;

    const story = await prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, userId: true },
    });

    if (!story) {
      return res.status(404).json({ success: false, message: 'Story not found.' });
    }

    if (story.userId !== currentUserId) {
      return res.status(403).json({ success: false, message: 'You can only delete your own stories.' });
    }

    // Delete associated story views
    await prisma.storyView.deleteMany({
      where: { storyId },
    });

    // Delete the story record
    await prisma.story.delete({
      where: { id: storyId },
    });

    return res.json({
      success: true,
      message: 'Story deleted successfully! 🗑️',
    });
  } catch (error) {
    console.error('Delete story error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete story.' });
  }
}
