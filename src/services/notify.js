const db = require('../config/db');
const { emitToUser } = require('../realtime/socket');
const { publicUser } = require('../utils/serialize');

/**
 * Notification месозад ва тавассути сокет real-time мефиристад.
 * Badge-и сурх аз ҳисоби is_read=0 ба даст меояд.
 *
 * @param {object} p
 * @param {number} p.userId   - гиранда
 * @param {number} p.actorId  - иҷрокунанда (лайк/обуна кардагӣ)
 * @param {string} p.type     - 'like' | 'follow' | 'comment' | 'reaction' | 'message'
 * @param {number} [p.postId]
 * @param {number} [p.commentId]
 */
function notify({ userId, actorId, type, postId = null, commentId = null }) {
  if (userId === actorId) return null; // ба худ notification намефиристем

  const info = db
    .prepare(
      `INSERT INTO notifications (user_id, actor_id, type, post_id, comment_id)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(userId, actorId, type, postId, commentId);

  const notif = db
    .prepare(
      `SELECT n.*, u.username, u.avatar_url, u.full_name, u.is_online
         FROM notifications n JOIN users u ON u.id = n.actor_id
        WHERE n.id = ?`
    )
    .get(info.lastInsertRowid);

  const payload = formatNotification(notif);

  // Real-time: худи notification + шумораи нави badge
  emitToUser(userId, 'notification:new', payload);
  const unread = db
    .prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0')
    .get(userId).c;
  emitToUser(userId, 'notifications:count', { unread });

  return payload;
}

const TEXT = {
  like: 'пости шуморо лайк кард',
  follow: 'ба шумо обуна шуд',
  comment: 'ба пости шумо коммент навишт',
  reaction: 'ба комменти шумо реаксия гузошт',
  message: 'ба шумо паём фиристод',
};

function formatNotification(n) {
  return {
    id: n.id,
    type: n.type,
    text: TEXT[n.type] || '',
    isRead: !!n.is_read,
    postId: n.post_id,
    commentId: n.comment_id,
    createdAt: n.created_at,
    actor: publicUser({
      id: n.actor_id,
      username: n.username,
      full_name: n.full_name,
      avatar_url: n.avatar_url,
      is_online: n.is_online,
    }),
  };
}

module.exports = { notify, formatNotification };
