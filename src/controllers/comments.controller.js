const db = require('../config/db');
const { commentOut } = require('../utils/serialize');
const { fileUrl } = require('../middleware/upload');
const { notify } = require('../services/notify');
const { REACTIONS } = require('../config/constants');

// Реаксияҳои як комментро ҷамъ мекунад: { "❤️": 3 } + реаксияи ман
function loadReactions(commentId, meId) {
  const rows = db
    .prepare('SELECT emoji, COUNT(*) c FROM comment_reactions WHERE comment_id = ? GROUP BY emoji')
    .all(commentId);
  const reactions = {};
  rows.forEach((r) => (reactions[r.emoji] = r.c));
  const mine = db
    .prepare('SELECT emoji FROM comment_reactions WHERE comment_id = ? AND user_id = ?')
    .get(commentId, meId);
  return { reactions, myReaction: mine ? mine.emoji : null };
}

function hydrate(row, meId) {
  const { reactions, myReaction } = loadReactions(row.id, meId);
  return commentOut({ ...row, reactions, my_reaction: myReaction });
}

const C_SELECT = `
  SELECT c.*, u.username, u.avatar_url, u.is_online
    FROM comments c JOIN users u ON u.id = c.user_id`;

// GET /api/posts/:id/comments
function listComments(req, res) {
  const rows = db
    .prepare(`${C_SELECT} WHERE c.post_id = ? ORDER BY c.created_at ASC`)
    .all(Number(req.params.id));
  res.json({ comments: rows.map((r) => hydrate(r, req.user.id)) });
}

// POST /api/posts/:id/comments  (text дар body ё файли "voice")
function createComment(req, res) {
  const postId = Number(req.params.id);
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  if (!post) return res.status(404).json({ error: 'Пост ёфт нашуд' });

  const text = (req.body && req.body.text) || null;
  const parentId = req.body && req.body.parentId ? Number(req.body.parentId) : null;
  const voiceUrl = req.file ? fileUrl(req, req.file.filename) : null;
  const voiceSecs = req.body && req.body.voiceSecs ? Number(req.body.voiceSecs) : null;

  if (!text && !voiceUrl) {
    return res.status(400).json({ error: 'text ё паёми овозӣ (voice) лозим аст' });
  }

  const info = db
    .prepare(
      `INSERT INTO comments (post_id, user_id, parent_id, text, voice_url, voice_secs)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(postId, req.user.id, parentId, text, voiceUrl, voiceSecs);

  notify({ userId: post.user_id, actorId: req.user.id, type: 'comment', postId, commentId: info.lastInsertRowid });

  const row = db.prepare(`${C_SELECT} WHERE c.id = ?`).get(info.lastInsertRowid);
  res.status(201).json({ comment: hydrate(row, req.user.id) });
}

// PATCH /api/comments/:id  — танҳо соҳиб; edited_at гузошта мешавад
function editComment(req, res) {
  const id = Number(req.params.id);
  const c = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
  if (!c) return res.status(404).json({ error: 'Коммент ёфт нашуд' });
  if (c.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Танҳо комменти худро таҳрир карда метавонед' });
  }
  const { text } = req.body || {};
  if (text == null || text === '') return res.status(400).json({ error: 'text лозим аст' });

  db.prepare("UPDATE comments SET text = ?, edited_at = datetime('now') WHERE id = ?").run(text, id);
  const row = db.prepare(`${C_SELECT} WHERE c.id = ?`).get(id);
  res.json({ comment: hydrate(row, req.user.id) }); // edited=true
}

// DELETE /api/comments/:id — соҳиб ё админ/модератор
function deleteComment(req, res) {
  const id = Number(req.params.id);
  const c = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
  if (!c) return res.status(404).json({ error: 'Коммент ёфт нашуд' });
  if (c.user_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'Иҷозат нест' });
  }
  db.prepare('DELETE FROM comments WHERE id = ?').run(id);
  res.json({ deleted: true });
}

// PUT /api/comments/:id/reaction  { emoji }  — реаксия гузоштан/иваз кардан
function reactComment(req, res) {
  const id = Number(req.params.id);
  const { emoji } = req.body || {};
  if (!REACTIONS.includes(emoji)) {
    return res.status(400).json({ error: 'Реаксияи иҷозатдодашуда нест', allowed: REACTIONS });
  }
  const c = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
  if (!c) return res.status(404).json({ error: 'Коммент ёфт нашуд' });

  db.prepare(
    `INSERT INTO comment_reactions (comment_id, user_id, emoji) VALUES (?, ?, ?)
     ON CONFLICT (comment_id, user_id) DO UPDATE SET emoji = excluded.emoji`
  ).run(id, req.user.id, emoji);

  notify({ userId: c.user_id, actorId: req.user.id, type: 'reaction', postId: c.post_id, commentId: id });
  res.json(loadReactions(id, req.user.id));
}

// DELETE /api/comments/:id/reaction — реаксияро бардоштан
function unreactComment(req, res) {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM comment_reactions WHERE comment_id = ? AND user_id = ?').run(id, req.user.id);
  res.json(loadReactions(id, req.user.id));
}

module.exports = {
  listComments, createComment, editComment, deleteComment, reactComment, unreactComment,
};
