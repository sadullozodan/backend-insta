const db = require('../config/db');
const { publicUser } = require('../utils/serialize');
const { fileUrl } = require('../middleware/upload');
const { notify } = require('../services/notify');

// GET /api/users/:id  — профили корбар + статистика + оё ман обуна ҳастам
function getUser(req, res) {
  const id = Number(req.params.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'Корбар ёфт нашуд' });

  const stats = {
    posts: db.prepare('SELECT COUNT(*) c FROM posts WHERE user_id = ?').get(id).c,
    followers: db.prepare('SELECT COUNT(*) c FROM follows WHERE following_id = ?').get(id).c,
    following: db.prepare('SELECT COUNT(*) c FROM follows WHERE follower_id = ?').get(id).c,
  };
  const isFollowing = !!db
    .prepare('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?')
    .get(req.user.id, id);

  res.json({ user: publicUser(user), stats, isFollowing });
}

// PATCH /api/users/me — тағйири профил (ном, био) — доимӣ захира мешавад
function updateMe(req, res) {
  const { fullName, bio, username } = req.body || {};
  const cur = req.user;

  if (username && username !== cur.username) {
    const taken = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, cur.id);
    if (taken) return res.status(409).json({ error: 'Ин username банд аст' });
  }

  db.prepare(
    `UPDATE users
        SET full_name = ?, bio = ?, username = ?, updated_at = datetime('now')
      WHERE id = ?`
  ).run(
    fullName != null ? fullName : cur.full_name,
    bio != null ? bio : cur.bio,
    username || cur.username,
    cur.id
  );

  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(cur.id);
  res.json({ user: publicUser(updated) });
}

// POST /api/users/me/avatar — бор кардани аватар (multipart: field "avatar")
function uploadAvatar(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Файли "avatar" лозим аст' });
  const url = fileUrl(req, req.file.filename);
  db.prepare("UPDATE users SET avatar_url = ?, updated_at = datetime('now') WHERE id = ?")
    .run(url, req.user.id);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(updated) });
}

// POST /api/users/:id/follow  — обуна (+ notification)
function follow(req, res) {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'Ба худ обуна шуда намешавад' });
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(targetId);
  if (!target) return res.status(404).json({ error: 'Корбар ёфт нашуд' });

  const info = db
    .prepare('INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)')
    .run(req.user.id, targetId);

  if (info.changes > 0) {
    notify({ userId: targetId, actorId: req.user.id, type: 'follow' });
  }
  res.json({ following: true });
}

// DELETE /api/users/:id/follow
function unfollow(req, res) {
  const targetId = Number(req.params.id);
  db.prepare('DELETE FROM follows WHERE follower_id = ? AND following_id = ?')
    .run(req.user.id, targetId);
  res.json({ following: false });
}

module.exports = { getUser, updateMe, uploadAvatar, follow, unfollow };
