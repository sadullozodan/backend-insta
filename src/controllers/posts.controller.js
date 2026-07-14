const db = require('../config/db');
const { publicUser } = require('../utils/serialize');
const { fileUrl } = require('../middleware/upload');
const { notify } = require('../services/notify');

// Пости ягонаро бо статистика барои корбари ҷорӣ бармегардонад
async function enrichPost(row, meId) {
  const likes = Number((await db.one('SELECT COUNT(*) c FROM likes WHERE post_id = $1', [row.id])).c);
  const comments = Number((await db.one('SELECT COUNT(*) c FROM comments WHERE post_id = $1', [row.id])).c);
  const liked = !!(await db.one('SELECT 1 FROM likes WHERE post_id = $1 AND user_id = $2', [row.id, meId]));
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

const enrichAll = (rows, meId) => Promise.all(rows.map((r) => enrichPost(r, meId)));

const POST_SELECT = `
  SELECT p.*, u.username, u.full_name, u.avatar_url, u.is_online
    FROM posts p JOIN users u ON u.id = p.user_id`;

// POST /api/posts  (multipart: field "image" ихтиёрӣ, caption дар body)
async function createPost(req, res) {
  const caption = (req.body && req.body.caption) || '';
  const imageUrl = req.file ? fileUrl(req, req.file.filename) : null;
  const inserted = await db.one(
    'INSERT INTO posts (user_id, caption, image_url) VALUES ($1, $2, $3) RETURNING id',
    [req.user.id, caption, imageUrl]
  );
  const row = await db.one(`${POST_SELECT} WHERE p.id = $1`, [inserted.id]);
  res.status(201).json({ post: await enrichPost(row, req.user.id) });
}

// GET /api/posts/feed — постҳои корбарони обунашуда + худам
async function getFeed(req, res) {
  const rows = await db.many(
    `${POST_SELECT}
        WHERE p.user_id = $1
           OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = $1)
        ORDER BY p.created_at DESC
        LIMIT 50`,
    [req.user.id]
  );
  res.json({ posts: await enrichAll(rows, req.user.id) });
}

// GET /api/posts/:id
async function getPost(req, res) {
  const row = await db.one(`${POST_SELECT} WHERE p.id = $1`, [Number(req.params.id)]);
  if (!row) return res.status(404).json({ error: 'Пост ёфт нашуд' });
  res.json({ post: await enrichPost(row, req.user.id) });
}

// GET /api/users/:id/posts
async function getUserPosts(req, res) {
  const rows = await db.many(
    `${POST_SELECT} WHERE p.user_id = $1 ORDER BY p.created_at DESC`,
    [Number(req.params.id)]
  );
  res.json({ posts: await enrichAll(rows, req.user.id) });
}

// POST /api/posts/:id/like  (+ notification)
async function likePost(req, res) {
  const postId = Number(req.params.id);
  const post = await db.one('SELECT * FROM posts WHERE id = $1', [postId]);
  if (!post) return res.status(404).json({ error: 'Пост ёфт нашуд' });

  const r = await db.q(
    'INSERT INTO likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [postId, req.user.id]
  );
  if (r.rowCount > 0) {
    await notify({ userId: post.user_id, actorId: req.user.id, type: 'like', postId });
  }
  const count = Number((await db.one('SELECT COUNT(*) c FROM likes WHERE post_id = $1', [postId])).c);
  res.json({ liked: true, likeCount: count });
}

// DELETE /api/posts/:id/like
async function unlikePost(req, res) {
  const postId = Number(req.params.id);
  await db.q('DELETE FROM likes WHERE post_id = $1 AND user_id = $2', [postId, req.user.id]);
  const count = Number((await db.one('SELECT COUNT(*) c FROM likes WHERE post_id = $1', [postId])).c);
  res.json({ liked: false, likeCount: count });
}

// DELETE /api/posts/:id  — танҳо соҳиб ё админ
async function deletePost(req, res) {
  const postId = Number(req.params.id);
  const post = await db.one('SELECT * FROM posts WHERE id = $1', [postId]);
  if (!post) return res.status(404).json({ error: 'Пост ёфт нашуд' });
  if (post.user_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'Иҷозат нест' });
  }
  await db.q('DELETE FROM posts WHERE id = $1', [postId]);
  res.json({ deleted: true });
}

module.exports = {
  createPost, getFeed, getPost, getUserPosts, likePost, unlikePost, deletePost, enrichPost,
};
