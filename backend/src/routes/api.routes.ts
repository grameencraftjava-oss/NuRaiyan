import { Router } from 'express';
import { authMiddleware, optionalAuth } from '../middleware/auth.middleware';
import { authLimiter, apiLimiter, postLimiter, loginBruteForceLimiter } from '../middleware/rateLimiter';

// Controllers
import {
  register,
  login,
  refreshTokenHandler,
  logout,
  getMe,
  getActiveSessions,
  updateProfile,
  changePassword,
} from '../controllers/auth.controller';
import { getFeed, createPost, getPost, getPostReactions, updatePost, deletePost, toggleLike, addComment, sharePost, savePost, getSavedPosts } from '../controllers/post.controller';
import { getActiveStories, createStory, viewStory, getStoryViewers, deleteStory } from '../controllers/story.controller';
import { getConversations, getOrCreateConversation, getMessages, sendMessage, createGroup, deleteMessage, deleteConversation, getUnreadCount, markConversationAsRead } from '../controllers/chat.controller';
import { initiateCall, updateCallStatus, getCallHistory } from '../controllers/call.controller';
import { startLive, getActiveLiveStreams, getLiveStreamById, endLive, getLiveReplays, deleteLiveStream, addLiveComment } from '../controllers/live.controller';
import { globalSearch, getSuggestedUsers, getUserProfile, toggleFollow } from '../controllers/search.controller';
import { uploadMiddleware, uploadSingleMedia, uploadMultipleMedia, streamMediaFile } from '../controllers/upload.controller';
import { searchMusic, getTrendingMusic } from '../controllers/music.controller';
import {
  getFriendshipStatus,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  unfriend,
  getFriendRequests,
  getFriendSuggestions,
  getFriendsList,
} from '../controllers/friend.controller';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
} from '../controllers/notification.controller';

const router = Router();

// ── HEALTH CHECK ───────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Nuraiyan Social Network API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ── AUTH ───────────────────────────────────────────────────
router.post('/auth/register', authLimiter, register);
router.post('/auth/login', [authLimiter, loginBruteForceLimiter], login);
router.post('/auth/refresh', refreshTokenHandler);
router.post('/auth/logout', authMiddleware, logout);
router.get('/auth/me', authMiddleware, getMe);
router.patch('/users/profile', authMiddleware, updateProfile);
router.post('/auth/change-password', authMiddleware, authLimiter, changePassword);
router.get('/auth/sessions', authMiddleware, getActiveSessions);

// ── POSTS ──────────────────────────────────────────────────
router.get('/posts/feed', authMiddleware, apiLimiter, getFeed);
router.get('/posts/saved', authMiddleware, getSavedPosts);
router.post('/posts', authMiddleware, postLimiter, createPost);
router.get('/posts/:postId/reactions', authMiddleware, apiLimiter, getPostReactions);
router.get('/posts/:postId', apiLimiter, getPost);
router.patch('/posts/:postId', authMiddleware, postLimiter, updatePost);
router.delete('/posts/:postId', authMiddleware, deletePost);
router.post('/posts/:postId/like', authMiddleware, toggleLike);
router.post('/posts/:postId/comment', authMiddleware, addComment);
router.post('/posts/:postId/share', authMiddleware, sharePost);
router.post('/posts/:postId/save', authMiddleware, savePost);


// ── STORIES ────────────────────────────────────────────────
router.get('/stories', authMiddleware, apiLimiter, getActiveStories);
router.post('/stories', authMiddleware, postLimiter, createStory);
router.post('/stories/:storyId/view', authMiddleware, viewStory);
router.get('/stories/:storyId/viewers', authMiddleware, getStoryViewers);
router.delete('/stories/:storyId', authMiddleware, deleteStory);

// ── MESSAGES / CHAT ────────────────────────────────────────
router.get('/conversations/unread-count', authMiddleware, getUnreadCount);
router.get('/conversations', authMiddleware, getConversations);
router.post('/conversations', authMiddleware, getOrCreateConversation);
router.get('/conversations/:conversationId/messages', authMiddleware, getMessages);
router.post('/conversations/:conversationId/read', authMiddleware, markConversationAsRead);
router.post('/messages', authMiddleware, sendMessage);
router.delete('/messages/:messageId', authMiddleware, deleteMessage);
router.delete('/conversations/:conversationId', authMiddleware, deleteConversation);
router.post('/groups', authMiddleware, createGroup);

// ── CALLS ──────────────────────────────────────────────────
router.post('/calls', authMiddleware, initiateCall);
router.patch('/calls/:callId/status', authMiddleware, updateCallStatus);
router.get('/calls/history', authMiddleware, getCallHistory);

// ── LIVE STREAMING & REPLAYS (PERMANENT RETENTION) ────────
router.post('/live/start', authMiddleware, startLive);
router.get('/live/streams', apiLimiter, getActiveLiveStreams);
router.get('/live/replays', apiLimiter, getLiveReplays);
router.get('/live/:streamId', apiLimiter, getLiveStreamById);
router.post('/live/:streamId/comment', authMiddleware, addLiveComment);
router.post('/live/:streamId/end', authMiddleware, endLive);
router.delete('/live/:streamId', authMiddleware, deleteLiveStream);

// ── FRIENDS & FRIEND REQUESTS (FACEBOOK STYLE) ─────────────
router.get('/friends/status/:targetUserId', authMiddleware, getFriendshipStatus);
router.post('/friends/request/:targetUserId', authMiddleware, sendFriendRequest);
router.post('/friends/accept/:senderId', authMiddleware, acceptFriendRequest);
router.post('/friends/reject/:senderId', authMiddleware, rejectFriendRequest);
router.delete('/friends/unfriend/:targetUserId', authMiddleware, unfriend);
router.get('/friends/requests', authMiddleware, getFriendRequests);
router.get('/friends/suggestions', authMiddleware, getFriendSuggestions);
router.get('/friends/list/:userId?', authMiddleware, getFriendsList);
router.get('/friends', authMiddleware, getFriendsList);

// ── NOTIFICATIONS (FACEBOOK STYLE) ────────────────────────
router.get('/notifications', authMiddleware, getNotifications);
router.patch('/notifications/:id/read', authMiddleware, markNotificationAsRead);
router.post('/notifications/read-all', authMiddleware, markAllNotificationsAsRead);
router.delete('/notifications/:id', authMiddleware, deleteNotification);

// ── USERS & SEARCH ─────────────────────────────────────────
router.get('/search', optionalAuth, apiLimiter, globalSearch);
router.get('/users/suggestions', authMiddleware, getSuggestedUsers);
router.get('/users/:username', optionalAuth, apiLimiter, getUserProfile);
router.post('/users/follow', authMiddleware, toggleFollow);

// ── MEDIA UPLOADS & STREAMING (PHOTO / VIDEO / AUDIO UP TO 4GB) ───
router.post(
  '/upload',
  authMiddleware,
  (req, res, next) => {
    req.setTimeout(10 * 60 * 1000); // 10 mins
    uploadMiddleware.single('file')(req, res, (err: any) => {
      if (err) {
        console.error('[Upload Middleware Error]:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            message: 'File size exceeds maximum allowed limit (4GB).',
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'File upload failed.',
        });
      }
      next();
    });
  },
  uploadSingleMedia
);

router.post(
  '/upload/multiple',
  authMiddleware,
  (req, res, next) => {
    req.setTimeout(10 * 60 * 1000);
    uploadMiddleware.array('files', 10)(req, res, (err: any) => {
      if (err) {
        console.error('[Multiple Upload Error]:', err);
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            message: 'One or more files exceed the maximum allowed limit (4GB).',
          });
        }
        return res.status(400).json({
          success: false,
          message: err.message || 'Multiple file upload failed.',
        });
      }
      next();
    });
  },
  uploadMultipleMedia
);
router.get('/media/stream/:filename', streamMediaFile);

// ── MUSIC & SONGS (MILLIONS OF SONGS ACROSS ALL GENRES) ─────
router.get('/music/search', apiLimiter, searchMusic);
router.get('/music/trending', apiLimiter, getTrendingMusic);

export { router as apiRoutes };
export default router;
