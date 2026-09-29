import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getSocketIO } from '../sockets/socketHandler';

const sendMessageSchema = z.object({
  conversationId: z.string().optional(),
  recipientId: z.string().optional(),       // for new 1-1 chat
  recipientIds: z.array(z.string()).optional(), // for new group chat
  groupName: z.string().max(80).optional(),
  content: z.string().max(4000).optional(),
  mediaUrl: z.string().max(2000).optional().nullable(),
  messageType: z.enum(['TEXT','IMAGE','VIDEO','AUDIO','FILE','GIF']).default('TEXT'),
  isDisappearing: z.boolean().default(false),
  durationMinutes: z.number().int().min(1).optional(),
  replyToId: z.string().optional(),
});

const createGroupSchema = z.object({
  name: z.string().min(2, 'Please provide a group name').max(80),
  description: z.string().max(300).optional(),
  memberIds: z.array(z.string()).min(1, 'Please add at least one member'),
});

// ── GET all conversations ──────────────────────────────────
export async function getConversations(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId: currentUserId } },
      },
      orderBy: { lastMessageAt: 'desc' },
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true, lastSeenAt: true } },
          },
        },
        messages: {
          take: 1,
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true, content: true, messageType: true,
            senderId: true, createdAt: true,
            readBy: { where: { userId: currentUserId }, select: { readAt: true } },
          },
        },
      },
    });

    // 🔒 Identify which users are confirmed friends
    const friendships = await prisma.friendship.findMany({
      where: {
        status: 'ACCEPTED',
        OR: [{ senderId: currentUserId }, { receiverId: currentUserId }],
      },
    });
    const friendIds = new Set<string>();
    friendships.forEach((f) => {
      friendIds.add(f.senderId === currentUserId ? f.receiverId : f.senderId);
    });

    const formatted = conversations.map((conv) => {
      const otherParticipants = conv.participants.filter((p) => p.userId !== currentUserId);
      const lastMsg = conv.messages[0] || null;
      const isUnread = lastMsg &&
        lastMsg.senderId !== currentUserId &&
        lastMsg.readBy.length === 0;

      const otherUser = conv.isGroup ? null : otherParticipants[0]?.user;
      const isFriend = conv.isGroup || (otherUser ? friendIds.has(otherUser.id) : false);

      return {
        id: conv.id,
        isGroup: conv.isGroup,
        name: conv.isGroup ? conv.name : otherUser?.displayName,
        avatarUrl: conv.isGroup ? conv.avatarUrl : otherUser?.avatarUrl,
        participants: conv.participants.map((p) => p.user),
        otherUser,
        isFriend,
        isMessageRequest: !isFriend,
        lastMessage: lastMsg,
        isUnread,
        updatedAt: conv.lastMessageAt,
      };
    });

    return res.json({
      success: true,
      data: formatted,
      unreadCount: formatted.filter((c) => c.isUnread).length,
    });
  } catch (error) {
    console.error('Conversations error:', error);
    return res.status(500).json({ success: false, message: 'Failed to load conversations.' });
  }
}

// ── GET or CREATE 1-on-1 Conversation ─────────────────────
export async function getOrCreateConversation(req: AuthenticatedRequest, res: Response) {
  try {
    const { recipientId } = req.body;
    const currentUserId = req.user!.userId;

    if (!recipientId || recipientId === currentUserId) {
      return res.status(400).json({ success: false, message: 'Invalid recipient ID.' });
    }

    let conversation = await prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [
          { participants: { some: { userId: currentUserId } } },
          { participants: { some: { userId: recipientId } } },
        ],
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          isGroup: false,
          participants: {
            create: [{ userId: currentUserId }, { userId: recipientId }],
          },
        },
        include: {
          participants: {
            include: {
              user: { select: { id: true, username: true, displayName: true, avatarUrl: true, lastSeenAt: true } },
            },
          },
        },
      });
    }

    const otherParticipants = (conversation.participants || []).filter((p: any) => p.userId !== currentUserId);
    const otherUser = otherParticipants[0]?.user;

    const friendship = await prisma.friendship.findFirst({
      where: {
        status: 'ACCEPTED',
        OR: [
          { senderId: currentUserId, receiverId: recipientId },
          { senderId: recipientId, receiverId: currentUserId },
        ],
      },
    });

    const isFriend = !!friendship;

    const formatted = {
      id: conversation.id,
      isGroup: false,
      name: otherUser?.displayName || otherUser?.username || 'User',
      avatarUrl: otherUser?.avatarUrl || null,
      participants: (conversation.participants || []).map((p: any) => p.user),
      otherUser,
      isFriend,
      isMessageRequest: !isFriend,
      lastMessage: null,
      isUnread: false,
      updatedAt: conversation.lastMessageAt || conversation.createdAt,
    };

    return res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('getOrCreateConversation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to access conversation.' });
  }
}

// ── GET messages with persistent history ──────────────────
export async function getMessages(req: AuthenticatedRequest, res: Response) {
  try {
    const { conversationId } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 30);
    const skip = (page - 1) * limit;
    const currentUserId = req.user!.userId;

    // Verify user is in this conversation
    const participant = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId: currentUserId } },
    });
    if (!participant) {
      return res.status(403).json({ success: false, message: 'You do not have access to this conversation.' });
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        isDeleted: false,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      take: limit,
      skip,
      orderBy: { createdAt: 'desc' },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        replyTo: {
          select: {
            id: true, content: true, messageType: true,
            sender: { select: { displayName: true } },
          },
        },
        readBy: { select: { userId: true, readAt: true } },
      },
    });

    // Mark unread messages as read
    const unreadIds = messages
      .filter((m) => m.senderId !== currentUserId && !m.readBy.find((r) => r.userId === currentUserId))
      .map((m) => m.id);

    if (unreadIds.length > 0) {
      await prisma.messageRead.createMany({
        data: unreadIds.map((messageId) => ({ messageId, userId: currentUserId })),
        skipDuplicates: true,
      });

      await prisma.conversationParticipant.update({
        where: { conversationId_userId: { conversationId, userId: currentUserId } },
        data: { lastReadAt: new Date() },
      });

      try {
        const io = getSocketIO();
        if (io) {
          io.to(`conversation_${conversationId}`).emit('chat:messages_read', {
            conversationId,
            userId: currentUserId,
          });
          io.to(`user_${currentUserId}`).emit('chat:unread_updated', {
            conversationId,
          });
        }
      } catch {}
    }

    return res.json({
      success: true,
      data: messages.reverse(), // oldest first
      hasMore: messages.length === limit,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to load messages.' });
  }
}

// ── SEND message (1-1 or Group) ────────────────────────────
export async function sendMessage(req: AuthenticatedRequest, res: Response) {
  try {
    const parse = sendMessageSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten().fieldErrors });
    }

    const { conversationId: givenConvId, recipientId, recipientIds, groupName,
            content, mediaUrl, messageType, isDisappearing, durationMinutes, replyToId } = parse.data;
    const senderId = req.user!.userId;

    let convId = givenConvId;

    if (!convId) {
      if (recipientId) {
        // 1-on-1 chat
        const existing = await prisma.conversation.findFirst({
          where: {
            isGroup: false,
            AND: [
              { participants: { some: { userId: senderId } } },
              { participants: { some: { userId: recipientId } } },
            ],
          },
        });

        if (existing) {
          convId = existing.id;
        } else {
          const newConv = await prisma.conversation.create({
            data: {
              isGroup: false,
              participants: { create: [{ userId: senderId }, { userId: recipientId }] },
            },
          });
          convId = newConv.id;
        }
      } else if (recipientIds && recipientIds.length > 0) {
        // Group chat creation
        const allMembers = [senderId, ...recipientIds];
        const newGroup = await prisma.conversation.create({
          data: {
            isGroup: true,
            name: groupName || `Group Chat (${allMembers.length} members)`,
            adminId: senderId,
            participants: {
              create: allMembers.map((uid) => ({
                userId: uid,
                isAdmin: uid === senderId,
              })),
            },
          },
        });
        convId = newGroup.id;
      }
    }

    if (!convId) {
      return res.status(400).json({ success: false, message: 'Please provide a conversation ID or recipient.' });
    }

    // Verify sender belongs to this conversation
    const isMember = await prisma.conversationParticipant.findUnique({
      where: {
        conversationId_userId: {
          conversationId: convId,
          userId: senderId,
        },
      },
    });

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to send messages to this conversation.',
      });
    }

    const expiresAt = isDisappearing && durationMinutes
      ? new Date(Date.now() + durationMinutes * 60 * 1000)
      : null;

    const message = await prisma.message.create({
      data: {
        conversationId: convId,
        senderId,
        content,
        mediaUrl,
        messageType: messageType as any,
        isDisappearing,
        expiresAt,
        replyToId,
        isEncrypted: true,
      },
      include: {
        sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
        replyTo: {
          select: {
            id: true, content: true, messageType: true,
            sender: { select: { displayName: true } },
          },
        },
      },
    });

    // Update conversation lastMessageAt
    await prisma.conversation.update({
      where: { id: convId },
      data: { lastMessageAt: new Date(), updatedAt: new Date() },
    });

    // Real-time Targeted Socket Emission (guaranteed delivery to conversation room AND private user rooms)
    try {
      const io = req.app.get('io') || getSocketIO();
      if (io) {
        // 1. Emit to active conversation room
        io.to(`conv_${convId}`).emit('chat:new_message', message);

        const recipients = await prisma.conversationParticipant.findMany({
          where: { conversationId: convId, userId: { not: senderId } },
          select: { userId: true },
        });

        // 2. Also emit directly to each recipient's private user room (guaranteed delivery if not in room or on reconnect)
        for (const r of recipients) {
          io.to(`user_${r.userId}`).emit('chat:new_message', message);
          io.to(`user_${r.userId}`).emit('chat:incoming_notification', {
            conversationId: convId,
            message,
          });
        }
      }
    } catch (e) {
      console.warn('[Chat] Socket broadcast warning:', e);
    }

    return res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error('Send message error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
}

// ── Create Group Chat ──────────────────────────────────────
export async function createGroup(req: AuthenticatedRequest, res: Response) {
  try {
    const parse = createGroupSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, errors: parse.error.flatten().fieldErrors });
    }

    const { name, description, memberIds } = parse.data;
    const adminId = req.user!.userId;
    const allMembers = [adminId, ...memberIds.filter((id) => id !== adminId)];

    const group = await prisma.conversation.create({
      data: {
        isGroup: true,
        name,
        description,
        adminId,
        participants: {
          create: allMembers.map((uid) => ({
            userId: uid,
            isAdmin: uid === adminId,
          })),
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
      message: `Group "${name}" created! 🎊`,
      data: group,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to create group.' });
  }
}

// ── Delete a message (soft delete) ────────────────────────
export async function deleteMessage(req: AuthenticatedRequest, res: Response) {
  try {
    const { messageId } = req.params;
    const userId = req.user!.userId;

    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return res.status(404).json({ success: false, message: 'Message not found.' });
    if (message.senderId !== userId) {
      return res.status(403).json({ success: false, message: 'You can only delete your own messages.' });
    }

    await prisma.message.update({
      where: { id: messageId },
      data: { isDeleted: true, content: null, mediaUrl: null },
    });

    try {
      const io = req.app.get('io') || getSocketIO();
      if (io) {
        io.to(`conv_${message.conversationId}`).emit('chat:message_deleted', {
          messageId,
          conversationId: message.conversationId,
        });

        const participants = await prisma.conversationParticipant.findMany({
          where: { conversationId: message.conversationId },
          select: { userId: true },
        });
        for (const p of participants) {
          io.to(`user_${p.userId}`).emit('chat:message_deleted', {
            messageId,
            conversationId: message.conversationId,
          });
        }
      }
    } catch (e) {
      console.error('Socket emit error on delete:', e);
    }

    return res.json({ success: true, message: 'Message deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete message.' });
  }
}

// ── Delete a conversation (or message request) ────────────
export async function deleteConversation(req: AuthenticatedRequest, res: Response) {
  try {
    const { conversationId } = req.params;
    const userId = req.user!.userId;

    if (prisma.conversationParticipant) {
      await prisma.conversationParticipant.deleteMany({
        where: { conversationId, userId },
      });
    } else if (prisma.conversation?.delete) {
      await prisma.conversation.delete({
        where: { id: conversationId },
      });
    }

    return res.json({ success: true, message: 'Conversation removed.' });
  } catch (error) {
    console.error('Delete conversation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete conversation.' });
  }
}

// ── GET unread conversations count ────────────────────────
export async function getUnreadCount(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: { some: { userId: currentUserId } },
      },
      include: {
        messages: {
          take: 1,
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            senderId: true,
            readBy: { where: { userId: currentUserId }, select: { readAt: true } },
          },
        },
      },
    });

    const unreadCount = conversations.filter((conv) => {
      const lastMsg = conv.messages[0];
      return (
        lastMsg &&
        lastMsg.senderId !== currentUserId &&
        (!lastMsg.readBy || lastMsg.readBy.length === 0)
      );
    }).length;

    return res.json({ success: true, count: unreadCount });
  } catch (error) {
    console.error('getUnreadCount error:', error);
    return res.status(500).json({ success: false, count: 0 });
  }
}

// ── Mark conversation as read ─────────────────────────────
export async function markConversationAsRead(req: AuthenticatedRequest, res: Response) {
  try {
    const currentUserId = req.user!.userId;
    const { conversationId } = req.params;

    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: currentUserId },
        isDeleted: false,
        readBy: { none: { userId: currentUserId } },
      },
      select: { id: true },
    });

    if (unreadMessages.length > 0) {
      await prisma.messageRead.createMany({
        data: unreadMessages.map((m) => ({ messageId: m.id, userId: currentUserId })),
        skipDuplicates: true,
      });
    }

    await prisma.conversationParticipant.update({
      where: { conversationId_userId: { conversationId, userId: currentUserId } },
      data: { lastReadAt: new Date() },
    }).catch(() => {});

    try {
      const io = getSocketIO();
      if (io) {
        io.to(`conversation_${conversationId}`).emit('chat:messages_read', {
          conversationId,
          userId: currentUserId,
        });
        io.to(`user_${currentUserId}`).emit('chat:unread_updated', {
          conversationId,
        });
      }
    } catch {}

    return res.json({ success: true, markedCount: unreadMessages.length });
  } catch (error) {
    console.error('markConversationAsRead error:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark as read.' });
  }
}

