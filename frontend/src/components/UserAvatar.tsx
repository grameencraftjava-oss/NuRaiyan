'use client';

import React, { useState } from 'react';
import { User } from 'lucide-react';
import { resolveMediaUrl } from '../lib/api';

interface UserAvatarProps {
  avatarUrl?: string | null;
  name?: string | null;
  username?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

const sizeClasses: Record<string, { container: string; text: string; icon: string }> = {
  xs: { container: 'w-6 h-6 rounded-full', text: 'text-[10px]', icon: 'w-3 h-3' },
  sm: { container: 'w-8 h-8 rounded-full', text: 'text-xs', icon: 'w-4 h-4' },
  md: { container: 'w-10 h-10 rounded-full', text: 'text-sm', icon: 'w-5 h-5' },
  lg: { container: 'w-12 h-12 rounded-full', text: 'text-base', icon: 'w-6 h-6' },
  xl: { container: 'w-16 h-16 rounded-full', text: 'text-xl', icon: 'w-8 h-8' },
  '2xl': { container: 'w-24 h-24 rounded-full', text: 'text-3xl', icon: 'w-12 h-12' },
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  avatarUrl,
  name,
  username,
  size = 'md',
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  // Check if avatar is a valid custom user upload (not empty, not dicebear, not unsplash dummy)
  const isValidPhoto =
    avatarUrl &&
    avatarUrl.trim().length > 0 &&
    !avatarUrl.includes('api.dicebear.com') &&
    !avatarUrl.includes('images.unsplash.com');

  const resolvedSrc = isValidPhoto ? resolveMediaUrl(avatarUrl) : null;

  const currentSize = sizeClasses[size] || sizeClasses.md;

  // Initial letter calculation
  const displayName = (name || username || '').trim();
  const initial = displayName ? displayName.charAt(0).toUpperCase() : null;

  if (resolvedSrc && !imgError) {
    return (
      <img
        src={resolvedSrc}
        alt={displayName || 'User profile'}
        className={`${currentSize.container} object-cover border border-white/10 shrink-0 ${className}`}
        onError={() => setImgError(true)}
      />
    );
  }

  // Fallback: Clean, elegant initial or user icon without any dummy stock photos
  return (
    <div
      className={`${currentSize.container} bg-gradient-to-br from-indigo-900/60 to-slate-850 border border-slate-700/60 flex items-center justify-center font-bold text-indigo-300 uppercase select-none shrink-0 shadow-inner ${className}`}
      title={displayName || 'User profile'}
    >
      {initial ? (
        <span className={currentSize.text}>{initial}</span>
      ) : (
        <User className={`${currentSize.icon} text-slate-400`} />
      )}
    </div>
  );
};
