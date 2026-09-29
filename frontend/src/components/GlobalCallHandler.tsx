'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useStore } from '../store/useStore';
import { getSocket } from '../lib/socket';
import { Phone, PhoneOff, Video, Mic, Volume2 } from 'lucide-react';
import { UserAvatar } from './UserAvatar';
import { VideoCallModal } from './VideoCallModal';
import { playCallRingtone } from '../lib/soundUtils';

export const GlobalCallHandler: React.FC = () => {
  const { currentUser, fetchCurrentUser, activeCall, setActiveCall } = useStore();
  const [incomingCallData, setIncomingCallData] = useState<{
    caller: { id: string; username: string; displayName: string; avatarUrl?: string };
    callType: 'VIDEO' | 'AUDIO';
    callId: string;
    offer: any;
  } | null>(null);

  const stopRingtoneRef = useRef<() => void>(() => {});
  const pendingIceCandidatesRef = useRef<any[]>([]);
  const acceptedCallIdsRef = useRef<Set<string>>(new Set());
  const activeCallRef = useRef<any>(null);
  const incomingCallIdRef = useRef<string | null>(null);
  activeCallRef.current = activeCall;

  useEffect(() => {
    fetchCurrentUser();

    const socket = getSocket();

    const handleIncomingCall = ({
      caller,
      callType,
      callId,
      offer,
    }: {
      caller: any;
      callType: 'VIDEO' | 'AUDIO';
      callId: string;
      offer: any;
    }) => {
      // 🔒 1. If this callId was already accepted or user is already connected to it, drop duplicate event!
      if (acceptedCallIdsRef.current.has(callId)) {
        console.log(`⚠️ [CallHandler] Call ${callId} was already accepted - ignoring duplicate.`);
        return;
      }

      if (activeCallRef.current?.callId === callId && activeCallRef.current?.status !== 'ENDED') {
        console.log(`⚠️ [CallHandler] Already connected to active call ${callId} - ignoring duplicate.`);
        return;
      }

      if (incomingCallIdRef.current === callId) {
        console.log(`⚠️ [CallHandler] Already ringing for call ${callId} - ignoring duplicate.`);
        return;
      }
      incomingCallIdRef.current = callId;

      console.log('🔔 [CallHandler] Received incoming call:', { caller, callType, callId });
      pendingIceCandidatesRef.current = [];
      setIncomingCallData({ caller, callType, callId, offer });
      stopRingtoneRef.current();
      stopRingtoneRef.current = playCallRingtone();
    };

    const handleIncomingIce = ({ candidate }: { candidate: any }) => {
      if (candidate) {
        pendingIceCandidatesRef.current.push(candidate);
      }
    };

    const handleCallTerminated = (data?: any) => {
      incomingCallIdRef.current = null;
      stopRingtoneRef.current();
      pendingIceCandidatesRef.current = [];
      if (data?.callId) {
        acceptedCallIdsRef.current.delete(data.callId);
      }
      setIncomingCallData(null);
      setActiveCall(null);
    };

    socket.on('call:incoming', handleIncomingCall);
    socket.on('call:ice-candidate', handleIncomingIce);
    socket.on('call:declined', handleCallTerminated);
    socket.on('call:ended', handleCallTerminated);

    return () => {
      socket.off('call:incoming', handleIncomingCall);
      socket.off('call:ice-candidate', handleIncomingIce);
      socket.off('call:declined', handleCallTerminated);
      socket.off('call:ended', handleCallTerminated);
      stopRingtoneRef.current();
    };
  }, []);

  const handleAcceptCall = () => {
    if (!incomingCallData) return;
    const currentCall = incomingCallData;
    incomingCallIdRef.current = null;
    
    // 🔒 Mark as accepted IMMEDIATELY to block any duplicate incoming prompts
    acceptedCallIdsRef.current.add(currentCall.callId);
    stopRingtoneRef.current();

    setActiveCall({
      isIncoming: true,
      otherUser: {
        id: currentCall.caller.id,
        username: currentCall.caller.username,
        displayName: currentCall.caller.displayName,
        avatarUrl: currentCall.caller.avatarUrl || null,
      },
      type: currentCall.callType,
      callId: currentCall.callId,
      status: 'CONNECTING',
      offer: currentCall.offer,
      pendingIceCandidates: [...pendingIceCandidatesRef.current],
    });

    pendingIceCandidatesRef.current = [];
    setIncomingCallData(null);
  };

  const handleDeclineCall = () => {
    if (!incomingCallData) return;
    incomingCallIdRef.current = null;
    stopRingtoneRef.current();
    pendingIceCandidatesRef.current = [];

    const socket = getSocket();
    socket.emit('call:decline', {
      callerId: incomingCallData.caller.id,
      callId: incomingCallData.callId,
    });

    setIncomingCallData(null);
  };

  return (
    <>
      {/* 1. Global Incoming Call Banner / Modal */}
      {incomingCallData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-[#111726] border border-rose-500/40 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl shadow-rose-500/20 space-y-5 animate-in zoom-in-95">
            <div className="relative mx-auto w-20 h-20">
              <UserAvatar
                avatarUrl={incomingCallData.caller.avatarUrl}
                name={incomingCallData.caller.displayName}
                username={incomingCallData.caller.username}
                size="xl"
                className="w-20 h-20 ring-4 ring-rose-500/40"
              />

              <span className="absolute -bottom-1 -right-1 p-2 bg-rose-500 text-white rounded-full shadow-lg animate-bounce">
                {incomingCallData.callType === 'VIDEO' ? (
                  <Video className="w-4 h-4" />
                ) : (
                  <Phone className="w-4 h-4" />
                )}
              </span>
            </div>

            <div className="space-y-1">
              <h3 className="text-base sm:text-lg font-extrabold text-white">
                {incomingCallData.caller.displayName}
              </h3>
              <p className="text-xs text-rose-300 font-medium animate-pulse">
                Incoming {incomingCallData.callType === 'VIDEO' ? 'Video' : 'Audio'} Call...
              </p>
            </div>

            {/* Accept / Decline Buttons */}
            <div className="flex items-center justify-center gap-6 pt-2">
              <button
                type="button"
                onClick={handleDeclineCall}
                className="w-14 h-14 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-lg shadow-rose-600/30 transition-transform hover:scale-110 cursor-pointer"
                title="Decline"
              >
                <PhoneOff className="w-6 h-6" />
              </button>

              <button
                type="button"
                onClick={handleAcceptCall}
                className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 transition-transform hover:scale-110 cursor-pointer animate-pulse"
                title="Accept"
              >
                <Phone className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Global Active Video / Audio Call Modal */}
      {activeCall && <VideoCallModal onClose={() => setActiveCall(null)} />}
    </>
  );
};
