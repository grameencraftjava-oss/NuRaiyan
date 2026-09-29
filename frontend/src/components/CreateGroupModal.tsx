'use client';

import React, { useState, useEffect } from 'react';
import { X, Users, Check, Search } from 'lucide-react';
import { api } from '../lib/api';
import { UserAvatar } from './UserAvatar';

interface Friend {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGroupCreated: (newGroup: any) => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  onGroupCreated,
}) => {
  const [groupName, setGroupName] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadFriends();
    }
  }, [isOpen]);

  const loadFriends = async () => {
    setLoadingFriends(true);
    try {
      const res = await api.get('/users/suggestions');
      if (res.success && Array.isArray(res.data)) {
        setFriends(res.data);
      }
    } catch (err) {
      console.error('Failed to load friends for group:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  if (!isOpen) return null;

  const toggleSelect = (userId: string) => {
    if (selectedUserIds.includes(userId)) {
      setSelectedUserIds(selectedUserIds.filter((id) => id !== userId));
    } else {
      setSelectedUserIds([...selectedUserIds, userId]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim() || selectedUserIds.length === 0) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const res = await api.post('/groups', {
        name: groupName.trim(),
        memberIds: selectedUserIds,
      });

      if (res.success && res.data) {
        onGroupCreated(res.data);
        setGroupName('');
        setSelectedUserIds([]);
        onClose();
      } else {
        setErrorMessage(res.message || 'Could not create group.');
      }
    } catch {
      setErrorMessage('Server error: Failed to create group.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = friends.filter(
    (f) =>
      f.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-base">Create Group Chat</h3>
              <p className="text-xs text-slate-500">Group messaging and audio/video calling</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mb-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium text-center">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Group Name:
            </label>
            <input
              type="text"
              required
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Project Team, Friends Circle..."
              className="w-full text-sm p-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                Select Members ({selectedUserIds.length} selected):
              </label>
            </div>

            {/* Member Search */}
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search friends..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Friend List */}
            <div className="max-h-48 overflow-y-auto space-y-1.5 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
              {loadingFriends && (
                <p className="text-xs text-slate-400 py-4 text-center">Loading members...</p>
              )}
              {!loadingFriends && filtered.length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No members found.
                </p>
              )}
              {filtered.map((friend) => {
                const isSelected = selectedUserIds.includes(friend.id);
                return (
                  <div
                    key={friend.id}
                    onClick={() => toggleSelect(friend.id)}
                    className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <UserAvatar
                        avatarUrl={friend.avatarUrl}
                        name={friend.displayName}
                        username={friend.username}
                        size="sm"
                      />
                      <div>
                        <p className="text-xs font-semibold text-slate-800">{friend.displayName}</p>
                        <p className="text-[10px] text-slate-500">@{friend.username}</p>
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!groupName.trim() || selectedUserIds.length === 0 || isSubmitting}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-md shadow-blue-500/20"
            >
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
