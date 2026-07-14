const db = require('../config/db');
const { formatNotification } = require('../services/notify');

// GET /api/notifications
function list(req, res) {
  const rows = db
    .prepare(
      `SELECT n.*, u.username, u.avatar_url, u.full_name, u.is_online
         FROM notifications n JOIN users u ON u.id = n.actor_id
        WHERE n.user_id = ?
        ORDER BY n.created_at DESC
        LIMIT 100`
    )
    .all(req.user.id);
  res.json({ notifications: rows.map(formatNotification) });
}

// GET /api/notifications/unread-count  — рақами badge-и сурх
function unreadCount(req, res) {
  const c = db
    .prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(req.user.id).c;
  res.json({ unread: c });
}

// POST /api/notifications/read  — ҳамаро хонда кардан (badge => 0)
function markAllRead(req, res) {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ unread: 0 });
}

// POST /api/notifications/:id/read
function markRead(req, res) {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(Number(req.params.id), req.user.id);
  const c = db
    .prepare('SELECT COUNT(*) c FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(req.user.id).c;
  res.json({ unread: c });
}

module.exports = { list, unreadCount, markAllRead, markRead };
