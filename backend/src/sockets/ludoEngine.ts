import crypto from 'crypto';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';

// Standard 2-Player Ludo Track
// -1 = In Base Yard
// 0..50 = Common circular track (52 squares)
// 51..55 = Player's private Home Column / Runway
// 56 = Reached Home (Winner Goal)
export const SAFE_SQUARES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

export interface PlayerInfo {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  color: 'RED' | 'GREEN';
  tokens: number[]; // 4 tokens: -1 (base) to 56 (home)
}

export interface LudoChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  text: string;
  createdAt: number;
}

export interface LudoGame {
  gameId: string;
  players: Record<string, PlayerInfo>;
  playerOrder: string[]; // [userId1, userId2]
  currentTurn: string; // userId
  diceValue: number | null;
  hasRolled: boolean;
  consecutiveSixes: number;
  winner: string | null;
  lastAction: string;
  movableTokens: number[];
  createdAt: number;
  turnDeadline: number; // 30-sec countdown timestamp in ms
}

// In-Memory active game sessions & 30-second turn timers
export const TURN_TIMEOUT_MS = 30000; // 30 Seconds Auto-Play Timer
export const activeLudoGames = new Map<string, LudoGame>();
export const activeLudoTimers = new Map<string, NodeJS.Timeout>();

// Cryptographically secure, zero-bias physical dice simulation (1 - 6)
export function rollUnpredictableDice(): number {
  return crypto.randomInt(1, 7);
}


// Convert player-relative token position to global board coordinate for capture checks
export function getGlobalCoordinate(color: 'RED' | 'GREEN', pos: number): number | null {
  if (pos < 0 || pos > 50) return null; // In base or home runway
  const offset = color === 'RED' ? 0 : 26; // Green starts half-way at 26
  return (pos + offset) % 52;
}

// Calculate legal moves for current player
export function getMovableTokens(player: PlayerInfo, dice: number): number[] {
  const movable: number[] = [];

  player.tokens.forEach((pos, idx) => {
    // If token is already home, it cannot move
    if (pos >= 56) return;

    // Token in base requires a 6 to open
    if (pos === -1) {
      if (dice === 6) movable.push(idx);
      return;
    }

    // Token on track moving towards or inside home runway
    const nextPos = pos + dice;
    if (nextPos <= 56) {
      movable.push(idx);
    }
  });

  return movable;
}

// Clear existing 30s turn timer for a game
export function clearGameTimer(gameId: string) {
  const timer = activeLudoTimers.get(gameId);
  if (timer) {
    clearTimeout(timer);
    activeLudoTimers.delete(gameId);
  }
}

// Start/Restart 30s turn countdown timer
export function startTurnTimer(gameId: string, io: SocketIOServer) {
  clearGameTimer(gameId);
  const game = activeLudoGames.get(gameId);
  if (!game || game.winner) return;

  game.turnDeadline = Date.now() + TURN_TIMEOUT_MS;

  const timer = setTimeout(() => {
    handleTurnTimeout(gameId, io);
  }, TURN_TIMEOUT_MS);

  activeLudoTimers.set(gameId, timer);
}

// Execute token move on board, checking capture, home, winner, bonus turn
export function applyTokenMove(game: LudoGame, userId: string, tokenIndex: number, io: SocketIOServer): boolean {
  if (!game || game.winner) return false;
  const player = game.players[userId];
  if (!player) return false;

  const currentPos = player.tokens[tokenIndex];
  let nextPos = currentPos;
  let hasCaptured = false;
  const opponentId = game.playerOrder.find((id) => id !== userId)!;
  const opponent = game.players[opponentId];

  if (currentPos === -1) {
    nextPos = 0;
    game.lastAction = `${player.displayName} brought a token out!`;
  } else {
    nextPos = currentPos + (game.diceValue || 0);
    game.lastAction = `${player.displayName} moved a token forward.`;
  }

  player.tokens[tokenIndex] = nextPos;

  // Check Capture if on common track (0..50)
  if (nextPos >= 0 && nextPos <= 50) {
    const myGlobalCoord = getGlobalCoordinate(player.color, nextPos);
    if (myGlobalCoord !== null && !SAFE_SQUARES.has(myGlobalCoord)) {
      opponent.tokens.forEach((oppPos, oppIdx) => {
        if (oppPos >= 0 && oppPos <= 50) {
          const oppGlobalCoord = getGlobalCoordinate(opponent.color, oppPos);
          if (oppGlobalCoord === myGlobalCoord) {
            opponent.tokens[oppIdx] = -1;
            hasCaptured = true;
            game.lastAction = `💥 ${player.displayName} captured ${opponent.displayName}'s token! Bonus turn awarded.`;
          }
        }
      });
    }
  }

  // Check Home (Win Goal: 56)
  if (nextPos === 56) {
    game.lastAction = `🎯 ${player.displayName}'s token reached Home!`;
  }

  // Check Winner (All 4 tokens at 56)
  const isWinner = player.tokens.every((pos) => pos === 56);
  if (isWinner) {
    game.winner = userId;
    game.lastAction = `🏆 Congratulations! ${player.displayName} won the game!`;
    clearGameTimer(game.gameId);
    io.to(`ludo_${game.gameId}`).emit('ludo:state_updated', game);
    return true;
  }

  // Bonus turn if rolled 6 or captured an opponent token
  const getsBonusTurn = game.diceValue === 6 || hasCaptured;
  if (getsBonusTurn) {
    game.hasRolled = false;
    game.diceValue = null;
    game.movableTokens = [];
    if (!hasCaptured) {
      game.lastAction += ' (Bonus roll for rolling 6)';
    }
  } else {
    game.currentTurn = opponentId;
    game.hasRolled = false;
    game.diceValue = null;
    game.movableTokens = [];
  }

  startTurnTimer(game.gameId, io);
  io.to(`ludo_${game.gameId}`).emit('ludo:state_updated', game);
  return false;
}

// 30-Second Turn Timeout Handler: Automatically plays or switches turn
export function handleTurnTimeout(gameId: string, io: SocketIOServer) {
  const game = activeLudoGames.get(gameId);
  if (!game || game.winner) return;

  const currentUserId = game.currentTurn;
  const player = game.players[currentUserId];
  if (!player) return;

  const opponentId = game.playerOrder.find((id) => id !== currentUserId)!;
  const opponent = game.players[opponentId];

  console.log(`⏰ [Ludo 30s Timeout] Auto-playing turn for ${player.displayName} in match ${gameId}`);

  // 1. If player hasn't rolled dice yet within 30 seconds
  if (!game.hasRolled) {
    const dice = rollUnpredictableDice();
    game.diceValue = dice;
    game.hasRolled = true;

    if (dice === 6) {
      game.consecutiveSixes += 1;
    } else {
      game.consecutiveSixes = 0;
    }

    if (game.consecutiveSixes === 3) {
      game.lastAction = `⏰ 30s Timeout! ${player.displayName} rolled three 6s. Turn passed to ${opponent.displayName}.`;
      game.consecutiveSixes = 0;
      game.hasRolled = false;
      game.diceValue = null;
      game.movableTokens = [];
      game.currentTurn = opponentId;
      startTurnTimer(gameId, io);
      io.to(`ludo_${gameId}`).emit('ludo:state_updated', game);
      return;
    }

    const movable = getMovableTokens(player, dice);
    game.movableTokens = movable;

    if (movable.length > 0) {
      // Prioritize bringing base token out or moving first movable token
      const baseIdx = movable.find((idx) => player.tokens[idx] === -1);
      const chosenIdx = baseIdx !== undefined ? baseIdx : movable[0];

      game.lastAction = `⏰ 30s Timeout! Auto-rolled ${dice} & auto-moved token for ${player.displayName}.`;
      applyTokenMove(game, currentUserId, chosenIdx, io);
    } else {
      // No legal moves possible -> switch turn
      game.currentTurn = opponentId;
      game.hasRolled = false;
      game.diceValue = null;
      game.movableTokens = [];
      game.lastAction = `⏰ 30s Timeout! Auto-rolled ${dice} (no moves). Turn passed to ${opponent.displayName}.`;
      startTurnTimer(gameId, io);
      io.to(`ludo_${gameId}`).emit('ludo:state_updated', game);
    }
    return;
  }

  // 2. If player has rolled dice but didn't pick token within 30 seconds
  if (game.hasRolled) {
    if (game.movableTokens.length > 0) {
      const baseIdx = game.movableTokens.find((idx) => player.tokens[idx] === -1);
      const chosenIdx = baseIdx !== undefined ? baseIdx : game.movableTokens[0];

      game.lastAction = `⏰ 30s Timeout! Auto-moved token for ${player.displayName}.`;
      applyTokenMove(game, currentUserId, chosenIdx, io);
    } else {
      game.currentTurn = opponentId;
      game.hasRolled = false;
      game.diceValue = null;
      game.movableTokens = [];
      game.lastAction = `⏰ 30s Timeout! Turn passed to ${opponent.displayName}.`;
      startTurnTimer(gameId, io);
      io.to(`ludo_${gameId}`).emit('ludo:state_updated', game);
    }
  }
}

export function setupLudoSocketHandlers(io: SocketIOServer, socket: Socket, userId: string) {
  // ── 1. SEND LUDO CHALLENGE / INVITE ────────────────────────────
  socket.on('ludo:invite', async ({ targetUserId, gameId }: { targetUserId: string; gameId: string }) => {
    if (!targetUserId || targetUserId === userId) return;

    try {
      const sender = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      });

      if (!sender) return;

      const finalGameId = gameId || `ludo_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

      io.to(`user_${targetUserId}`).emit('ludo:incoming_invite', {
        gameId: finalGameId,
        fromUser: sender,
      });

      console.log(`[Ludo] Invite sent from ${sender.displayName} (${userId}) to ${targetUserId}`);
    } catch (err) {
      console.error('[Ludo] Invite error:', err);
    }
  });

  // ── 2. DECLINE INVITE ─────────────────────────────────────────
  socket.on('ludo:decline', ({ inviterId, gameId }: { inviterId: string; gameId: string }) => {
    if (!inviterId) return;
    io.to(`user_${inviterId}`).emit('ludo:invite_declined', { gameId, byUserId: userId });
  });

  // ── 3. ACCEPT INVITE & START MATCH ────────────────────────────
  socket.on('ludo:accept', async ({ inviterId, gameId }: { inviterId: string; gameId: string }) => {
    try {
      const [user1, user2] = await Promise.all([
        prisma.user.findUnique({
          where: { id: inviterId },
          select: { id: true, displayName: true, avatarUrl: true },
        }),
        prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, displayName: true, avatarUrl: true },
        }),
      ]);

      if (!user1 || !user2) return;

      const initialGame: LudoGame = {
        gameId,
        players: {
          [user1.id]: {
            userId: user1.id,
            displayName: user1.displayName,
            avatarUrl: user1.avatarUrl || undefined,
            color: 'RED',
            tokens: [-1, -1, -1, -1],
          },
          [user2.id]: {
            userId: user2.id,
            displayName: user2.displayName,
            avatarUrl: user2.avatarUrl || undefined,
            color: 'GREEN',
            tokens: [-1, -1, -1, -1],
          },
        },
        playerOrder: [user1.id, user2.id],
        currentTurn: user1.id, // Inviter starts first
        diceValue: null,
        hasRolled: false,
        consecutiveSixes: 0,
        winner: null,
        lastAction: 'Game started! Red plays first (30s timer active).',
        movableTokens: [],
        createdAt: Date.now(),
        turnDeadline: Date.now() + TURN_TIMEOUT_MS,
      };

      activeLudoGames.set(gameId, initialGame);

      // Join game room for both
      socket.join(`ludo_${gameId}`);

      // Start 30s turn countdown timer for the first player
      startTurnTimer(gameId, io);

      // Notify inviter and join them to room
      io.to(`user_${inviterId}`).emit('ludo:invite_accepted', { gameId, game: initialGame });
      socket.emit('ludo:game_started', { gameId, game: initialGame });

      console.log(`[Ludo] Match started: ${user1.displayName} vs ${user2.displayName} (ID: ${gameId})`);
    } catch (err) {
      console.error('[Ludo] Accept error:', err);
    }
  });

  // ── 4. JOIN EXISTING GAME ROOM ────────────────────────────────
  socket.on('ludo:join_room', ({ gameId }: { gameId: string }) => {
    if (!gameId) return;
    socket.join(`ludo_${gameId}`);
    const game = activeLudoGames.get(gameId);
    if (game) {
      socket.emit('ludo:sync_state', game);
    }
  });

  // ── 5. UNPREDICTABLE CRYPTO DICE ROLL ─────────────────────────
  socket.on('ludo:roll_dice', ({ gameId }: { gameId: string }) => {
    const game = activeLudoGames.get(gameId);
    if (!game || game.winner) return;

    if (game.currentTurn !== userId) {
      socket.emit('ludo:error', { message: 'It is not your turn.' });
      return;
    }

    if (game.hasRolled) {
      socket.emit('ludo:error', { message: 'Dice already rolled. Please move a token.' });
      return;
    }

    const dice = rollUnpredictableDice();
    game.diceValue = dice;
    game.hasRolled = true;

    if (dice === 6) {
      game.consecutiveSixes += 1;
    } else {
      game.consecutiveSixes = 0;
    }

    // 3 consecutive 6s penalty
    if (game.consecutiveSixes === 3) {
      game.lastAction = `${game.players[userId].displayName} rolled three 6s in a row! Turn skipped.`;
      game.consecutiveSixes = 0;
      game.hasRolled = false;
      game.diceValue = null;
      game.movableTokens = [];
      const nextPlayer = game.playerOrder.find((id) => id !== userId)!;
      game.currentTurn = nextPlayer;
      startTurnTimer(gameId, io);
      io.to(`ludo_${gameId}`).emit('ludo:state_updated', game);
      return;
    }

    const player = game.players[userId];
    const movable = getMovableTokens(player, dice);
    game.movableTokens = movable;
    game.lastAction = `${player.displayName} rolled ${dice} !`;

    if (movable.length > 0) {
      // Player has movable tokens: refresh 30s timer for token selection
      startTurnTimer(gameId, io);
    }

    io.to(`ludo_${gameId}`).emit('ludo:dice_rolled', {
      diceValue: dice,
      turn: userId,
      movableTokens: movable,
      lastAction: game.lastAction,
      turnDeadline: game.turnDeadline,
    });

    // If no moves possible, pass turn after delay
    if (movable.length === 0) {
      setTimeout(() => {
        const liveGame = activeLudoGames.get(gameId);
        if (!liveGame || liveGame.winner) return;

        const nextPlayer = liveGame.playerOrder.find((id) => id !== userId)!;
        liveGame.currentTurn = nextPlayer;
        liveGame.hasRolled = false;
        liveGame.diceValue = null;
        liveGame.movableTokens = [];
        liveGame.lastAction = `${player.displayName} has no valid moves. Turn passed.`;

        startTurnTimer(gameId, io);
        io.to(`ludo_${gameId}`).emit('ludo:state_updated', liveGame);
      }, 450);
    }
  });

  // ── 6. MOVE TOKEN (Real-life capture & scoring algorithm) ──────
  socket.on('ludo:move_token', ({ gameId, tokenIndex }: { gameId: string; tokenIndex: number }) => {
    const game = activeLudoGames.get(gameId);
    if (!game || game.winner) return;

    if (game.currentTurn !== userId) return;
    if (!game.hasRolled || !game.diceValue) return;

    if (!game.movableTokens.includes(tokenIndex)) {
      socket.emit('ludo:error', { message: 'This move is not allowed.' });
      return;
    }

    applyTokenMove(game, userId, tokenIndex, io);
  });

  // ── 7. LEAVE GAME ─────────────────────────────────────────────
  socket.on('ludo:leave', ({ gameId }: { gameId: string }) => {
    clearGameTimer(gameId);
    socket.leave(`ludo_${gameId}`);
    const game = activeLudoGames.get(gameId);
    if (game && !game.winner) {
      const remainingPlayer = game.playerOrder.find((id) => id !== userId);
      if (remainingPlayer) {
        game.winner = remainingPlayer;
        game.lastAction = `${game.players[userId]?.displayName || 'Opponent'} has left the game.`;
        io.to(`ludo_${gameId}`).emit('ludo:state_updated', game);
      }
      activeLudoGames.delete(gameId);
    }
  });

  // ── 8. REAL-TIME IN-GAME WEBRTC VOICE CHAT ────────────────────
  socket.on('ludo:voice_offer', ({ gameId, targetUserId, offer }: { gameId: string; targetUserId: string; offer: any }) => {
    if (targetUserId) {
      console.log(`🎙️ [Ludo Voice] Relay offer from ${userId} to user_${targetUserId} for game ${gameId}`);
      io.to(`user_${targetUserId}`).emit('ludo:voice_offer', {
        gameId,
        fromUserId: userId,
        offer,
      });
    }
  });

  socket.on('ludo:voice_answer', ({ gameId, targetUserId, answer }: { gameId: string; targetUserId: string; answer: any }) => {
    if (targetUserId) {
      console.log(`🎙️ [Ludo Voice] Relay answer from ${userId} to user_${targetUserId} for game ${gameId}`);
      io.to(`user_${targetUserId}`).emit('ludo:voice_answer', {
        gameId,
        fromUserId: userId,
        answer,
      });
    }
  });

  socket.on('ludo:voice_ice', ({ gameId, targetUserId, candidate }: { gameId: string; targetUserId: string; candidate: any }) => {
    if (targetUserId) {
      console.log(`❄️ [Ludo Voice] Relay ICE candidate from ${userId} to user_${targetUserId}`);
      io.to(`user_${targetUserId}`).emit('ludo:voice_ice', {
        gameId,
        fromUserId: userId,
        candidate,
      });
    }
  });

  socket.on('ludo:voice_status', ({ gameId, targetUserId, isMuted }: { gameId: string; targetUserId: string; isMuted: boolean }) => {
    if (targetUserId) {
      console.log(`🎤 [Ludo Voice] Relay mute status (${isMuted}) from ${userId} to user_${targetUserId}`);
      io.to(`user_${targetUserId}`).emit('ludo:voice_status', {
        fromUserId: userId,
        isMuted,
      });
    }
  });

  // ── 9. IN-GAME REAL-TIME TEXT CHAT ────────────────────────────
  socket.on('ludo:send_chat', ({ gameId, text }: { gameId: string; text: string }) => {
    if (!gameId || !text || !text.trim()) return;
    const game = activeLudoGames.get(gameId);
    if (!game) return;

    const sender = game.players[userId];
    if (!sender) return;

    const chatMsg: LudoChatMessage = {
      id: `ludo_msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      senderId: userId,
      senderName: sender.displayName,
      senderAvatar: sender.avatarUrl,
      text: text.trim().slice(0, 300),
      createdAt: Date.now(),
    };

    io.to(`ludo_${gameId}`).emit('ludo:new_chat', chatMsg);
    console.log(`💬 [Ludo Chat] [${gameId}] ${sender.displayName}: ${chatMsg.text}`);
  });
}
