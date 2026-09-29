import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyAccessToken } from '../lib/security';
import { prisma } from '../lib/prisma';
import { setupLudoSocketHandlers } from './ludoEngine';

// Map: userId -> Set of active socket IDs (supports multiple devices/tabs per user)
const userSockets = new Map<string, Set<string>>();
const recentCallInitiations = new Map<string, number>();
const recentCallAnswers = new Map<string, number>();
const streamViewers = new Map<string, Set<string>>(); // streamId -> Set of viewer IDs
const socketStreamMap = new Map<string, { streamId: string; isHost: boolean }>(); // socket.id -> stream info
let globalIO: SocketIOServer | null = null;

export const getSocketIO = () => globalIO;
export const isUserOnline = (userId: string): boolean =>
  userSockets.has(userId) && (userSockets.get(userId)?.size || 0) > 0;
export const getOnlineUserIds = (): string[] => Array.from(userSockets.keys());

export function setupSocketIO(io: SocketIOServer) {
  globalIO = io;
  // Authentication middleware for socket connections
  io.use((socket: Socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.split(' ')[1];

    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    const payload = verifyAccessToken(token);
    if (!payload) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }

    (socket as any).userId = payload.userId;
    next();
  });

  io.on('connection', async (socket: Socket) => {
    const userId = (socket as any).userId;

    // Register user in multi-socket mapping
    if (!userSockets.has(userId)) {
      userSockets.set(userId, new Set());
    }
    userSockets.get(userId)!.add(socket.id);

    // Update user's lastSeenAt on connect
    prisma.user
      .update({
        where: { id: userId },
        data: { lastSeenAt: new Date() },
      })
      .catch(() => {});

    // 🔒 Join isolated personal user room (GUARANTEES targeted private delivery)
    socket.join(`user_${userId}`);

    // Broadcast online presence
    io.emit('user:online', { userId });
    socket.emit('users:online_list', Array.from(userSockets.keys()));

    console.log(`[Socket] User connected: ${userId} (Socket ID: ${socket.id}, Room: user_${userId})`);

    // Real-time heartbeat from active user to refresh lastSeenAt
    socket.on('user:heartbeat', () => {
      prisma.user
        .update({
          where: { id: userId },
          data: { lastSeenAt: new Date() },
        })
        .catch(() => {});
    });

    // ── 1. CHAT & MESSAGING ──────────────────────────────────────────
    socket.on('chat:join', async (conversationId: string) => {
      try {
        if (!conversationId) return;

        // Security check: Verify user is a participant of this conversation
        const isMember = await prisma.conversationParticipant.findUnique({
          where: {
            conversationId_userId: {
              conversationId,
              userId,
            },
          },
        });

        if (isMember) {
          socket.join(`conv_${conversationId}`);
        } else {
          socket.emit('chat:error', {
            message: 'Unauthorized conversation room',
          });
        }
      } catch (err) {
        console.error('[Socket] chat:join error:', err);
      }
    });

    socket.on('chat:typing', ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      if (!conversationId) return;
      socket.to(`conv_${conversationId}`).emit('chat:user_typing', { userId, isTyping });
    });

    socket.on('chat:send_message', async (message: any) => {
      if (!message || !message.conversationId) return;

      try {
        // Double-check participant authorization
        const isMember = await prisma.conversationParticipant.findUnique({
          where: {
            conversationId_userId: {
              conversationId: message.conversationId,
              userId,
            },
          },
        });

        if (!isMember) return;

        // Broadcast to other members in the active conversation room (excluding sender)
        socket.to(`conv_${message.conversationId}`).emit('chat:new_message', message);

        // Also push notification to each recipient's private user room
        const participants = await prisma.conversationParticipant.findMany({
          where: {
            conversationId: message.conversationId,
            userId: { not: userId },
          },
          select: { userId: true },
        });

        for (const p of participants) {
          io.to(`user_${p.userId}`).emit('chat:incoming_notification', {
            conversationId: message.conversationId,
            message,
          });
        }
      } catch (err) {
        console.error('[Socket] chat:send_message error:', err);
      }
    });

    // ── 2. WEBRTC AUDIO & VIDEO CALL SIGNALING (100% TARGETED) ───────
    socket.on('call:initiate', async ({ receiverId, offer, callType, callId }) => {
      if (!receiverId || receiverId === userId) {
        return socket.emit('call:error', { message: 'Invalid receiver ID' });
      }

      // Deduplicate rapid re-emits for the same call session (within 2 seconds)
      const dedupeKey = `${userId}_${receiverId}_${callId}`;
      const now = Date.now();
      const lastInitiated = recentCallInitiations.get(dedupeKey);
      if (lastInitiated && now - lastInitiated < 2000) {
        console.log(`[Socket Call] Deduplicating call:initiate for ${dedupeKey}`);
        return;
      }
      recentCallInitiations.set(dedupeKey, now);
      if (recentCallInitiations.size > 2000) recentCallInitiations.clear();

      const room = io.sockets.adapter.rooms.get(`user_${receiverId}`);
      const receiverSet = userSockets.get(receiverId);
      const isReceiverOnline = (receiverSet && receiverSet.size > 0) || (room && room.size > 0);
      if (!isReceiverOnline) {
        console.log(`[Socket Call] Receiver ${receiverId} is offline`);
        return socket.emit('call:user_offline', { receiverId, message: 'User is currently offline' });
      }

      try {
        const caller = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        });

        // 🔔 1. Instantly notify caller that receiver device is RINGING
        socket.emit('call:ringing', { receiverId, callId });

        // 🔒 2. Route to target user's private room (or fallback to active sockets)
        const callPayload = {
          callerId: userId,
          caller,
          callId,
          offer,
          callType,
        };

        const targetRoom = io.sockets.adapter.rooms.get(`user_${receiverId}`);
        console.log(`[Socket Call] Initiating call ${callId}: target=${receiverId}, offerType=${offer?.type}, sdpLen=${offer?.sdp?.length || 0}`);
        if (targetRoom && targetRoom.size > 0) {
          io.to(`user_${receiverId}`).emit('call:incoming', callPayload);
        } else if (receiverSet) {
          for (const sId of receiverSet) {
            io.to(sId).emit('call:incoming', callPayload);
          }
        }

        console.log(`[Socket Call] Delivered incoming call from ${userId} to user_${receiverId} (callId: ${callId})`);
      } catch (err) {
        console.error('[Socket] call:initiate error:', err);
      }
    });

    socket.on('call:answer', ({ callerId, answer, callId }) => {
      if (!callerId) return;

      const dedupeKey = `${userId}_${callerId}_${callId}`;
      const now = Date.now();
      const lastAnswered = recentCallAnswers.get(dedupeKey);
      if (lastAnswered && now - lastAnswered < 2000) {
        console.log(`[Socket Call] Deduplicating call:answer for ${dedupeKey}`);
        return;
      }
      recentCallAnswers.set(dedupeKey, now);
      if (recentCallAnswers.size > 2000) recentCallAnswers.clear();

      console.log(`[Socket Call] Answer from ${userId} to caller ${callerId}: answerType=${answer?.type}, sdpLen=${answer?.sdp?.length || 0}`);
      const answerPayload = {
        receiverId: userId,
        callId,
        answer,
      };

      const targetRoom = io.sockets.adapter.rooms.get(`user_${callerId}`);
      if (targetRoom && targetRoom.size > 0) {
        io.to(`user_${callerId}`).emit('call:answered', answerPayload);
      } else {
        const callerSet = userSockets.get(callerId);
        if (callerSet) {
          for (const sId of callerSet) {
            io.to(sId).emit('call:answered', answerPayload);
          }
        }
      }
    });

    socket.on('call:decline', ({ callerId, callId }) => {
      if (!callerId) return;
      console.log(`[Socket Call] Call declined by ${userId} for caller ${callerId}`);
      const declinePayload = { receiverId: userId, callId };

      const targetRoom = io.sockets.adapter.rooms.get(`user_${callerId}`);
      if (targetRoom && targetRoom.size > 0) {
        io.to(`user_${callerId}`).emit('call:declined', declinePayload);
      } else {
        const callerSet = userSockets.get(callerId);
        if (callerSet) {
          for (const sId of callerSet) {
            io.to(sId).emit('call:declined', declinePayload);
          }
        }
      }
    });

    socket.on('call:ice-candidate', ({ targetUserId, candidate }) => {
      if (!targetUserId || !candidate) return;
      console.log(`[Socket Call] ICE candidate from ${userId} to ${targetUserId}: candLen=${candidate?.candidate?.length || 0}, sdpMid=${candidate?.sdpMid}`);
      const icePayload = { senderId: userId, candidate };

      const targetRoom = io.sockets.adapter.rooms.get(`user_${targetUserId}`);
      if (targetRoom && targetRoom.size > 0) {
        io.to(`user_${targetUserId}`).emit('call:ice-candidate', icePayload);
      } else {
        const targetSet = userSockets.get(targetUserId);
        if (targetSet) {
          for (const sId of targetSet) {
            io.to(sId).emit('call:ice-candidate', icePayload);
          }
        }
      }
    });

    socket.on('call:end', ({ targetUserId, callId }) => {
      if (!targetUserId) return;
      console.log(`[Socket Call] Call ended by ${userId} for ${targetUserId}`);
      const endPayload = { callId, senderId: userId };

      const targetRoom = io.sockets.adapter.rooms.get(`user_${targetUserId}`);
      if (targetRoom && targetRoom.size > 0) {
        io.to(`user_${targetUserId}`).emit('call:ended', endPayload);
      } else {
        const targetSet = userSockets.get(targetUserId);
        if (targetSet) {
          for (const sId of targetSet) {
            io.to(sId).emit('call:ended', endPayload);
          }
        }
      }
    });

    // ── 3. LIVE STREAMING INTERACTIONS & REAL-TIME WEBRTC BROADCASTING ──
    socket.on('live:join', async ({ streamId }) => {
      if (!streamId) return;
      socket.join(`live_${streamId}`);

      let isHost = false;
      try {
        const stream = await prisma.liveStream.findUnique({ where: { id: streamId } });
        if (stream && stream.hostId === userId) {
          isHost = true;
        }
      } catch (err) {
        console.error('[Live] Error checking stream host:', err);
      }

      socketStreamMap.set(socket.id, { streamId, isHost });

      let viewers = streamViewers.get(streamId);
      if (!viewers) {
        viewers = new Set();
        streamViewers.set(streamId, viewers);
      }

      if (!isHost) {
        viewers.add(userId || socket.id);
      }

      const viewerCount = viewers.size;

      // Update database viewerCount
      prisma.liveStream
        .updateMany({
          where: { id: streamId },
          data: { viewerCount },
        })
        .catch(() => {});

      // Notify host and all participants in the room
      io.to(`live_${streamId}`).emit('live:viewer_joined', {
        viewerSocketId: socket.id,
        userId,
        viewerCount,
        isHost,
      });
      io.to(`live_${streamId}`).emit('live:stats', { viewerCount });
    });

    socket.on('live:leave', ({ streamId }) => {
      if (!streamId) return;
      socket.leave(`live_${streamId}`);
      const info = socketStreamMap.get(socket.id);
      socketStreamMap.delete(socket.id);

      const viewers = streamViewers.get(streamId);
      if (viewers && (!info || !info.isHost)) {
        viewers.delete(userId || socket.id);
      }
      const viewerCount = viewers ? viewers.size : 0;

      prisma.liveStream
        .updateMany({
          where: { id: streamId },
          data: { viewerCount },
        })
        .catch(() => {});

      io.to(`live_${streamId}`).emit('live:viewer_left', {
        viewerSocketId: socket.id,
        userId,
        viewerCount,
      });
      io.to(`live_${streamId}`).emit('live:stats', { viewerCount });
    });

    // WebRTC Signaling for Live Broadcast (Broadcaster <-> Viewer)
    socket.on('live:offer', ({ targetSocketId, offer, streamId }) => {
      if (!targetSocketId || !offer) return;
      io.to(targetSocketId).emit('live:offer', {
        broadcasterSocketId: socket.id,
        offer,
        streamId,
      });
    });

    socket.on('live:answer', ({ targetSocketId, answer, streamId }) => {
      if (!targetSocketId || !answer) return;
      io.to(targetSocketId).emit('live:answer', {
        viewerSocketId: socket.id,
        answer,
        streamId,
      });
    });

    socket.on('live:ice_candidate', ({ targetSocketId, candidate, streamId }) => {
      if (!targetSocketId || !candidate) return;
      io.to(targetSocketId).emit('live:ice_candidate', {
        senderSocketId: socket.id,
        candidate,
        streamId,
      });
    });

    socket.on('live:stream_started', ({ streamId, title, host }) => {
      io.emit('live:stream_started_global', {
        streamId,
        title,
        hostId: userId,
        host,
      });
    });

    socket.on('live:stream_ended', ({ streamId }) => {
      if (streamId) {
        streamViewers.delete(streamId);
      }
      io.to(`live_${streamId}`).emit('live:stream_ended', { streamId });
      io.emit('live:stream_ended_global', { streamId });
    });

    socket.on('live:comment', async ({ streamId, comment }) => {
      if (!streamId || !comment?.text) return;
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, username: true, displayName: true, avatarUrl: true },
        });

        const savedComment = await (prisma as any).liveComment.create({
          data: {
            id: comment.id,
            streamId,
            userId,
            text: comment.text.trim(),
          },
        });

        const payload = {
          id: savedComment.id,
          streamId,
          userId,
          user: user?.displayName || user?.username || comment.user || 'User',
          avatar: user?.avatarUrl || comment.avatar || '',
          text: savedComment.text,
          createdAt: savedComment.createdAt,
        };

        io.to(`live_${streamId}`).emit('live:new_comment', payload);
      } catch (err) {
        console.error('[Live] Error saving comment:', err);
        io.to(`live_${streamId}`).emit('live:new_comment', {
          id: comment.id,
          streamId,
          userId,
          ...comment,
        });
      }
    });

    socket.on('live:reaction', ({ streamId, reactionType }) => {
      if (!streamId) return;
      io.to(`live_${streamId}`).emit('live:new_reaction', {
        userId,
        reactionType,
      });
    });

    // ── 4. MULTIPLAYER REAL-TIME LUDO ─────────────────────────────────
    setupLudoSocketHandlers(io, socket, userId);

    // ── 5. DISCONNECT CLEANUP ─────────────────────────────────────────
    socket.on('disconnect', () => {
      // Clean up live stream viewer state on disconnect
      const liveInfo = socketStreamMap.get(socket.id);
      if (liveInfo) {
        const { streamId, isHost } = liveInfo;
        socketStreamMap.delete(socket.id);
        const viewers = streamViewers.get(streamId);
        if (viewers && !isHost) {
          viewers.delete(userId || socket.id);
          const viewerCount = viewers.size;
          prisma.liveStream
            .updateMany({
              where: { id: streamId },
              data: { viewerCount },
            })
            .catch(() => {});
          io.to(`live_${streamId}`).emit('live:viewer_left', {
            viewerSocketId: socket.id,
            userId,
            viewerCount,
          });
          io.to(`live_${streamId}`).emit('live:stats', { viewerCount });
        }
      }

      const userSet = userSockets.get(userId);
      if (userSet) {
        userSet.delete(socket.id);
        if (userSet.size === 0) {
          userSockets.delete(userId);
          const lastSeenAt = new Date().toISOString();
          prisma.user
            .update({
              where: { id: userId },
              data: { lastSeenAt: new Date(lastSeenAt) },
            })
            .catch(() => {});
          io.emit('user:offline', { userId, lastSeenAt });

          // Auto-end any lingering live broadcast hosted by this user
          prisma.liveStream
            .updateMany({
              where: { hostId: userId, status: 'LIVE' },
              data: { status: 'ENDED', endedAt: new Date() },
            })
            .then((res: any) => {
              if (res && (res.count > 0 || res > 0)) {
                io.emit('live:stream_ended_global', { hostId: userId });
              }
            })
            .catch(() => {});
        }
      }
      console.log(`[Socket] User disconnected: ${userId} (${socket.id})`);
    });
  });
}
