import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import crypto from 'crypto';

const initiateCallSchema = z.object({
  receiverIds: z.array(z.string().min(1)).min(1, 'Please specify at least one recipient').max(8, 'Group call can have at most 8 participants'),
  type: z.enum(['AUDIO', 'VIDEO']),
  conversationId: z.string().optional(), // for group calls
});

// ── Initiate 1-on-1 OR Group Call ──────────────────────────
export async function initiateCall(req: AuthenticatedRequest, res: Response) {
  try {
    const parse = initiateCallSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten().fieldErrors });
    }

    const { receiverIds, type, conversationId } = parse.data;
    const callerId = req.user!.userId;

    const isGroup = receiverIds.length > 1;

    const channelName = `call_${crypto.randomBytes(10).toString('hex')}`;

    const session = await prisma.callSession.create({
      data: {
        isGroup,
        conversationId,
        type: type as any,
        status: 'CALLING',
        channelName,
        participants: {
          create: [
            // Caller
            { userId: callerId, isInitiator: true },
            // Receivers
            ...receiverIds.map((uid) => ({ userId: uid, isInitiator: false })),
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    return res.status(201).json({
      success: true,
      message: isGroup ? 'Group call started!' : 'Calling...',
      data: session,
    });
  } catch (error) {
    console.error('Call initiate error:', error);
    return res.status(500).json({ success: false, message: 'Failed to start call.' });
  }
}

// ── Update call status ──────────────────────────────────────
export async function updateCallStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { callId } = req.params;
    const { status } = req.body;
    const userId = req.user!.userId;

    const validStatuses = ['RINGING', 'ONGOING', 'COMPLETED', 'MISSED', 'DECLINED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid call status.' });
    }

    const existingSession = await prisma.callSession.findUnique({ where: { id: callId } });
    if (!existingSession) {
      return res.status(404).json({ success: false, message: 'Call session not found.' });
    }

    // 🔒 Security Check: Verify that requester is an actual participant of this call
    const isParticipant = await prisma.callParticipant.findFirst({
      where: { callId, userId },
    });
    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Security error: You are not a participant in this call.',
      });
    }

    const durationSeconds =
      status === 'COMPLETED' && existingSession.answeredAt
        ? Math.max(0, Math.floor((Date.now() - new Date(existingSession.answeredAt).getTime()) / 1000))
        : 0;

    const session = await prisma.callSession.update({
      where: { id: callId },
      data: {
        status: status as any,
        ...(status === 'ONGOING' ? { answeredAt: new Date() } : {}),
        ...(status === 'COMPLETED' || status === 'DECLINED' || status === 'MISSED'
          ? {
              endedAt: new Date(),
              durationSeconds,
            }
          : {}),
      },
    });

    // Update participant left time if leaving
    if (status === 'COMPLETED' || status === 'DECLINED') {
      await prisma.callParticipant.updateMany({
        where: { callId, userId },
        data: { leftAt: new Date() },
      });
    }

    return res.json({ success: true, data: session });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update call status.' });
  }
}

// ── Get call history ───────────────────────────────────────
export async function getCallHistory(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user!.userId;

    const calls = await prisma.callSession.findMany({
      where: {
        participants: { some: { userId } },
        status: { in: ['COMPLETED', 'MISSED', 'DECLINED'] },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    return res.json({ success: true, data: calls });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load call history.' });
  }
}
