const db = require('../config/db');
const { formatNotification } = require('../services/notify');

// GET /api/notifications
async function list(req, res) {
  const rows = await db.many(
    `SELECT n.*, u.username, u.avatar_url, u.full_name, u.is_online
       FROM notifications n JOIN users u ON u.id = n.actor_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT 100`,
    [req.user.id]
  );
  res.json({ notifications: rows.map(formatNotification) });
}

// GET /api/notifications/unread-count  — рақами badge-и сурх
async function unreadCount(req, res) {
  const c = Number(
    (await db.one('SELECT COUNT(*) c FROM notifications WHERE user_id = $1 AND is_read = 0', [req.user.id])).c
  );
  res.json({ unread: c });
}

// POST /api/notifications/read  — ҳамаро хонда кардан (badge => 0)
async function markAllRead(req, res) {
  await db.q('UPDATE notifications SET is_read = 1 WHERE user_id = $1', [req.user.id]);
  res.json({ unread: 0 });
}

// POST /api/notifications/:id/read
async function markRead(req, res) {
  await db.q('UPDATE notifications SET is_read = 1 WHERE id = $1 AND user_id = $2', [
    Number(req.params.id),
    req.user.id,
  ]);
  const c = Number(
    (await db.one('SELECT COUNT(*) c FROM notifications WHERE user_id = $1 AND is_read = 0', [req.user.id])).c
  );
  res.json({ unread: c });
}

module.exports = { list, unreadCount, markAllRead, markRead };
