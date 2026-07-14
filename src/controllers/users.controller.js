const db = require('../config/db');
const { publicUser } = require('../utils/serialize');
const { fileUrl } = require('../middleware/upload');
const { notify } = require('../services/notify');

// GET /api/users/:id  — профили корбар + статистика + оё ман обуна ҳастам
async function getUser(req, res) {
  const id = Number(req.params.id);
  const user = await db.one('SELECT * FROM users WHERE id = $1', [id]);
  if (!user) return res.status(404).json({ error: 'Корбар ёфт нашуд' });

  const stats = {
    posts: Number((await db.one('SELECT COUNT(*) c FROM posts WHERE user_id = $1', [id])).c),
    followers: Number((await db.one('SELECT COUNT(*) c FROM follows WHERE following_id = $1', [id])).c),
    following: Number((await db.one('SELECT COUNT(*) c FROM follows WHERE follower_id = $1', [id])).c),
  };
  const isFollowing = !!(await db.one(
    'SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2',
    [req.user.id, id]
  ));

  res.json({ user: publicUser(user), stats, isFollowing });
}

// PATCH /api/users/me — тағйири профил (ном, био) — доимӣ захира мешавад
async function updateMe(req, res) {
  const { fullName, bio, username } = req.body || {};
  const cur = req.user;

  if (username && username !== cur.username) {
    const taken = await db.one('SELECT id FROM users WHERE username = $1 AND id != $2', [username, cur.id]);
    if (taken) return res.status(409).json({ error: 'Ин username банд аст' });
  }

  const updated = await db.one(
    `UPDATE users
        SET full_name = $1, bio = $2, username = $3, updated_at = now()
      WHERE id = $4
      RETURNING *`,
    [
      fullName != null ? fullName : cur.full_name,
      bio != null ? bio : cur.bio,
      username || cur.username,
      cur.id,
    ]
  );

  res.json({ user: publicUser(updated) });
}

// POST /api/users/me/avatar — бор кардани аватар (multipart: field "avatar")
async function uploadAvatar(req, res) {
  if (!req.file) return res.status(400).json({ error: 'Файли "avatar" лозим аст' });
  const url = fileUrl(req, req.file.filename);
  const updated = await db.one(
    'UPDATE users SET avatar_url = $1, updated_at = now() WHERE id = $2 RETURNING *',
    [url, req.user.id]
  );
  res.json({ user: publicUser(updated) });
}

// POST /api/users/:id/follow  — обуна (+ notification)
async function follow(req, res) {
  const targetId = Number(req.params.id);
  if (targetId === req.user.id) return res.status(400).json({ error: 'Ба худ обуна шуда намешавад' });
  const target = await db.one('SELECT id FROM users WHERE id = $1', [targetId]);
  if (!target) return res.status(404).json({ error: 'Корбар ёфт нашуд' });

  const r = await db.q(
    'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [req.user.id, targetId]
  );

  if (r.rowCount > 0) {
    await notify({ userId: targetId, actorId: req.user.id, type: 'follow' });
  }
  res.json({ following: true });
}

// DELETE /api/users/:id/follow
async function unfollow(req, res) {
  const targetId = Number(req.params.id);
  await db.q('DELETE FROM follows WHERE follower_id = $1 AND following_id = $2', [req.user.id, targetId]);
  res.json({ following: false });
}

module.exports = { getUser, updateMe, uploadAvatar, follow, unfollow };
