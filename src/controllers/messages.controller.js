const db = require('../config/db');
const { messageOut, publicUser } = require('../utils/serialize');
const { fileUrl } = require('../middleware/upload');
const { notify } = require('../services/notify');
const { emitToUser, isOnline } = require('../realtime/socket');
const { REACTIONS } = require('../config/constants');

// Conversation-ро пайдо ё месозад (тартиб: user_a < user_b барои UNIQUE)
function getOrCreateConversation(u1, u2) {
  const a = Math.min(u1, u2);
  const b = Math.max(u1, u2);
  let conv = db.prepare('SELECT * FROM conversations WHERE user_a = ? AND user_b = ?').get(a, b);
  if (!conv) {
    const info = db.prepare('INSERT INTO conversations (user_a, user_b) VALUES (?, ?)').run(a, b);
    conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(info.lastInsertRowid);
  }
  return conv;
}

function otherUserId(conv, meId) {
  return conv.user_a === meId ? conv.user_b : conv.user_a;
}

function loadMsgReactions(messageId) {
  const rows = db
    .prepare('SELECT emoji, COUNT(*) c FROM message_reactions WHERE message_id = ? GROUP BY emoji')
    .all(messageId);
  const out = {};
  rows.forEach((r) => (out[r.emoji] = r.c));
  return out;
}

function hydrateMsg(m) {
  return messageOut({ ...m, reactions: loadMsgReactions(m.id) });
}

// GET /api/conversations — рӯйхати чатҳо бо паёми охирин
function listConversations(req, res) {
  const me = req.user.id;
  const convs = db
    .prepare('SELECT * FROM conversations WHERE user_a = ? OR user_b = ?')
    .all(me, me);

  const result = convs.map((conv) => {
    const otherId = otherUserId(conv, me);
    const other = db.prepare('SELECT * FROM users WHERE id = ?').get(otherId);
    const last = db
      .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1')
      .get(conv.id);
    const unread = db
      .prepare(
        `SELECT COUNT(*) c FROM messages
          WHERE conversation_id = ? AND sender_id != ? AND seen_at IS NULL`
      )
      .get(conv.id, me).c;
    return {
      id: conv.id,
      user: publicUser({ ...other, is_online: isOnline(otherId) ? 1 : other.is_online }),
      lastMessage: last ? hydrateMsg(last) : null,
      unread,
    };
  });

  result.sort((x, y) => {
    const tx = x.lastMessage?.createdAt || '';
    const ty = y.lastMessage?.createdAt || '';
    return ty.localeCompare(tx);
  });
  res.json({ conversations: result });
}

// GET /api/conversations/with/:userId — чатро кушодан/сохтан + паёмҳо
function openConversation(req, res) {
  const otherId = Number(req.params.userId);
  const other = db.prepare('SELECT * FROM users WHERE id = ?').get(otherId);
  if (!other) return res.status(404).json({ error: 'Корбар ёфт нашуд' });

  const conv = getOrCreateConversation(req.user.id, otherId);
  const messages = db
    .prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC')
    .all(conv.id);

  res.json({
    conversationId: conv.id,
    user: publicUser({ ...other, is_online: isOnline(otherId) ? 1 : other.is_online }),
    messages: messages.map(hydrateMsg),
  });
}

// POST /api/conversations/with/:userId/messages  (text ё файли "voice")
function sendMessage(req, res) {
  const otherId = Number(req.params.userId);
  const other = db.prepare('SELECT id FROM users WHERE id = ?').get(otherId);
  if (!other) return res.status(404).json({ error: 'Корбар ёфт нашуд' });

  const text = (req.body && req.body.text) || null;
  const voiceUrl = req.file ? fileUrl(req, req.file.filename) : null;
  const voiceSecs = req.body && req.body.voiceSecs ? Number(req.body.voiceSecs) : null;
  if (!text && !voiceUrl) return res.status(400).json({ error: 'text ё voice лозим аст' });

  const conv = getOrCreateConversation(req.user.id, otherId);

  // Агар гиранда онлайн бошад — фавран "delivered"
  const deliveredAt = isOnline(otherId) ? new Date().toISOString() : null;

  const info = db
    .prepare(
      `INSERT INTO messages (conversation_id, sender_id, text, voice_url, voice_secs, delivered_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(conv.id, req.user.id, text, voiceUrl, voiceSecs, deliveredAt);

  const msg = hydrateMsg(db.prepare('SELECT * FROM messages WHERE id = ?').get(info.lastInsertRowid));

  // Real-time ба гиранда
  emitToUser(otherId, 'message:new', { conversationId: conv.id, message: msg });
  notify({ userId: otherId, actorId: req.user.id, type: 'message' });

  res.status(201).json({ message: msg });
}

// PATCH /api/messages/:id  — таҳрир (танҳо фиристанда), "edited"
function editMessage(req, res) {
  const id = Number(req.params.id);
  const m = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  if (!m) return res.status(404).json({ error: 'Паём ёфт нашуд' });
  if (m.sender_id !== req.user.id) return res.status(403).json({ error: 'Танҳо паёми худро' });
  if (m.deleted_at) return res.status(400).json({ error: 'Паёми ҳазфшуда таҳрир намешавад' });
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text лозим аст' });

  db.prepare("UPDATE messages SET text = ?, edited_at = datetime('now') WHERE id = ?").run(text, id);
  const msg = hydrateMsg(db.prepare('SELECT * FROM messages WHERE id = ?').get(id));

  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(m.conversation_id);
  emitToUser(otherUserId(conv, req.user.id), 'message:edited', { message: msg });
  res.json({ message: msg });
}

// DELETE /api/messages/:id  — soft delete (соҳиб ё админ)
function deleteMessage(req, res) {
  const id = Number(req.params.id);
  const m = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  if (!m) return res.status(404).json({ error: 'Паём ёфт нашуд' });
  if (m.sender_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'Иҷозат нест' });
  }
  db.prepare("UPDATE messages SET deleted_at = datetime('now') WHERE id = ?").run(id);
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(m.conversation_id);
  emitToUser(otherUserId(conv, req.user.id), 'message:deleted', { messageId: id });
  res.json({ deleted: true });
}

// PUT /api/messages/:id/reaction  { emoji }
function reactMessage(req, res) {
  const id = Number(req.params.id);
  const { emoji } = req.body || {};
  if (!REACTIONS.includes(emoji)) {
    return res.status(400).json({ error: 'Реаксия иҷозат нест', allowed: REACTIONS });
  }
  const m = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
  if (!m) return res.status(404).json({ error: 'Паём ёфт нашуд' });

  db.prepare(
    `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (?, ?, ?)
     ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = excluded.emoji`
  ).run(id, req.user.id, emoji);

  const reactions = loadMsgReactions(id);
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(m.conversation_id);
  emitToUser(otherUserId(conv, req.user.id), 'message:reaction', { messageId: id, reactions });
  res.json({ messageId: id, reactions });
}

module.exports = {
  listConversations, openConversation, sendMessage, editMessage, deleteMessage, reactMessage,
};
