import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const resolveDataDir = () => {
  // Always resolve relative to the backend package directory
  const backendData = path.resolve(__dirname, '../../data');
  if (fs.existsSync(path.join(backendData, 'db.json'))) return backendData;
  const cwdBackend = path.join(process.cwd(), 'backend', 'data');
  if (fs.existsSync(path.join(cwdBackend, 'db.json'))) return cwdBackend;
  return backendData;
};

const DATA_DIR = resolveDataDir();
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface LocalDatabase {
  users: any[];
  posts: any[];
  comments: any[];
  likes: any[];
  follows: any[];
  friendships: any[];
  stories: any[];
  conversations: any[];
  conversationParticipants: any[];
  messages: any[];
  liveStreams: any[];
  mediaFiles: any[];
  refreshTokens: any[];
  deviceSessions: any[];
  savedPosts: any[];
  notifications: any[];
  callSessions: any[];
  callParticipants: any[];
  messageReads: any[];
  liveComments: any[];
}

const DEFAULT_DB: LocalDatabase = {
  users: [],
  posts: [],
  comments: [],
  likes: [],
  follows: [],
  friendships: [],
  stories: [],
  conversations: [],
  conversationParticipants: [],
  messages: [],
  liveStreams: [],
  liveComments: [],
  mediaFiles: [],
  refreshTokens: [],
  deviceSessions: [],
  savedPosts: [],
  notifications: [],
  callSessions: [],
  callParticipants: [],
  messageReads: [],
};

class LocalDatabaseManager {
  private db: LocalDatabase;

  constructor() {
    this.db = this.load();
  }

  private load(): LocalDatabase {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const loaded = { ...DEFAULT_DB, ...JSON.parse(raw) };
        if (!Array.isArray(loaded.comments)) loaded.comments = [];
        if (!Array.isArray(loaded.friendships)) loaded.friendships = [];
        loaded.friendships = loaded.friendships.filter(
          (f: any) => f.id !== 'fr_raiyan_nusrat_accepted'
        );
        // Ensure any comment stored in posts.comments is also in comments collection
        if (Array.isArray(loaded.posts)) {
          loaded.posts.forEach((p: any) => {
            if (Array.isArray(p.comments)) {
              p.comments.forEach((c: any) => {
                if (!loaded.comments.some((ec: any) => ec.id === c.id)) {
                  loaded.comments.push({
                    id: c.id,
                    postId: p.id,
                    userId: c.userId || c.user?.id,
                    content: c.content,
                    parentId: c.parentId || null,
                    createdAt: c.createdAt || new Date().toISOString(),
                  });
                }
              });
            }
          });
        }
        // Auto-sanitize stale live streams (streams cannot remain LIVE if ended or abandoned)
        if (Array.isArray(loaded.liveStreams)) {
          const now = Date.now();
          loaded.liveStreams.forEach((s: any) => {
            const ageMs = now - new Date(s.startedAt || 0).getTime();
            if (s.status === 'LIVE' && ageMs > 60 * 60 * 1000) {
              s.status = 'ENDED';
              s.endedAt = s.endedAt || new Date().toISOString();
            }
            if (s.id === 'live_38bbfd04-213b-408c-bf89-01912c117b2d') {
              s.status = 'ENDED';
              s.endedAt = s.endedAt || '2026-09-28T15:10:00.000Z';
              s.recordingUrl = '/uploads/1790515600364-b81099b2-6d12-4625-86d4-6340bd4a3108.webm';
            }
          });
        }
        if (!Array.isArray(loaded.liveComments)) {
          loaded.liveComments = [];
        }
        return loaded;
      }
    } catch (err) {
      console.error('Error loading db.json, using defaults:', err);
    }
    this.saveImmediate(DEFAULT_DB);
    return DEFAULT_DB;
  }

  public getPostCommentsWithReplies(postId: string) {
    const postComments = (this.db.comments || []).filter((c) => c.postId === postId);
    const topLevel = postComments.filter((c) => !c.parentId);
    return topLevel.map((c) => {
      const user = this.db.users.find((u) => u.id === c.userId) || {
        id: c.userId,
        username: 'user',
        displayName: 'User',
        avatarUrl: null,
      };
      const replies = postComments
        .filter((r) => r.parentId === c.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((r) => ({
          ...r,
          user: this.db.users.find((u) => u.id === r.userId) || {
            id: r.userId,
            username: 'user',
            displayName: 'User',
            avatarUrl: null,
          },
        }));
      return {
        ...c,
        user,
        replies,
      };
    });
  }

  private saveImmediate(data: LocalDatabase) {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Error saving db.json:', err);
    }
  }

  private persist() {
    // Synchronous immediate write for 100% crash/reload resistance
    this.saveImmediate(this.db);
  }

  public getRaw(): LocalDatabase {
    return this.db;
  }

  // ── USER MODEL ──────────────────────────────────────────
  public user = {
    findFirst: async (args?: any) => {
      const { where } = args || {};
      return (
        this.db.users.find((u) => {
          if (!where) return true;
          if (where.id && u.id !== where.id) return false;
          if (where.username && u.username.toLowerCase() !== where.username.toLowerCase()) return false;
          if (where.email && u.email.toLowerCase() !== where.email.toLowerCase()) return false;
          if (where.OR) {
            const matches = where.OR.some((cond: any) => {
              if (cond.email && u.email?.toLowerCase() === cond.email.toLowerCase()) return true;
              if (cond.username && u.username?.toLowerCase() === cond.username.toLowerCase()) return true;
              return false;
            });
            if (!matches) return false;
          }
          return true;
        }) || null
      );
    },

    findUnique: async (args: any) => {
      return this.user.findFirst(args);
    },

    findMany: async (args?: any) => {
      let list = [...this.db.users];
      const { where, take, skip } = args || {};
      if (where) {
        if (where.id) {
          if (where.id.not) {
            list = list.filter((u) => u.id !== where.id.not);
          }
          if (where.id.notIn && Array.isArray(where.id.notIn)) {
            list = list.filter((u) => !where.id.notIn.includes(u.id));
          }
          if (where.id.in && Array.isArray(where.id.in)) {
            list = list.filter((u) => where.id.in.includes(u.id));
          }
        }
        if (where.isActive !== undefined) {
          list = list.filter((u) => u.isActive === where.isActive || u.isActive === undefined);
        }
        if (where.isSuspended !== undefined) {
          list = list.filter((u) => u.isSuspended === where.isSuspended || u.isSuspended === undefined);
        }
        if (where.OR) {
          list = list.filter((u) =>
            where.OR.some((c: any) => {
              if (c.username?.contains) {
                return (u.username || '').toLowerCase().includes(c.username.contains.toLowerCase());
              }
              if (c.displayName?.contains) {
                return (u.displayName || '').toLowerCase().includes(c.displayName.contains.toLowerCase());
              }
              return false;
            })
          );
        }
      }
      if (skip) list = list.slice(skip);
      if (take) list = list.slice(0, take);
      return list;
    },

    create: async (args: { data: any; select?: any }) => {
      const newUser = {
        id: args.data.id || 'usr_' + crypto.randomUUID(),
        isActive: true,
        isSuspended: false,
        role: 'USER',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...args.data,
      };
      this.db.users.push(newUser);
      this.persist();
      return newUser;
    },

    update: async (args: { where: any; data: any; select?: any }) => {
      const idx = this.db.users.findIndex((u) => {
        if (args.where.id) return u.id === args.where.id;
        if (args.where.username) return u.username === args.where.username;
        return false;
      });
      if (idx !== -1) {
        this.db.users[idx] = {
          ...this.db.users[idx],
          ...args.data,
          updatedAt: new Date().toISOString(),
        };
        this.persist();
        return this.db.users[idx];
      }
      return null;
    },
  };

  // ── POST MODEL ──────────────────────────────────────────
  public post = {
    findMany: async (args?: any) => {
      let list = [...this.db.posts];
      const { where, orderBy, take, skip } = args || {};

      if (where) {
        if (where.authorId) {
          list = list.filter((p) => p.authorId === where.authorId);
        }
        if (where.isArchived !== undefined) {
          list = list.filter((p) => Boolean(p.isArchived) === Boolean(where.isArchived));
        } else {
          list = list.filter((p) => !p.isArchived);
        }
      } else {
        list = list.filter((p) => !p.isArchived);
      }

      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      if (skip) list = list.slice(skip);
      if (take) list = list.slice(0, take);

      return list.map((p) => {
        const author = this.db.users.find((u) => u.id === p.authorId) || {
          id: p.authorId,
          username: 'user',
          displayName: 'User',
          avatarUrl: null,
        };
        const postLikes = (this.db.likes || []).filter((l) => l.postId === p.id);
        const comments = this.getPostCommentsWithReplies(p.id);
        const totalCommentsCount = (this.db.comments || []).filter((c) => c.postId === p.id).length;
        return {
          ...p,
          likesCount: postLikes.length,
          author,
          likes: postLikes,
          comments,
          _count: {
            likes: postLikes.length,
            comments: totalCommentsCount || p.commentsCount || comments.length,
            shares: p.sharesCount || 0,
          },
        };
      });
    },

    findUnique: async (args: any) => {
      const p = this.db.posts.find((x) => x.id === args.where?.id);
      if (!p) return null;
      const author = this.db.users.find((u) => u.id === p.authorId);
      const postLikes = (this.db.likes || []).filter((l) => l.postId === p.id);
      const comments = this.getPostCommentsWithReplies(p.id);
      const totalCommentsCount = (this.db.comments || []).filter((c) => c.postId === p.id).length;
      return {
        ...p,
        author,
        comments,
        likes: postLikes,
        _count: {
          likes: postLikes.length,
          comments: totalCommentsCount || p.commentsCount || comments.length,
          shares: p.sharesCount || 0,
        },
      };
    },

    findFirst: async (args: any) => {
      return this.post.findUnique(args);
    },

    create: async (args: { data: any; include?: any }) => {
      const newPost = {
        id: args.data.id || 'post_' + crypto.randomUUID(),
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        viewsCount: 0,
        isArchived: false,
        mediaUrls: [],
        comments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...args.data,
      };
      this.db.posts.unshift(newPost);
      this.persist();

      const author = this.db.users.find((u) => u.id === newPost.authorId) || {
        id: newPost.authorId,
        username: 'user',
        displayName: 'User',
        avatarUrl: null,
        isVerified: false,
      };
      return {
        ...newPost,
        author,
        _count: {
          likes: newPost.likesCount || 0,
          comments: newPost.commentsCount || 0,
          shares: newPost.sharesCount || 0,
        },
      };
    },

    update: async (args: { where: any; data: any; include?: any }) => {
      const idx = this.db.posts.findIndex((p) => p.id === args.where?.id);
      if (idx !== -1) {
        const current = this.db.posts[idx];
        const updateData: any = { ...args.data };

        // Handle Prisma increment/decrement modifiers safely
        if (updateData.likesCount && typeof updateData.likesCount === 'object') {
          const currentCount = typeof current.likesCount === 'number' ? current.likesCount : this.db.likes.filter((l) => l.postId === current.id).length;
          if ('increment' in updateData.likesCount) {
            updateData.likesCount = currentCount + Number(updateData.likesCount.increment);
          } else if ('decrement' in updateData.likesCount) {
            updateData.likesCount = Math.max(0, currentCount - Number(updateData.likesCount.decrement));
          }
        }
        if (updateData.commentsCount && typeof updateData.commentsCount === 'object') {
          const currentCount = typeof current.commentsCount === 'number' ? current.commentsCount : (current.comments?.length || 0);
          if ('increment' in updateData.commentsCount) {
            updateData.commentsCount = currentCount + Number(updateData.commentsCount.increment);
          } else if ('decrement' in updateData.commentsCount) {
            updateData.commentsCount = Math.max(0, currentCount - Number(updateData.commentsCount.decrement));
          }
        }
        if (updateData.sharesCount && typeof updateData.sharesCount === 'object') {
          const currentCount = typeof current.sharesCount === 'number' ? current.sharesCount : 0;
          if ('increment' in updateData.sharesCount) {
            updateData.sharesCount = currentCount + Number(updateData.sharesCount.increment);
          } else if ('decrement' in updateData.sharesCount) {
            updateData.sharesCount = Math.max(0, currentCount - Number(updateData.sharesCount.decrement));
          }
        }
        if (updateData.viewsCount && typeof updateData.viewsCount === 'object') {
          const currentCount = typeof current.viewsCount === 'number' ? current.viewsCount : 0;
          if ('increment' in updateData.viewsCount) {
            updateData.viewsCount = currentCount + Number(updateData.viewsCount.increment);
          } else if ('decrement' in updateData.viewsCount) {
            updateData.viewsCount = Math.max(0, currentCount - Number(updateData.viewsCount.decrement));
          }
        }

        this.db.posts[idx] = {
          ...current,
          ...updateData,
          updatedAt: new Date().toISOString(),
        };
        this.persist();
        const author = this.db.users.find((u) => u.id === this.db.posts[idx].authorId);
        return {
          ...this.db.posts[idx],
          author,
          likes: this.db.likes.filter((l) => l.postId === this.db.posts[idx].id),
          comments: this.db.posts[idx].comments || [],
          _count: {
            likes: this.db.likes.filter((l) => l.postId === this.db.posts[idx].id).length,
            comments: (this.db.posts[idx].comments || []).length,
            shares: this.db.posts[idx].sharesCount || 0,
          },
        };
      }
      return null;
    },

    delete: async (args: { where: any }) => {
      const idx = this.db.posts.findIndex((p) => p.id === args.where?.id);
      if (idx !== -1) {
        const deleted = this.db.posts.splice(idx, 1)[0];
        this.persist();
        return deleted;
      }
      return null;
    },

    updateMany: async (args: any) => {
      return { count: 1 };
    },
  };

  // ── MEDIA FILE MODEL ────────────────────────────────────
  public mediaFile = {
    create: async (args: { data: any }) => {
      const file = {
        id: 'mf_' + crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...args.data,
      };
      this.db.mediaFiles.push(file);
      this.persist();
      return file;
    },
    findMany: async (args?: any) => {
      if (args?.where?.uploaderId) {
        return this.db.mediaFiles.filter((m) => m.uploaderId === args.where.uploaderId);
      }
      return this.db.mediaFiles;
    },
    findUnique: async (args: any) => {
      return this.db.mediaFiles.find((m) => m.id === args?.where?.id) || null;
    },
    delete: async (args: any) => {
      const idx = this.db.mediaFiles.findIndex((m) => m.id === args?.where?.id);
      if (idx !== -1) {
        const removed = this.db.mediaFiles.splice(idx, 1)[0];
        this.persist();
        return removed;
      }
      return null;
    },
  };

  // ── LIVE STREAM MODEL ───────────────────────────────────
  public liveStream = {
    create: async (args: { data: any; include?: any }) => {
      const stream = {
        id: 'live_' + crypto.randomUUID(),
        viewerCount: 0,
        peakViewers: 0,
        startedAt: new Date().toISOString(),
        recordingUrl: null,
        ...args.data,
      };
      this.db.liveStreams.unshift(stream);
      this.persist();
      const host = this.db.users.find((u) => u.id === stream.hostId);
      return { ...stream, host };
    },
    findMany: async (args?: any) => {
      let list = [...this.db.liveStreams];
      if (args?.where?.status) {
        list = list.filter((s) => s.status === args.where.status);
      }
      if (args?.where?.hostId) {
        list = list.filter((s) => s.hostId === args.where.hostId);
      }
      list.sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());
      if (args?.take) {
        list = list.slice(0, args.take);
      }
      return list.map((s) => {
        const host = this.db.users.find((u) => u.id === s.hostId);
        const res: any = { ...s, host };
        if (args?.include?.comments) {
          res.comments = (this.db.liveComments || [])
            .filter((c) => c.streamId === s.id)
            .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
            .map((c) => {
              const u = this.db.users.find((user) => user.id === c.userId);
              return {
                ...c,
                user: u
                  ? { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl }
                  : { id: c.userId, username: 'user', displayName: 'User', avatarUrl: null },
              };
            });
        }
        return res;
      });
    },
    findFirst: async (args?: any) => {
      const s = this.db.liveStreams.find((s) => {
        if (args?.where?.id && s.id !== args.where.id) return false;
        if (args?.where?.hostId && s.hostId !== args.where.hostId) return false;
        if (args?.where?.status && s.status !== args.where.status) return false;
        return true;
      });
      if (!s) return null;
      const host = this.db.users.find((u) => u.id === s.hostId);
      const res: any = { ...s, host };
      if (args?.include?.comments) {
        res.comments = (this.db.liveComments || [])
          .filter((c) => c.streamId === s.id)
          .sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime())
          .map((c) => {
            const u = this.db.users.find((user) => user.id === c.userId);
            return {
              ...c,
              user: u
                ? { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl }
                : { id: c.userId, username: 'user', displayName: 'User', avatarUrl: null },
            };
          });
      }
      return res;
    },
    findUnique: async (args?: any) => {
      return this.liveStream.findFirst(args);
    },
    updateMany: async (args: { where: any; data: any }) => {
      let count = 0;
      this.db.liveStreams.forEach((s) => {
        if (args.where?.id && s.id === args.where.id) {
          Object.assign(s, args.data);
          count++;
        }
      });
      this.persist();
      return { count };
    },
    update: async (args: { where: any; data: any }) => {
      const s = this.db.liveStreams.find((s) => s.id === args.where?.id);
      if (s) {
        Object.assign(s, args.data);
        this.persist();
        return {
          ...s,
          host: this.db.users.find((u) => u.id === s.hostId),
        };
      }
      return null;
    },
    delete: async (args: { where: any }) => {
      const idx = this.db.liveStreams.findIndex((s) => s.id === args.where?.id);
      if (idx !== -1) {
        const del = this.db.liveStreams.splice(idx, 1)[0];
        if (this.db.liveComments) {
          this.db.liveComments = this.db.liveComments.filter((c) => c.streamId !== del.id);
        }
        this.persist();
        return del;
      }
      return null;
    },
  };

  // ── LIVE COMMENT MODEL ───────────────────────────────────
  public liveComment = {
    create: async (args: { data: any; include?: any }) => {
      if (!this.db.liveComments) this.db.liveComments = [];
      const comment = {
        id: args.data.id || ('lc_' + crypto.randomUUID()),
        createdAt: new Date().toISOString(),
        ...args.data,
      };
      this.db.liveComments.push(comment);
      this.persist();
      const u = (this.db.users || []).find((user) => user.id === comment.userId);
      return {
        ...comment,
        user: u
          ? { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl }
          : { id: comment.userId, username: 'user', displayName: 'User', avatarUrl: null },
      };
    },
    findMany: async (args?: any) => {
      if (!this.db.liveComments) this.db.liveComments = [];
      let list = [...this.db.liveComments];
      if (args?.where?.streamId) {
        list = list.filter((c) => c.streamId === args.where.streamId);
      }
      list.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
      if (args?.include?.user) {
        return list.map((c) => {
          const u = (this.db.users || []).find((user) => user.id === c.userId);
          return {
            ...c,
            user: u
              ? { id: u.id, username: u.username, displayName: u.displayName, avatarUrl: u.avatarUrl }
              : { id: c.userId, username: 'user', displayName: 'User', avatarUrl: null },
          };
        });
      }
      return list;
    },
    deleteMany: async (args?: any) => {
      if (!this.db.liveComments) this.db.liveComments = [];
      if (args?.where?.streamId) {
        const initLen = this.db.liveComments.length;
        this.db.liveComments = this.db.liveComments.filter((c) => c.streamId !== args.where.streamId);
        this.persist();
        return { count: initLen - this.db.liveComments.length };
      }
      return { count: 0 };
    },
  };

  // ── REFRESH TOKEN & SESSIONS ────────────────────────────
  public refreshToken = {
    create: async (args: { data: any }) => {
      const t = { id: 'rt_' + crypto.randomUUID(), createdAt: new Date().toISOString(), ...args.data };
      this.db.refreshTokens.push(t);
      this.persist();
      return t;
    },
    findUnique: async (args: { where: { token: string } }) => {
      return this.db.refreshTokens.find((t) => t.token === args.where.token) || null;
    },
    delete: async (args: { where: any }) => {
      const idx = this.db.refreshTokens.findIndex((t) => t.token === args.where.token || t.id === args.where.id);
      if (idx !== -1) {
        const del = this.db.refreshTokens.splice(idx, 1)[0];
        this.persist();
        return del;
      }
      return null;
    },
  };

  public deviceSession = {
    create: async (args: { data: any }) => {
      const s = { id: 'ds_' + crypto.randomUUID(), createdAt: new Date().toISOString(), ...args.data };
      this.db.deviceSessions.push(s);
      this.persist();
      return s;
    },
    findMany: async (args?: any) => {
      if (args?.where?.userId) {
        return this.db.deviceSessions.filter((s) => s.userId === args.where.userId);
      }
      return this.db.deviceSessions;
    },
  };

  // ── LIKE MODEL ──────────────────────────────────────────
  public like = {
    create: async (args: { data: any }) => {
      const uId = args.data.userId;
      const pId = args.data.postId;
      const existingIdx = this.db.likes.findIndex((l) => l.userId === uId && l.postId === pId);
      if (existingIdx !== -1) {
        this.db.likes[existingIdx] = { ...this.db.likes[existingIdx], ...args.data };
        const post = this.db.posts.find((p) => p.id === pId);
        if (post) {
          post.likesCount = this.db.likes.filter((l) => l.postId === pId).length;
        }
        this.persist();
        return this.db.likes[existingIdx];
      }
      const like = { id: 'lk_' + crypto.randomUUID(), ...args.data };
      this.db.likes.push(like);
      const post = this.db.posts.find((p) => p.id === args.data.postId);
      if (post) {
        post.likesCount = this.db.likes.filter((l) => l.postId === post.id).length;
      }
      this.persist();
      return like;
    },
    findUnique: async (args: any) => {
      const uId = args.where?.userId_postId?.userId || args.where?.userId;
      const pId = args.where?.userId_postId?.postId || args.where?.postId;
      return (
        this.db.likes.find((l) => {
          if (args.where?.id && l.id === args.where.id) return true;
          if (uId && pId && l.userId === uId && l.postId === pId) return true;
          return false;
        }) || null
      );
    },
    update: async (args: { where: any; data: any }) => {
      const uId = args.where?.userId_postId?.userId || args.where?.userId;
      const pId = args.where?.userId_postId?.postId || args.where?.postId;
      const idx = this.db.likes.findIndex((l) => {
        if (args.where?.id && l.id === args.where.id) return true;
        if (uId && pId && l.userId === uId && l.postId === pId) return true;
        return false;
      });
      if (idx !== -1) {
        this.db.likes[idx] = { ...this.db.likes[idx], ...args.data };
        this.persist();
        return this.db.likes[idx];
      }
      return null;
    },
    delete: async (args: { where: any }) => {
      const uId = args.where?.userId_postId?.userId || args.where?.userId;
      const pId = args.where?.userId_postId?.postId || args.where?.postId;
      const idx = this.db.likes.findIndex((l) => {
        if (args.where?.id) return l.id === args.where.id;
        if (uId && pId) return l.userId === uId && l.postId === pId;
        if (args.where?.postId_userId) {
          return l.postId === args.where.postId_userId.postId && l.userId === args.where.postId_userId.userId;
        }
        return false;
      });
      if (idx !== -1) {
        const removed = this.db.likes.splice(idx, 1)[0];
        const post = this.db.posts.find((p) => p.id === removed.postId);
        if (post) {
          post.likesCount = this.db.likes.filter((l) => l.postId === post.id).length;
        }
        this.persist();
        return removed;
      }
      return null;
    },
    findFirst: async (args: any) => {
      return (
        this.db.likes.find((l) => {
          if (args.where?.postId && l.postId !== args.where.postId) return false;
          if (args.where?.userId && l.userId !== args.where.userId) return false;
          return true;
        }) || null
      );
    },
    findMany: async (args?: any) => {
      let results = [...this.db.likes];
      if (args?.where?.postId) {
        results = results.filter((l) => l.postId === args.where.postId);
      }
      if (args?.where?.userId) {
        results = results.filter((l) => l.userId === args.where.userId);
      }
      if (args?.include?.user) {
        return results.map((l) => {
          const user = this.db.users.find((u) => u.id === l.userId);
          return {
            ...l,
            user: user
              ? {
                  id: user.id,
                  username: user.username,
                  displayName: user.displayName,
                  avatarUrl: user.avatarUrl,
                  isVerified: user.isVerified || false,
                }
              : {
                  id: l.userId,
                  username: 'user',
                  displayName: 'User',
                  avatarUrl: null,
                  isVerified: false,
                },
          };
        });
      }
      return results;
    },
  };


  // ── COMMENT MODEL ───────────────────────────────────────
  public comment = {
    create: async (args: { data: any; include?: any }) => {
      const comm = {
        id: 'cm_' + crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        parentId: args.data.parentId || null,
        ...args.data,
      };
      this.db.comments.push(comm);
      const post = this.db.posts.find((p) => p.id === args.data.postId);
      const user = this.db.users.find((u) => u.id === args.data.userId);
      if (post) {
        post.commentsCount = (this.db.comments || []).filter((c) => c.postId === post.id).length;
        post.comments = this.getPostCommentsWithReplies(post.id);
      }
      this.persist();
      return { ...comm, user, replies: [] };
    },
    findUnique: async (args: any) => {
      const c = this.db.comments.find((item) => item.id === args?.where?.id);
      if (!c) return null;
      const user = this.db.users.find((u) => u.id === c.userId);
      const replies = this.db.comments
        .filter((r) => r.parentId === c.id)
        .map((r) => ({
          ...r,
          user: this.db.users.find((u) => u.id === r.userId),
        }));
      return { ...c, user, replies };
    },
    findFirst: async (args: any) => {
      return this.comment.findUnique(args);
    },
    findMany: async (args?: any) => {
      let list = [...this.db.comments];
      if (args?.where?.postId) {
        list = list.filter((c) => c.postId === args.where.postId);
      }
      if (args?.where?.parentId !== undefined) {
        list = list.filter((c) => c.parentId === args.where.parentId);
      }
      return list.map((c) => {
        const user = this.db.users.find((u) => u.id === c.userId);
        const replies = this.db.comments
          .filter((r) => r.parentId === c.id)
          .map((r) => ({
            ...r,
            user: this.db.users.find((u) => u.id === r.userId),
          }));
        return {
          ...c,
          user,
          replies,
        };
      });
    },
  };

  // ── STORY MODEL ─────────────────────────────────────────
  public story = {
    create: async (args: { data: any }) => {
      const st = {
        id: 'st_' + crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        viewsCount: 0,
        views: [],
        ...args.data,
      };
      this.db.stories.unshift(st);
      this.persist();
      const user = this.db.users.find((u) => u.id === st.userId) || {
        id: st.userId,
        username: 'user',
        displayName: 'User',
        avatarUrl: null,
      };
      return { ...st, user, views: [] };
    },
    findMany: async (args?: any) => {
      let list = this.db.stories;
      if (args?.where?.userId?.in) {
        const ids = args.where.userId.in;
        list = list.filter((s) => ids.includes(s.userId));
      }
      if (args?.where?.expiresAt?.gt) {
        const now = new Date(args.where.expiresAt.gt).getTime();
        list = list.filter((s) => new Date(s.expiresAt).getTime() > now);
      }
      return list.map((st) => ({
        ...st,
        views: st.views || [],
        user: this.db.users.find((u) => u.id === st.userId) || {
          id: st.userId,
          username: 'user',
          displayName: 'User',
          avatarUrl: null,
        },
      }));
    },
    findUnique: async (args: any) => {
      return this.db.stories.find((s) => s.id === args?.where?.id) || null;
    },
    update: async (args: { where: any; data: any }) => {
      const idx = this.db.stories.findIndex((s) => s.id === args.where?.id);
      if (idx !== -1) {
        // Handle increment
        const data = { ...args.data };
        if (data.viewsCount?.increment) {
          data.viewsCount = (this.db.stories[idx].viewsCount || 0) + data.viewsCount.increment;
        }
        this.db.stories[idx] = { ...this.db.stories[idx], ...data };
        this.persist();
        return this.db.stories[idx];
      }
      return null;
    },
    delete: async (args: any) => {
      const idx = this.db.stories.findIndex((s) => s.id === args?.where?.id);
      if (idx !== -1) {
        const removed = this.db.stories.splice(idx, 1)[0];
        this.persist();
        return removed;
      }
      return null;
    },
  };


  // ── FOLLOW MODEL ────────────────────────────────────────
  public follow = {
    findMany: async (args?: any) => {
      if (args?.where?.followerId) {
        return this.db.follows.filter((f) => f.followerId === args.where.followerId);
      }
      if (args?.where?.followingId) {
        return this.db.follows.filter((f) => f.followingId === args.where.followingId);
      }
      return this.db.follows;
    },
    create: async (args: { data: any }) => {
      const fol = { id: 'fol_' + crypto.randomUUID(), createdAt: new Date().toISOString(), ...args.data };
      this.db.follows.push(fol);
      this.persist();
      return fol;
    },
    delete: async (args: { where: any }) => {
      const idx = this.db.follows.findIndex(
        (f) =>
          (f.followerId === args.where?.followerId_followingId?.followerId &&
            f.followingId === args.where?.followerId_followingId?.followingId) ||
          f.id === args.where?.id
      );
      if (idx !== -1) {
        const removed = this.db.follows.splice(idx, 1)[0];
        this.persist();
        return removed;
      }
      return null;
    },
    findUnique: async (args: any) => {
      return (
        this.db.follows.find(
          (f) =>
            f.followerId === args.where?.followerId_followingId?.followerId &&
            f.followingId === args.where?.followerId_followingId?.followingId
        ) || null
      );
    },
  };

  // ── FRIENDSHIP / FRIEND REQUEST MODEL ────────────────────
  public friendship = {
    findMany: async (args?: any) => {
      let list = [...(this.db.friendships || [])];
      if (args?.where) {
        const w = args.where;
        if (w.status) {
          list = list.filter((f) => f.status === w.status);
        }
        if (w.senderId) {
          list = list.filter((f) => f.senderId === w.senderId);
        }
        if (w.receiverId) {
          list = list.filter((f) => f.receiverId === w.receiverId);
        }
        if (w.OR && Array.isArray(w.OR)) {
          list = list.filter((f) => {
            return w.OR.some((cond: any) => {
              if (cond.senderId && f.senderId !== cond.senderId) return false;
              if (cond.receiverId && f.receiverId !== cond.receiverId) return false;
              if (cond.status && f.status !== cond.status) return false;
              return true;
            });
          });
        }
      }
      if (args?.include) {
        list = list.map((f) => {
          const sender = this.db.users.find((u) => u.id === f.senderId);
          const receiver = this.db.users.find((u) => u.id === f.receiverId);
          return {
            ...f,
            sender: sender
              ? {
                  id: sender.id,
                  username: sender.username,
                  displayName: sender.displayName,
                  avatarUrl: sender.avatarUrl,
                  bio: sender.bio,
                  isVerified: sender.isVerified,
                  lastSeenAt: sender.lastSeenAt || sender.createdAt,
                }
              : null,
            receiver: receiver
              ? {
                  id: receiver.id,
                  username: receiver.username,
                  displayName: receiver.displayName,
                  avatarUrl: receiver.avatarUrl,
                  bio: receiver.bio,
                  isVerified: receiver.isVerified,
                  lastSeenAt: receiver.lastSeenAt || receiver.createdAt,
                }
              : null,
          };
        });
      }
      return list;
    },
    findFirst: async (args: any) => {
      const list = await this.friendship.findMany(args);
      return list[0] || null;
    },
    findUnique: async (args: any) => {
      const list = await this.friendship.findMany(args);
      return list[0] || null;
    },
    create: async (args: { data: any }) => {
      if (!this.db.friendships) this.db.friendships = [];
      const item = {
        id: 'fr_' + crypto.randomUUID(),
        status: args.data.status || 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        ...args.data,
      };
      this.db.friendships.push(item);
      this.persist();
      return item;
    },
    update: async (args: { where: any; data: any }) => {
      if (!this.db.friendships) this.db.friendships = [];
      const idx = this.db.friendships.findIndex((f) => {
        if (args.where?.id) return f.id === args.where.id;
        if (args.where?.senderId_receiverId) {
          return (
            f.senderId === args.where.senderId_receiverId.senderId &&
            f.receiverId === args.where.senderId_receiverId.receiverId
          );
        }
        return false;
      });
      if (idx !== -1) {
        this.db.friendships[idx] = {
          ...this.db.friendships[idx],
          ...args.data,
          updatedAt: new Date().toISOString(),
        };
        this.persist();
        return this.db.friendships[idx];
      }
      return null;
    },
    delete: async (args: { where: any }) => {
      if (!this.db.friendships) this.db.friendships = [];
      const idx = this.db.friendships.findIndex((f) => {
        if (args.where?.id) return f.id === args.where.id;
        if (args.where?.senderId_receiverId) {
          return (
            f.senderId === args.where.senderId_receiverId.senderId &&
            f.receiverId === args.where.senderId_receiverId.receiverId
          );
        }
        return false;
      });
      if (idx !== -1) {
        const removed = this.db.friendships.splice(idx, 1)[0];
        this.persist();
        return removed;
      }
      return null;
    },
    deleteMany: async (args: { where: any }) => {
      if (!this.db.friendships) this.db.friendships = [];
      const initialCount = this.db.friendships.length;
      if (!args?.where || Object.keys(args.where).length === 0) {
        this.db.friendships = [];
      } else {
        this.db.friendships = this.db.friendships.filter((f) => {
          if (args.where.id) {
            if (typeof args.where.id === 'string' && f.id === args.where.id) return false;
            if (args.where.id.in && Array.isArray(args.where.id.in) && args.where.id.in.includes(f.id)) return false;
          }
          if (args.where.status && f.status === args.where.status && !args.where.OR && !args.where.senderId && !args.where.receiverId) return false;
          if (args.where.senderId && f.senderId === args.where.senderId && !args.where.OR && !args.where.receiverId) return false;
          if (args.where.receiverId && f.receiverId === args.where.receiverId && !args.where.OR && !args.where.senderId) return false;
          if (args.where.OR && Array.isArray(args.where.OR)) {
            const match = args.where.OR.some((cond: any) => {
              if (cond.senderId && f.senderId !== cond.senderId) return false;
              if (cond.receiverId && f.receiverId !== cond.receiverId) return false;
              if (cond.status && f.status !== cond.status) return false;
              return true;
            });
            if (match) return false;
          }
          return true;
        });
      }
      this.persist();
      return { count: initialCount - this.db.friendships.length };
    },
    count: async (args?: any) => {
      const list = await this.friendship.findMany(args);
      return list.length;
    },
  };

  // ── CHAT & MESSAGING ────────────────────────────────────
  public conversationParticipant = {
    findUnique: async (args: any) => {
      if (!this.db.conversationParticipants) this.db.conversationParticipants = [];
      const cId = args.where?.conversationId_userId?.conversationId || args.where?.conversationId;
      const uId = args.where?.conversationId_userId?.userId || args.where?.userId;
      return (
        this.db.conversationParticipants.find((cp) => {
          if (args.where?.id && cp.id === args.where.id) return true;
          if (cId && uId && cp.conversationId === cId && cp.userId === uId) return true;
          return false;
        }) || null
      );
    },
    findFirst: async (args: any) => {
      if (!this.db.conversationParticipants) this.db.conversationParticipants = [];
      const list = await this.conversationParticipant.findMany(args);
      return list[0] || null;
    },
    findMany: async (args?: any) => {
      if (!this.db.conversationParticipants) this.db.conversationParticipants = [];
      let list = [...this.db.conversationParticipants];
      const w = args?.where;
      if (w) {
        if (w.conversationId) {
          list = list.filter((cp) => cp.conversationId === w.conversationId);
        }
        if (w.userId) {
          if (typeof w.userId === 'object' && w.userId.not) {
            list = list.filter((cp) => cp.userId !== w.userId.not);
          } else {
            list = list.filter((cp) => cp.userId === w.userId);
          }
        }
      }
      if (args?.include?.user) {
        return list.map((cp) => {
          const user = this.db.users.find((u) => u.id === cp.userId) || {
            id: cp.userId,
            username: 'user',
            displayName: 'User',
            avatarUrl: null,
          };
          return {
            ...cp,
            user: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
            },
          };
        });
      }
      return list;
    },
    create: async (args: { data: any }) => {
      if (!this.db.conversationParticipants) this.db.conversationParticipants = [];
      const cp = {
        id: 'cp_' + crypto.randomUUID(),
        joinedAt: new Date().toISOString(),
        ...args.data,
      };
      this.db.conversationParticipants.push(cp);
      this.persist();
      return cp;
    },
    createMany: async (args: { data: any[] }) => {
      if (!this.db.conversationParticipants) this.db.conversationParticipants = [];
      const created = (args.data || []).map((item) => ({
        id: 'cp_' + crypto.randomUUID(),
        joinedAt: new Date().toISOString(),
        ...item,
      }));
      this.db.conversationParticipants.push(...created);
      this.persist();
      return { count: created.length };
    },
    deleteMany: async (args: any) => {
      if (!this.db.conversationParticipants) this.db.conversationParticipants = [];
      const initial = this.db.conversationParticipants.length;
      const cId = args.where?.conversationId;
      const uId = args.where?.userId;
      this.db.conversationParticipants = this.db.conversationParticipants.filter((cp) => {
        if (cId && cp.conversationId === cId) {
          if (uId && cp.userId !== uId) return true;
          return false;
        }
        return true;
      });
      this.persist();
      return { count: initial - this.db.conversationParticipants.length };
    },
    update: async (args: { where: any; data: any }) => {
      if (!this.db.conversationParticipants) this.db.conversationParticipants = [];
      const cp = this.db.conversationParticipants.find((p) => {
        if (args.where?.id) return p.id === args.where.id;
        if (args.where?.conversationId_userId) {
          return (
            p.conversationId === args.where.conversationId_userId.conversationId &&
            p.userId === args.where.conversationId_userId.userId
          );
        }
        return false;
      });
      if (cp) {
        Object.assign(cp, args.data);
        this.persist();
        return cp;
      }
      return null;
    },
  };

  public conversation = {
    findMany: async (args?: any) => {
      if (!this.db.conversations) this.db.conversations = [];
      if (!this.db.conversationParticipants) this.db.conversationParticipants = [];
      let list = [...this.db.conversations];

      // Filter by participants
      if (args?.where?.participants?.some?.userId) {
        const uId = args.where.participants.some.userId;
        const myConvIds = new Set(
          this.db.conversationParticipants
            .filter((cp) => cp.userId === uId)
            .map((cp) => cp.conversationId)
        );
        list = list.filter((c) => myConvIds.has(c.id));
      }

      // Order by lastMessageAt
      list.sort((a, b) => {
        const ta = new Date(a.lastMessageAt || a.createdAt || 0).getTime();
        const tb = new Date(b.lastMessageAt || b.createdAt || 0).getTime();
        return tb - ta;
      });

      // Handle includes
      return list.map((c) => {
        const result: any = { ...c };
        if (args?.include?.participants) {
          const cps = this.db.conversationParticipants.filter((cp) => cp.conversationId === c.id);
          result.participants = cps.map((cp) => {
            const user = this.db.users.find((u) => u.id === cp.userId) || {
              id: cp.userId,
              username: 'user',
              displayName: 'User',
              avatarUrl: null,
            };
            return {
              ...cp,
              user: {
                id: user.id,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
              },
            };
          });
        }
        if (args?.include?.messages) {
          const msgs = (this.db.messages || [])
            .filter((m) => m.conversationId === c.id && !m.isDeleted)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          const take = args.include.messages.take || 1;
          result.messages = msgs.slice(0, take).map((m) => {
            const allReads = (this.db.messageReads || []).filter((mr) => mr.messageId === m.id);
            const userFilter = args.include.messages?.select?.readBy?.where?.userId;
            const filteredReads = userFilter ? allReads.filter((mr) => mr.userId === userFilter) : allReads;
            return {
              id: m.id,
              content: m.content,
              messageType: m.messageType || 'TEXT',
              senderId: m.senderId,
              createdAt: m.createdAt,
              readBy: filteredReads,
            };
          });
        }
        return result;
      });
    },

    findFirst: async (args?: any) => {
      if (!this.db.conversations) this.db.conversations = [];
      if (!this.db.conversationParticipants) this.db.conversationParticipants = [];

      let list = [...this.db.conversations];
      if (args?.where) {
        if (args.where.isGroup !== undefined) {
          list = list.filter((c) => c.isGroup === args.where.isGroup);
        }
        if (args.where.AND && Array.isArray(args.where.AND)) {
          for (const cond of args.where.AND) {
            if (cond.participants?.some?.userId) {
              const uId = cond.participants.some.userId;
              const matchingConvIds = new Set(
                this.db.conversationParticipants
                  .filter((cp) => cp.userId === uId)
                  .map((cp) => cp.conversationId)
              );
              list = list.filter((c) => matchingConvIds.has(c.id));
            }
          }
        }
      }
      return list[0] || null;
    },

    findUnique: async (args: any) => {
      if (!this.db.conversations) this.db.conversations = [];
      const conv = this.db.conversations.find((c) => c.id === args?.where?.id) || null;
      if (!conv) return null;
      const result: any = { ...conv };
      if (args?.include?.participants) {
        const cps = (this.db.conversationParticipants || []).filter((cp) => cp.conversationId === conv.id);
        result.participants = cps.map((cp) => {
          const user = this.db.users.find((u) => u.id === cp.userId) || {
            id: cp.userId,
            username: 'user',
            displayName: 'User',
            avatarUrl: null,
          };
          return {
            ...cp,
            user: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
            },
          };
        });
      }
      return result;
    },

    create: async (args: { data: any; include?: any }) => {
      if (!this.db.conversations) this.db.conversations = [];
      if (!this.db.conversationParticipants) this.db.conversationParticipants = [];

      const convId = 'conv_' + crypto.randomUUID();
      const now = new Date().toISOString();
      const { participants, ...convData } = args.data;

      const conv = {
        id: convId,
        createdAt: now,
        lastMessageAt: now,
        isGroup: false,
        name: null,
        avatarUrl: null,
        ...convData,
      };
      this.db.conversations.unshift(conv);

      // Create participants
      if (participants?.create && Array.isArray(participants.create)) {
        for (const p of participants.create) {
          this.db.conversationParticipants.push({
            id: 'cp_' + crypto.randomUUID(),
            conversationId: convId,
            userId: p.userId,
            isAdmin: p.isAdmin || false,
            joinedAt: now,
          });
        }
      }

      this.persist();

      // Return with include if requested
      const result: any = { ...conv };
      if (args?.include?.participants) {
        const cps = this.db.conversationParticipants.filter((cp) => cp.conversationId === conv.id);
        result.participants = cps.map((cp) => {
          const user = this.db.users.find((u) => u.id === cp.userId) || {
            id: cp.userId,
            username: 'user',
            displayName: 'User',
            avatarUrl: null,
          };
          return {
            ...cp,
            user: {
              id: user.id,
              username: user.username,
              displayName: user.displayName,
              avatarUrl: user.avatarUrl,
              lastSeenAt: user.lastSeenAt || user.createdAt,
            },
          };
        });
      }
      return result;
    },

    update: async (args: { where: any; data: any }) => {
      if (!this.db.conversations) this.db.conversations = [];
      const idx = this.db.conversations.findIndex((c) => c.id === args.where?.id);
      if (idx !== -1) {
        this.db.conversations[idx] = { ...this.db.conversations[idx], ...args.data };
        this.persist();
        return this.db.conversations[idx];
      }
      return null;
    },

    delete: async (args: any) => {
      if (!this.db.conversations) this.db.conversations = [];
      const idx = this.db.conversations.findIndex((c) => c.id === args?.where?.id);
      if (idx !== -1) {
        const removed = this.db.conversations.splice(idx, 1)[0];
        if (this.db.conversationParticipants) {
          this.db.conversationParticipants = this.db.conversationParticipants.filter(
            (cp) => cp.conversationId !== removed.id
          );
        }
        this.persist();
        return removed;
      }
      return null;
    },
  };

  public message = {
    findMany: async (args?: any) => {
      if (!this.db.messages) this.db.messages = [];
      let list = [...this.db.messages];
      if (args?.where) {
        if (args.where.conversationId) {
          list = list.filter((m) => m.conversationId === args.where.conversationId);
        }
        if (args.where.isDeleted !== undefined) {
          list = list.filter((m) => m.isDeleted === args.where.isDeleted);
        }
        if (args.where.senderId) {
          if (typeof args.where.senderId === 'object' && args.where.senderId.not) {
            list = list.filter((m) => m.senderId !== args.where.senderId.not);
          } else if (typeof args.where.senderId === 'string') {
            list = list.filter((m) => m.senderId === args.where.senderId);
          }
        }
        if (args.where.readBy?.none?.userId) {
          const targetUser = args.where.readBy.none.userId;
          const readMsgIds = new Set(
            (this.db.messageReads || [])
              .filter((mr) => mr.userId === targetUser)
              .map((mr) => mr.messageId)
          );
          list = list.filter((m) => !readMsgIds.has(m.id));
        }
        if (args.where.OR && Array.isArray(args.where.OR)) {
          const now = Date.now();
          list = list.filter((m) => {
            if (!m.expiresAt) return true;
            return new Date(m.expiresAt).getTime() > now;
          });
        }
      }
      if (args?.orderBy?.createdAt === 'desc') {
        list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      } else {
        list.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      }
      if (args?.skip !== undefined) {
        list = list.slice(args.skip);
      }
      if (args?.take !== undefined) {
        list = list.slice(0, args.take);
      }
      return list.map((m) => {
        const user = (this.db.users || []).find((u) => u.id === m.senderId);
        const readBy = (this.db.messageReads || []).filter((mr) => mr.messageId === m.id);
        return {
          ...m,
          readBy,
          sender: user
            ? { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl }
            : { id: m.senderId, displayName: 'User' },
        };
      });
    },

    findUnique: async (args: any) => {
      if (!this.db.messages) this.db.messages = [];
      return this.db.messages.find((m) => m.id === args.where?.id) || null;
    },

    create: async (args: { data: any; include?: any }) => {
      if (!this.db.messages) this.db.messages = [];
      const now = new Date().toISOString();
      const msg = {
        id: 'msg_' + crypto.randomUUID(),
        createdAt: now,
        isDeleted: false,
        readBy: [],
        ...args.data,
      };
      this.db.messages.push(msg);

      // Update conversation lastMessageAt
      if (msg.conversationId && this.db.conversations) {
        const conv = this.db.conversations.find((c) => c.id === msg.conversationId);
        if (conv) conv.lastMessageAt = now;
      }

      this.persist();

      const user = (this.db.users || []).find((u) => u.id === msg.senderId);
      return {
        ...msg,
        readBy: [],
        sender: user
          ? { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl }
          : { id: msg.senderId, displayName: 'User' },
      };
    },

    update: async (args: { where: any; data: any }) => {
      if (!this.db.messages) this.db.messages = [];
      const idx = this.db.messages.findIndex((m) => m.id === args.where?.id);
      if (idx !== -1) {
        this.db.messages[idx] = { ...this.db.messages[idx], ...args.data };
        this.persist();
        return this.db.messages[idx];
      }
      return null;
    },
  };

  public messageRead = {
    createMany: async (args: { data: any[]; skipDuplicates?: boolean }) => {
      if (!this.db.messageReads) this.db.messageReads = [];
      const created: any[] = [];
      for (const item of args.data || []) {
        const exists = this.db.messageReads.some(
          (mr) => mr.messageId === item.messageId && mr.userId === item.userId
        );
        if (!exists) {
          const record = {
            id: 'mr_' + crypto.randomUUID(),
            readAt: new Date().toISOString(),
            ...item,
          };
          this.db.messageReads.push(record);
          created.push(record);
        }
      }
      this.persist();
      return { count: created.length };
    },
    findMany: async (args?: any) => {
      if (!this.db.messageReads) this.db.messageReads = [];
      let list = [...this.db.messageReads];
      if (args?.where?.messageId) {
        list = list.filter((mr) => mr.messageId === args.where.messageId);
      }
      if (args?.where?.userId) {
        list = list.filter((mr) => mr.userId === args.where.userId);
      }
      return list;
    },
  };

  public callSession = {
    create: async (args: { data: any; include?: any }) => {
      if (!this.db.callSessions) this.db.callSessions = [];
      if (!this.db.callParticipants) this.db.callParticipants = [];
      const callId = 'call_' + crypto.randomUUID();
      const now = new Date().toISOString();
      const { participants, ...callData } = args.data;

      const session = {
        id: callId,
        isGroup: false,
        type: 'VIDEO',
        status: 'CALLING',
        startedAt: now,
        answeredAt: null,
        endedAt: null,
        durationSeconds: 0,
        ...callData,
      };
      this.db.callSessions.push(session);

      if (participants?.create && Array.isArray(participants.create)) {
        for (const p of participants.create) {
          this.db.callParticipants.push({
            id: 'cp_' + crypto.randomUUID(),
            callId,
            userId: p.userId,
            isInitiator: p.isInitiator || false,
            joinedAt: now,
            isMuted: false,
            isVideoOff: false,
          });
        }
      }
      this.persist();

      const result: any = { ...session };
      if (args?.include?.participants) {
        result.participants = (this.db.callParticipants || [])
          .filter((p) => p.callId === callId)
          .map((p) => ({
            ...p,
            user: (this.db.users || []).find((u) => u.id === p.userId) || { id: p.userId, displayName: 'User' },
          }));
      }
      return result;
    },
    findUnique: async (args: any) => {
      if (!this.db.callSessions) this.db.callSessions = [];
      const session = this.db.callSessions.find((s) => s.id === args?.where?.id || s.channelName === args?.where?.channelName) || null;
      if (!session) return null;
      const result: any = { ...session };
      if (args?.include?.participants) {
        result.participants = (this.db.callParticipants || [])
          .filter((p) => p.callId === session.id)
          .map((p) => ({
            ...p,
            user: (this.db.users || []).find((u) => u.id === p.userId) || { id: p.userId, displayName: 'User' },
          }));
      }
      return result;
    },
    update: async (args: { where: any; data: any; include?: any }) => {
      if (!this.db.callSessions) this.db.callSessions = [];
      const idx = this.db.callSessions.findIndex((s) => s.id === args?.where?.id);
      if (idx !== -1) {
        this.db.callSessions[idx] = { ...this.db.callSessions[idx], ...args.data };
        this.persist();
        const result: any = { ...this.db.callSessions[idx] };
        if (args?.include?.participants) {
          result.participants = (this.db.callParticipants || [])
            .filter((p) => p.callId === result.id)
            .map((p) => ({
              ...p,
              user: (this.db.users || []).find((u) => u.id === p.userId) || { id: p.userId, displayName: 'User' },
            }));
        }
        return result;
      }
      return null;
    },
    findMany: async (args?: any) => {
      if (!this.db.callSessions) this.db.callSessions = [];
      let list = [...this.db.callSessions];
      if (args?.where) {
        if (args.where.participants?.some?.userId) {
          const targetUid = args.where.participants.some.userId;
          const matchingCallIds = new Set(
            (this.db.callParticipants || [])
              .filter((p) => p.userId === targetUid)
              .map((p) => p.callId)
          );
          list = list.filter((s) => matchingCallIds.has(s.id));
        }
        if (args.where.status?.in && Array.isArray(args.where.status.in)) {
          list = list.filter((s) => args.where.status.in.includes(s.status));
        }
      }
      list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      if (args?.take) list = list.slice(0, args.take);
      if (args?.include?.participants) {
        list = list.map((s) => ({
          ...s,
          participants: (this.db.callParticipants || [])
            .filter((p) => p.callId === s.id)
            .map((p) => ({
              ...p,
              user: (this.db.users || []).find((u) => u.id === p.userId) || { id: p.userId, displayName: 'User' },
            })),
        }));
      }
      return list;
    },
  };

  public callParticipant = {
    findFirst: async (args: any) => {
      if (!this.db.callParticipants) this.db.callParticipants = [];
      const cp = this.db.callParticipants.find((p) => {
        if (args?.where?.callId && p.callId !== args.where.callId) return false;
        if (args?.where?.userId && p.userId !== args.where.userId) return false;
        return true;
      });
      return cp || null;
    },
    findMany: async (args?: any) => {
      if (!this.db.callParticipants) this.db.callParticipants = [];
      return this.db.callParticipants;
    },
    create: async (args: { data: any }) => {
      if (!this.db.callParticipants) this.db.callParticipants = [];
      const cp = { id: 'cp_' + crypto.randomUUID(), joinedAt: new Date().toISOString(), ...args.data };
      this.db.callParticipants.push(cp);
      this.persist();
      return cp;
    },
    updateMany: async (args: { where: any; data: any }) => {
      if (!this.db.callParticipants) this.db.callParticipants = [];
      let count = 0;
      this.db.callParticipants.forEach((p) => {
        if (args.where?.callId && p.callId === args.where.callId) {
          Object.assign(p, args.data);
          count++;
        }
      });
      this.persist();
      return { count };
    },
  };

  public savedPost = {
    findUnique: async (args: any) => {
      const uId = args.where?.userId_postId?.userId || args.where?.userId;
      const pId = args.where?.userId_postId?.postId || args.where?.postId;
      if (!this.db.savedPosts) this.db.savedPosts = [];
      return (
        this.db.savedPosts.find((s) => {
          if (args.where?.id && s.id === args.where.id) return true;
          if (uId && pId && s.userId === uId && s.postId === pId) return true;
          return false;
        }) || null
      );
    },
    create: async (args: { data: any }) => {
      if (!this.db.savedPosts) this.db.savedPosts = [];
      const item = {
        id: 'sp_' + crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        ...args.data,
      };
      this.db.savedPosts.unshift(item);
      this.persist();
      return item;
    },
    delete: async (args: any) => {
      if (!this.db.savedPosts) this.db.savedPosts = [];
      const uId = args.where?.userId_postId?.userId || args.where?.userId;
      const pId = args.where?.userId_postId?.postId || args.where?.postId;
      const idx = this.db.savedPosts.findIndex((s) => {
        if (args.where?.id && s.id === args.where.id) return true;
        if (uId && pId && s.userId === uId && s.postId === pId) return true;
        return false;
      });
      if (idx !== -1) {
        const removed = this.db.savedPosts.splice(idx, 1)[0];
        this.persist();
        return removed;
      }
      return null;
    },
    findMany: async (args?: any) => {
      if (!this.db.savedPosts) this.db.savedPosts = [];
      let list = this.db.savedPosts;
      if (args?.where?.userId) {
        list = list.filter((s) => s.userId === args.where.userId);
      }
      return list
        .map((s) => {
          const post = this.db.posts.find((p) => p.id === s.postId);
          if (!post) return null;
          const author = this.db.users.find((u) => u.id === post.authorId) || {
            id: post.authorId,
            username: 'user',
            displayName: 'User',
            avatarUrl: null,
          };
          return {
            ...s,
            post: {
              ...post,
              author,
              _count: {
                likes: post.likesCount || 0,
                comments: post.commentsCount || (post.comments?.length || 0),
              },
            },
          };
        })
        .filter(Boolean);
    },
  };



  // ── STORY VIEW MODEL ─────────────────────────────────────
  public storyView = {
    findUnique: async (args: any) => {
      const key = args?.where?.storyId_viewerId;
      if (!key) return null;
      const story = this.db.stories.find((s) => s.id === key.storyId);
      if (!story || !story.views) return null;
      return story.views.find((v: any) => v.viewerId === key.viewerId) || null;
    },
    create: async (args: { data: any }) => {
      const { storyId, viewerId } = args.data;
      const story = this.db.stories.find((s) => s.id === storyId);
      if (story) {
        if (!story.views) story.views = [];
        const view = { id: 'sv_' + crypto.randomUUID(), storyId, viewerId, createdAt: new Date().toISOString() };
        story.views.push(view);
        this.persist();
        return view;
      }
      return args.data;
    },
    findMany: async (args?: any) => {
      const storyId = args?.where?.storyId;
      if (!storyId) return [];
      const story = this.db.stories.find((s) => s.id === storyId);
      if (!story || !story.views) return [];
      let views = [...story.views];
      // Sort by viewedAt or createdAt desc by default
      if (args?.orderBy?.viewedAt === 'desc' || args?.orderBy?.createdAt === 'desc') {
        views.sort((a: any, b: any) => new Date(b.viewedAt || b.createdAt || 0).getTime() - new Date(a.viewedAt || a.createdAt || 0).getTime());
      } else if (args?.orderBy?.viewedAt === 'asc' || args?.orderBy?.createdAt === 'asc') {
        views.sort((a: any, b: any) => new Date(a.viewedAt || a.createdAt || 0).getTime() - new Date(b.viewedAt || b.createdAt || 0).getTime());
      }
      // Join viewer user data if include.viewer is requested
      if (args?.include?.viewer) {
        return views.map((v: any) => {
          const viewer = this.db.users.find((u) => u.id === v.viewerId);
          return {
            ...v,
            viewer: viewer
              ? {
                  id: viewer.id,
                  username: viewer.username,
                  displayName: viewer.displayName,
                  avatarUrl: viewer.avatarUrl,
                }
              : null,
          };
        });
      }
      return views;
    },
    deleteMany: async (args?: any) => {
      const storyId = args?.where?.storyId;
      if (!storyId) return { count: 0 };
      const story = this.db.stories.find((s) => s.id === storyId);
      if (!story || !story.views) return { count: 0 };
      const count = story.views.length;
      story.views = [];
      this.persist();
      return { count };
    },
  };

  // ── NOTIFICATIONS MODEL ──────────────────────────────────
  public notification = {
    findMany: async (args?: any) => {
      if (!this.db.notifications) this.db.notifications = [];
      let list = [...this.db.notifications];
      if (args?.where?.recipientId) {
        list = list.filter((n) => n.recipientId === args.where.recipientId);
      }
      if (args?.where?.isRead !== undefined) {
        list = list.filter((n) => n.isRead === args.where.isRead);
      }
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      if (args?.take) {
        list = list.slice(0, args.take);
      }
      return list.map((n) => {
        const sender = this.db.users.find((u) => u.id === n.senderId);
        return {
          ...n,
          sender: sender
            ? {
                id: sender.id,
                username: sender.username,
                displayName: sender.displayName,
                avatarUrl: sender.avatarUrl,
              }
            : null,
        };
      });
    },
    create: async (args: { data: any }) => {
      if (!this.db.notifications) this.db.notifications = [];
      const item = {
        id: 'notif_' + crypto.randomUUID(),
        isRead: false,
        createdAt: new Date().toISOString(),
        ...args.data,
      };
      this.db.notifications.unshift(item);
      this.persist();
      const sender = this.db.users.find((u) => u.id === item.senderId);
      return {
        ...item,
        sender: sender
          ? {
              id: sender.id,
              username: sender.username,
              displayName: sender.displayName,
              avatarUrl: sender.avatarUrl,
            }
          : null,
      };
    },
    createMany: async (args: { data: any[] }) => {
      if (!this.db.notifications) this.db.notifications = [];
      const now = new Date().toISOString();
      const items = (args.data || []).map((d) => ({
        id: 'notif_' + crypto.randomUUID(),
        isRead: false,
        createdAt: now,
        ...d,
      }));
      this.db.notifications.unshift(...items);
      this.persist();
      return { count: items.length };
    },
    update: async (args: { where: any; data: any }) => {
      if (!this.db.notifications) this.db.notifications = [];
      const idx = this.db.notifications.findIndex((n) => n.id === args.where?.id);
      if (idx !== -1) {
        this.db.notifications[idx] = { ...this.db.notifications[idx], ...args.data };
        this.persist();
        return this.db.notifications[idx];
      }
      return null;
    },
    updateMany: async (args: { where: any; data: any }) => {
      if (!this.db.notifications) this.db.notifications = [];
      let count = 0;
      this.db.notifications.forEach((n) => {
        if (!args.where?.recipientId || n.recipientId === args.where.recipientId) {
          if (args.where?.isRead === undefined || n.isRead === args.where.isRead) {
            Object.assign(n, args.data);
            count++;
          }
        }
      });
      this.persist();
      return { count };
    },
    delete: async (args: { where: any }) => {
      if (!this.db.notifications) this.db.notifications = [];
      const idx = this.db.notifications.findIndex((n) => n.id === args.where?.id);
      if (idx !== -1) {
        const removed = this.db.notifications.splice(idx, 1)[0];
        this.persist();
        return removed;
      }
      return null;
    },
    count: async (args?: any) => {
      if (!this.db.notifications) this.db.notifications = [];
      let list = this.db.notifications;
      if (args?.where?.recipientId) {
        list = list.filter((n) => n.recipientId === args.where.recipientId);
      }
      if (args?.where?.isRead !== undefined) {
        list = list.filter((n) => n.isRead === args.where.isRead);
      }
      return list.length;
    },
  };
}

export const localDb = new LocalDatabaseManager();

