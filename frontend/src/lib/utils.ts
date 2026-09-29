import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | Date): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return 'Just now';
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export const formatTimeAgo = formatDate;

export function formatLastActive(lastSeenAt?: string | null | Date): string {
  if (!lastSeenAt) return 'Offline';
  const time = new Date(lastSeenAt).getTime();
  if (isNaN(time) || time <= 0) return 'Offline';
  const diffInSeconds = Math.floor((Date.now() - time) / 1000);
  if (diffInSeconds < 60) return 'Active just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `Active ${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `Active ${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return 'Active yesterday';
  if (diffInDays < 7) return `Active ${diffInDays}d ago`;
  return `Active on ${new Date(time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  return (
    /\.(mp4|webm|mov|mkv|avi|3gp|m4v|ogv|wmv|flv)(\?|$)/i.test(url) ||
    url.toLowerCase().includes('/video') ||
    url.toLowerCase().includes('video_') ||
    url.toLowerCase().includes('.mp4') ||
    url.toLowerCase().includes('.webm')
  );
}
