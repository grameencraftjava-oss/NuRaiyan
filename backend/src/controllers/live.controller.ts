import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import crypto from 'crypto';
import { notifyFriends } from '../services/notification.service';
import { isUserOnline } from '../sockets/socketHandler';

const startLiveSchema = z.object({
  title: z.string().min(1, 'Please provide a stream title').max(100),
});

export async function startLive(req: AuthenticatedRequest, res: Response) {
  try {
    const parse = startLiveSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten().fieldErrors });
    }

    const { title } = parse.data;
    const hostId = req.user!.userId;
    const streamKey = `live_${crypto.randomBytes(12).toString('hex')}`;

    const stream = await prisma.liveStream.create({
      data: {
        hostId,
        title,
        streamKey,
        status: 'LIVE',
      },
      include: {
        host: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const hostName = stream.host?.displayName || stream.host?.username || 'Your friend';
    notifyFriends({
      authorId: hostId,
      type: 'LIVE',
      entityId: stream.id,
      entityType: 'live',
      message: `${hostName} started a live broadcast: "${title}"`,
      imageUrl: stream.host?.avatarUrl,
    }).catch(err => console.error('[Live] Notification error:', err));

    return res.status(201).json({
      success: true,
      message: 'Live broadcast ready!',
      data: stream,
    });
  } catch (error) {
    console.error('Start live error:', error);
    return res.status(500).json({ success: false, message: 'Failed to start live broadcast.' });
  }
}

export async function getActiveLiveStreams(req: AuthenticatedRequest, res: Response) {
  try {
    const rawStreams = await prisma.liveStream.findMany({
      where: { status: 'LIVE' },
      orderBy: { viewerCount: 'desc' },
      include: {
        host: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    });

    const activeStreams: any[] = [];
    const now = Date.now();

    for (const stream of rawStreams) {
      const streamAgeMs = now - new Date(stream.startedAt || 0).getTime();
      const hostOnline = isUserOnline(stream.hostId);

      // Auto-expire zombie/abandoned streams:
      // If host is offline OR stream has been open for more than 2 hours without ending
      if (!hostOnline || streamAgeMs > 2 * 60 * 60 * 1000) {
        await prisma.liveStream.updateMany({
          where: { id: stream.id },
          data: {
            status: 'ENDED',
            endedAt: new Date(),
          },
        });
        continue;
      }

      activeStreams.push(stream);
    }

    return res.json({ success: true, data: activeStreams });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load live stream.' });
  }
}

export async function getLiveStreamById(req: AuthenticatedRequest, res: Response) {
  try {
    const { streamId } = req.params;
    const stream = await prisma.liveStream.findFirst({
      where: { id: streamId },
      include: {
        host: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
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

    if (!stream) {
      return res.status(404).json({ success: false, message: 'Live stream not found.' });
    }

    return res.json({ success: true, data: stream });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load live stream.' });
  }
}

export async function addLiveComment(req: AuthenticatedRequest, res: Response) {
  try {
    const { streamId } = req.params;
    const { text, id } = req.body || {};
    const userId = req.user!.userId;

    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Comment text is required.' });
    }

    const comment = await (prisma as any).liveComment.create({
      data: {
        ...(id ? { id } : {}),
        streamId,
        userId,
        text: text.trim(),
      },
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
    });

    return res.status(201).json({ success: true, data: comment });
  } catch (error) {
    console.error('Add live comment error:', error);
    return res.status(500).json({ success: false, message: 'Failed to post live comment.' });
  }
}

export async function endLive(req: AuthenticatedRequest, res: Response) {
  try {
    const { streamId } = req.params;
    const { recordingUrl, peakViewers, durationSeconds } = req.body || {};
    const hostId = req.user!.userId;

    const stream = await prisma.liveStream.updateMany({
      where: { id: streamId, hostId },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
        ...(recordingUrl ? { recordingUrl } : {}),
        ...(peakViewers !== undefined ? { peakViewers } : {}),
        ...(durationSeconds !== undefined ? { durationSeconds } : {}),
      },
    });

    return res.json({ success: true, message: 'Live broadcast ended successfully and recording saved.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to end live broadcast.' });
  }
}

// ── Get Full Live Stream Recordings / Replays (Permanent Retention)
export async function getLiveReplays(req: AuthenticatedRequest, res: Response) {
  try {
    const replays = await prisma.liveStream.findMany({
      where: { status: 'ENDED' },
      orderBy: { endedAt: 'desc' },
      take: 20,
      include: {
        host: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
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

    return res.json({ success: true, data: replays });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load live recordings.' });
  }
}

// ── Delete Live Stream Recording (Only Host Can Permanently Delete)
export async function deleteLiveStream(req: AuthenticatedRequest, res: Response) {
  try {
    const { streamId } = req.params;
    const hostId = req.user!.userId;

    const stream = await prisma.liveStream.findFirst({
      where: { id: streamId, hostId },
    });

    if (!stream) {
      return res.status(404).json({ success: false, message: 'Live record not found or you lack permission to delete it.' });
    }

    await prisma.liveStream.delete({
      where: { id: streamId },
    });

    return res.json({ success: true, message: 'Live recording permanently deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete recording.' });
  }
}
