const db = require('../config/db');
const { commentOut } = require('../utils/serialize');
const { fileUrl } = require('../middleware/upload');
const { notify } = require('../services/notify');
const { REACTIONS } = require('../config/constants');

// Реаксияҳои як комментро ҷамъ мекунад: { "❤️": 3 } + реаксияи ман
async function loadReactions(commentId, meId) {
  const rows = await db.many(
    'SELECT emoji, COUNT(*) c FROM comment_reactions WHERE comment_id = $1 GROUP BY emoji',
    [commentId]
  );
  const reactions = {};
  rows.forEach((r) => (reactions[r.emoji] = Number(r.c)));
  const mine = await db.one(
    'SELECT emoji FROM comment_reactions WHERE comment_id = $1 AND user_id = $2',
    [commentId, meId]
  );
  return { reactions, myReaction: mine ? mine.emoji : null };
}

async function hydrate(row, meId) {
  const { reactions, myReaction } = await loadReactions(row.id, meId);
  return commentOut({ ...row, reactions, my_reaction: myReaction });
}

const C_SELECT = `
  SELECT c.*, u.username, u.avatar_url, u.is_online
    FROM comments c JOIN users u ON u.id = c.user_id`;

// GET /api/posts/:id/comments
async function listComments(req, res) {
  const rows = await db.many(
    `${C_SELECT} WHERE c.post_id = $1 ORDER BY c.created_at ASC`,
    [Number(req.params.id)]
  );
  const comments = await Promise.all(rows.map((r) => hydrate(r, req.user.id)));
  res.json({ comments });
}

// POST /api/posts/:id/comments  (text дар body ё файли "voice")
async function createComment(req, res) {
  const postId = Number(req.params.id);
  const post = await db.one('SELECT * FROM posts WHERE id = $1', [postId]);
  if (!post) return res.status(404).json({ error: 'Пост ёфт нашуд' });

  const text = (req.body && req.body.text) || null;
  const parentId = req.body && req.body.parentId ? Number(req.body.parentId) : null;
  const voiceUrl = req.file ? fileUrl(req, req.file.filename) : null;
  const voiceSecs = req.body && req.body.voiceSecs ? Number(req.body.voiceSecs) : null;

  if (!text && !voiceUrl) {
    return res.status(400).json({ error: 'text ё паёми овозӣ (voice) лозим аст' });
  }

  const inserted = await db.one(
    `INSERT INTO comments (post_id, user_id, parent_id, text, voice_url, voice_secs)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [postId, req.user.id, parentId, text, voiceUrl, voiceSecs]
  );

  await notify({ userId: post.user_id, actorId: req.user.id, type: 'comment', postId, commentId: inserted.id });

  const row = await db.one(`${C_SELECT} WHERE c.id = $1`, [inserted.id]);
  res.status(201).json({ comment: await hydrate(row, req.user.id) });
}

// PATCH /api/comments/:id  — танҳо соҳиб; edited_at гузошта мешавад
async function editComment(req, res) {
  const id = Number(req.params.id);
  const c = await db.one('SELECT * FROM comments WHERE id = $1', [id]);
  if (!c) return res.status(404).json({ error: 'Коммент ёфт нашуд' });
  if (c.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Танҳо комменти худро таҳрир карда метавонед' });
  }
  const { text } = req.body || {};
  if (text == null || text === '') return res.status(400).json({ error: 'text лозим аст' });

  await db.q('UPDATE comments SET text = $1, edited_at = now() WHERE id = $2', [text, id]);
  const row = await db.one(`${C_SELECT} WHERE c.id = $1`, [id]);
  res.json({ comment: await hydrate(row, req.user.id) }); // edited=true
}

// DELETE /api/comments/:id — соҳиб ё админ/модератор
async function deleteComment(req, res) {
  const id = Number(req.params.id);
  const c = await db.one('SELECT * FROM comments WHERE id = $1', [id]);
  if (!c) return res.status(404).json({ error: 'Коммент ёфт нашуд' });
  if (c.user_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'Иҷозат нест' });
  }
  await db.q('DELETE FROM comments WHERE id = $1', [id]);
  res.json({ deleted: true });
}

// PUT /api/comments/:id/reaction  { emoji }  — реаксия гузоштан/иваз кардан
async function reactComment(req, res) {
  const id = Number(req.params.id);
  const { emoji } = req.body || {};
  if (!REACTIONS.includes(emoji)) {
    return res.status(400).json({ error: 'Реаксияи иҷозатдодашуда нест', allowed: REACTIONS });
  }
  const c = await db.one('SELECT * FROM comments WHERE id = $1', [id]);
  if (!c) return res.status(404).json({ error: 'Коммент ёфт нашуд' });

  await db.q(
    `INSERT INTO comment_reactions (comment_id, user_id, emoji) VALUES ($1, $2, $3)
     ON CONFLICT (comment_id, user_id) DO UPDATE SET emoji = excluded.emoji`,
    [id, req.user.id, emoji]
  );

  await notify({ userId: c.user_id, actorId: req.user.id, type: 'reaction', postId: c.post_id, commentId: id });
  res.json(await loadReactions(id, req.user.id));
}

// DELETE /api/comments/:id/reaction — реаксияро бардоштан
async function unreactComment(req, res) {
  const id = Number(req.params.id);
  await db.q('DELETE FROM comment_reactions WHERE comment_id = $1 AND user_id = $2', [id, req.user.id]);
  res.json(await loadReactions(id, req.user.id));
}

module.exports = {
  listComments, createComment, editComment, deleteComment, reactComment, unreactComment,
};
