const db = require('../config/db');
const { publicUser } = require('../utils/serialize');
const { fileUrl } = require('../middleware/upload');
const { notify } = require('../services/notify');

// Пости ягонаро бо статистика барои корбари ҷорӣ бармегардонад
function enrichPost(row, meId) {
  const likes = db.prepare('SELECT COUNT(*) c FROM likes WHERE post_id = ?').get(row.id).c;
  const comments = db.prepare('SELECT COUNT(*) c FROM comments WHERE post_id = ?').get(row.id).c;
  const liked = !!db.prepare('SELECT 1 FROM likes WHERE post_id = ? AND user_id = ?').get(row.id, meId);
  return {
    id: row.id,
    caption: row.caption,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    likeCount: likes,
    commentCount: comments,
    likedByMe: liked,
    author: publicUser({
      id: row.user_id,
      username: row.username,
      full_name: row.full_name,
      avatar_url: row.avatar_url,
      is_online: row.is_online,
    }),
  };
}

const POST_SELECT = `
  SELECT p.*, u.username, u.full_name, u.avatar_url, u.is_online
    FROM posts p JOIN users u ON u.id = p.user_id`;

// POST /api/posts  (multipart: field "image" ихтиёрӣ, caption дар body)
function createPost(req, res) {
  const caption = (req.body && req.body.caption) || '';
  const imageUrl = req.file ? fileUrl(req, req.file.filename) : null;
  const info = db
    .prepare('INSERT INTO posts (user_id, caption, image_url) VALUES (?, ?, ?)')
    .run(req.user.id, caption, imageUrl);
  const row = db.prepare(`${POST_SELECT} WHERE p.id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ post: enrichPost(row, req.user.id) });
}

// GET /api/posts/feed — постҳои корбарони обунашуда + худам
function getFeed(req, res) {
  const rows = db
    .prepare(
      `${POST_SELECT}
        WHERE p.user_id = @me
           OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = @me)
        ORDER BY p.created_at DESC
        LIMIT 50`
    )
    .all({ me: req.user.id });
  res.json({ posts: rows.map((r) => enrichPost(r, req.user.id)) });
}

// GET /api/posts/:id
function getPost(req, res) {
  const row = db.prepare(`${POST_SELECT} WHERE p.id = ?`).get(Number(req.params.id));
  if (!row) return res.status(404).json({ error: 'Пост ёфт нашуд' });
  res.json({ post: enrichPost(row, req.user.id) });
}

// GET /api/users/:id/posts
function getUserPosts(req, res) {
  const rows = db
    .prepare(`${POST_SELECT} WHERE p.user_id = ? ORDER BY p.created_at DESC`)
    .all(Number(req.params.id));
  res.json({ posts: rows.map((r) => enrichPost(r, req.user.id)) });
}

// POST /api/posts/:id/like  (+ notification)
function likePost(req, res) {
  const postId = Number(req.params.id);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'Пост ёфт нашуд' });

  const info = db
    .prepare('INSERT OR IGNORE INTO likes (post_id, user_id) VALUES (?, ?)')
    .run(postId, req.user.id);
  if (info.changes > 0) {
    notify({ userId: post.user_id, actorId: req.user.id, type: 'like', postId });
  }
  const count = db.prepare('SELECT COUNT(*) c FROM likes WHERE post_id = ?').get(postId).c;
  res.json({ liked: true, likeCount: count });
}

// DELETE /api/posts/:id/like
function unlikePost(req, res) {
  const postId = Number(req.params.id);
  db.prepare('DELETE FROM likes WHERE post_id = ? AND user_id = ?').run(postId, req.user.id);
  const count = db.prepare('SELECT COUNT(*) c FROM likes WHERE post_id = ?').get(postId).c;
  res.json({ liked: false, likeCount: count });
}

// DELETE /api/posts/:id  — танҳо соҳиб ё админ
function deletePost(req, res) {
  const postId = Number(req.params.id);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'Пост ёфт нашуд' });
  if (post.user_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'Иҷозат нест' });
  }
  db.prepare('DELETE FROM posts WHERE id = ?').run(postId);
  res.json({ deleted: true });
}

module.exports = {
  createPost, getFeed, getPost, getUserPosts, likePost, unlikePost, deletePost, enrichPost,
};
