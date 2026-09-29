'use client';

import React, { useEffect, useState } from 'react';
import { Swords, Check, X, Trophy } from 'lucide-react';
import { useStore } from '../store/useStore';
import { getSocket } from '../lib/socket';
import { resolveMediaUrl } from '../lib/api';
import { LudoGameModal } from './LudoGameModal';
import { UserAvatar } from './UserAvatar';

export const LudoInviteListener: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const {
    currentUser,
    fetchCurrentUser,
    incomingLudoInvite,
    setIncomingLudoInvite,
    activeLudoGameId,
    setActiveLudoGameId,
  } = useStore();

  useEffect(() => {
    setMounted(true);
    fetchCurrentUser();

    const socket = getSocket();

    // Listen for incoming challenge from any user
    const handleIncomingInvite = ({ gameId, fromUser }: any) => {
      console.log('🎲 [Ludo] Received incoming challenge from:', fromUser);
      setIncomingLudoInvite({ gameId, fromUser });
    };

    // Listen when challenge is accepted by opponent
    const handleInviteAccepted = ({ gameId }: any) => {
      console.log('🎲 [Ludo] Challenge accepted, starting game:', gameId);
      setActiveLudoGameId(gameId);
    };

    // Listen when challenge is declined
    const handleInviteDeclined = () => {
      alert('Your opponent declined the Ludo challenge.');
    };

    socket.on('ludo:incoming_invite', handleIncomingInvite);
    socket.on('ludo:invite_accepted', handleInviteAccepted);
    socket.on('ludo:invite_declined', handleInviteDeclined);

    return () => {
      socket.off('ludo:incoming_invite', handleIncomingInvite);
      socket.off('ludo:invite_accepted', handleInviteAccepted);
      socket.off('ludo:invite_declined', handleInviteDeclined);
    };
  }, []);

  const handleAccept = () => {
    if (!incomingLudoInvite) return;
    const socket = getSocket();
    socket.emit('ludo:accept', {
      gameId: incomingLudoInvite.gameId,
      inviterId: incomingLudoInvite.fromUser.id,
    });
    setActiveLudoGameId(incomingLudoInvite.gameId);
    setIncomingLudoInvite(null);
  };

  const handleDecline = () => {
    if (!incomingLudoInvite) return;
    const socket = getSocket();
    socket.emit('ludo:decline', {
      gameId: incomingLudoInvite.gameId,
      inviterId: incomingLudoInvite.fromUser.id,
    });
    setIncomingLudoInvite(null);
  };

  if (!mounted) return null;

  return (
    <>
      {/* Incoming Challenge Modal Popup */}
      {incomingLudoInvite && (
        <div className="fixed top-20 right-4 z-50 max-w-sm w-full bg-slate-900 border border-amber-500/40 rounded-3xl p-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative shrink-0">
              <UserAvatar
                avatarUrl={incomingLudoInvite.fromUser.avatarUrl}
                name={incomingLudoInvite.fromUser.displayName}
                username={incomingLudoInvite.fromUser.username}
                size="md"
                className="border-2 border-amber-400"
              />
              <span className="absolute -bottom-1 -right-1 text-xs">🎲</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <Swords className="w-3.5 h-3.5 text-amber-400" />
                <p className="text-xs font-bold text-amber-300">Ludo Challenge Received!</p>
              </div>
              <p className="text-xs text-white font-semibold mt-0.5">
                {incomingLudoInvite.fromUser.displayName}
              </p>
              <p className="text-[10px] text-slate-400">Invited you to play a match of Ludo</p>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <button
              onClick={handleAccept}
              className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Accept</span>
            </button>
            <button
              onClick={handleDecline}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {/* Active Game Modal */}
      {activeLudoGameId && <LudoGameModal />}
    </>
  );
};
