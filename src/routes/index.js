const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const { REACTIONS, INSTAGRAM_THEME } = require('../config/constants');

const auth = require('../controllers/auth.controller');
const users = require('../controllers/users.controller');
const posts = require('../controllers/posts.controller');
const comments = require('../controllers/comments.controller');
const messages = require('../controllers/messages.controller');
const notifications = require('../controllers/notifications.controller');
const recs = require('../controllers/recommendations.controller');

const router = express.Router();

// ---------- Meta (ранги Instagram + реаксияҳо барои фронтенд) ----------
router.get('/meta/theme', (req, res) => res.json({ theme: INSTAGRAM_THEME, reactions: REACTIONS }));

// ---------- Auth ----------
router.post('/auth/register', auth.register);
router.post('/auth/login', auth.login);
router.get('/auth/me', requireAuth, auth.me);

// ---------- Users / Profile ----------
router.get('/users/:id', requireAuth, users.getUser);
router.patch('/users/me', requireAuth, users.updateMe);
router.post('/users/me/avatar', requireAuth, upload.single('avatar'), users.uploadAvatar);
router.post('/users/:id/follow', requireAuth, users.follow);
router.delete('/users/:id/follow', requireAuth, users.unfollow);
router.get('/users/:id/posts', requireAuth, posts.getUserPosts);

// ---------- Posts ----------
router.post('/posts', requireAuth, upload.single('image'), posts.createPost);
router.get('/posts/feed', requireAuth, posts.getFeed);
router.get('/posts/:id', requireAuth, posts.getPost);
router.delete('/posts/:id', requireAuth, posts.deletePost);
router.post('/posts/:id/like', requireAuth, posts.likePost);
router.delete('/posts/:id/like', requireAuth, posts.unlikePost);

// ---------- Comments ----------
router.get('/posts/:id/comments', requireAuth, comments.listComments);
router.post('/posts/:id/comments', requireAuth, upload.single('voice'), comments.createComment);
router.patch('/comments/:id', requireAuth, comments.editComment);
router.delete('/comments/:id', requireAuth, comments.deleteComment);
router.put('/comments/:id/reaction', requireAuth, comments.reactComment);
router.delete('/comments/:id/reaction', requireAuth, comments.unreactComment);

// ---------- Direct messages / Chat ----------
router.get('/conversations', requireAuth, messages.listConversations);
router.get('/conversations/with/:userId', requireAuth, messages.openConversation);
router.post('/conversations/with/:userId/messages', requireAuth, upload.single('voice'), messages.sendMessage);
router.patch('/messages/:id', requireAuth, messages.editMessage);
router.delete('/messages/:id', requireAuth, messages.deleteMessage);
router.put('/messages/:id/reaction', requireAuth, messages.reactMessage);

// ---------- Notifications (badge) ----------
router.get('/notifications', requireAuth, notifications.list);
router.get('/notifications/unread-count', requireAuth, notifications.unreadCount);
router.post('/notifications/read', requireAuth, notifications.markAllRead);
router.post('/notifications/:id/read', requireAuth, notifications.markRead);

// ---------- Recommendations ----------
router.get('/recommendations/users', requireAuth, recs.recommendUsers);
router.get('/recommendations/posts', requireAuth, recs.recommendPosts);

module.exports = router;
