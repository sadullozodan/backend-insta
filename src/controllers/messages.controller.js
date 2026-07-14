const db = require('../config/db');
const { messageOut, publicUser } = require('../utils/serialize');
const { fileUrl } = require('../middleware/upload');
const { notify } = require('../services/notify');
const { emitToUser, isOnline } = require('../realtime/socket');
const { REACTIONS } = require('../config/constants');

// Conversation-ро пайдо ё месозад (тартиб: user_a < user_b барои UNIQUE)
async function getOrCreateConversation(u1, u2) {
  const a = Math.min(u1, u2);
  const b = Math.max(u1, u2);
  let conv = await db.one('SELECT * FROM conversations WHERE user_a = $1 AND user_b = $2', [a, b]);
  if (!conv) {
    conv = await db.one(
      `INSERT INTO conversations (user_a, user_b) VALUES ($1, $2)
       ON CONFLICT (user_a, user_b) DO UPDATE SET user_a = excluded.user_a
       RETURNING *`,
      [a, b]
    );
  }
  return conv;
}

function otherUserId(conv, meId) {
  return conv.user_a === meId ? conv.user_b : conv.user_a;
}

async function loadMsgReactions(messageId) {
  const rows = await db.many(
    'SELECT emoji, COUNT(*) c FROM message_reactions WHERE message_id = $1 GROUP BY emoji',
    [messageId]
  );
  const out = {};
  rows.forEach((r) => (out[r.emoji] = Number(r.c)));
  return out;
}

async function hydrateMsg(m) {
  return messageOut({ ...m, reactions: await loadMsgReactions(m.id) });
}

// GET /api/conversations — рӯйхати чатҳо бо паёми охирин
async function listConversations(req, res) {
  const me = req.user.id;
  const convs = await db.many('SELECT * FROM conversations WHERE user_a = $1 OR user_b = $1', [me]);

  const result = await Promise.all(
    convs.map(async (conv) => {
      const otherId = otherUserId(conv, me);
      const other = await db.one('SELECT * FROM users WHERE id = $1', [otherId]);
      const last = await db.one(
        'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
        [conv.id]
      );
      const unread = Number(
        (await db.one(
          `SELECT COUNT(*) c FROM messages
            WHERE conversation_id = $1 AND sender_id != $2 AND seen_at IS NULL`,
          [conv.id, me]
        )).c
      );
      return {
        id: conv.id,
        user: publicUser({ ...other, is_online: isOnline(otherId) ? 1 : other.is_online }),
        lastMessage: last ? await hydrateMsg(last) : null,
        unread,
      };
    })
  );

  result.sort((x, y) => {
    const tx = x.lastMessage ? new Date(x.lastMessage.createdAt).getTime() : 0;
    const ty = y.lastMessage ? new Date(y.lastMessage.createdAt).getTime() : 0;
    return ty - tx;
  });
  res.json({ conversations: result });
}

// GET /api/conversations/with/:userId — чатро кушодан/сохтан + паёмҳо
async function openConversation(req, res) {
  const otherId = Number(req.params.userId);
  const other = await db.one('SELECT * FROM users WHERE id = $1', [otherId]);
  if (!other) return res.status(404).json({ error: 'Корбар ёфт нашуд' });

  const conv = await getOrCreateConversation(req.user.id, otherId);
  const rows = await db.many(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conv.id]
  );
  const messages = await Promise.all(rows.map(hydrateMsg));

  res.json({
    conversationId: conv.id,
    user: publicUser({ ...other, is_online: isOnline(otherId) ? 1 : other.is_online }),
    messages,
  });
}

// POST /api/conversations/with/:userId/messages  (text ё файли "voice")
async function sendMessage(req, res) {
  const otherId = Number(req.params.userId);
  const other = await db.one('SELECT id FROM users WHERE id = $1', [otherId]);
  if (!other) return res.status(404).json({ error: 'Корбар ёфт нашуд' });

  const text = (req.body && req.body.text) || null;
  const voiceUrl = req.file ? fileUrl(req, req.file.filename) : null;
  const voiceSecs = req.body && req.body.voiceSecs ? Number(req.body.voiceSecs) : null;
  if (!text && !voiceUrl) return res.status(400).json({ error: 'text ё voice лозим аст' });

  const conv = await getOrCreateConversation(req.user.id, otherId);

  // Агар гиранда онлайн бошад — фавран "delivered"
  const deliveredAt = isOnline(otherId) ? new Date() : null;

  const inserted = await db.one(
    `INSERT INTO messages (conversation_id, sender_id, text, voice_url, voice_secs, delivered_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [conv.id, req.user.id, text, voiceUrl, voiceSecs, deliveredAt]
  );

  const msg = await hydrateMsg(inserted);

  // Real-time ба гиранда
  emitToUser(otherId, 'message:new', { conversationId: conv.id, message: msg });
  await notify({ userId: otherId, actorId: req.user.id, type: 'message' });

  res.status(201).json({ message: msg });
}

// PATCH /api/messages/:id  — таҳрир (танҳо фиристанда), "edited"
async function editMessage(req, res) {
  const id = Number(req.params.id);
  const m = await db.one('SELECT * FROM messages WHERE id = $1', [id]);
  if (!m) return res.status(404).json({ error: 'Паём ёфт нашуд' });
  if (m.sender_id !== req.user.id) return res.status(403).json({ error: 'Танҳо паёми худро' });
  if (m.deleted_at) return res.status(400).json({ error: 'Паёми ҳазфшуда таҳрир намешавад' });
  const { text } = req.body || {};
  if (!text) return res.status(400).json({ error: 'text лозим аст' });

  const updated = await db.one(
    'UPDATE messages SET text = $1, edited_at = now() WHERE id = $2 RETURNING *',
    [text, id]
  );
  const msg = await hydrateMsg(updated);

  const conv = await db.one('SELECT * FROM conversations WHERE id = $1', [m.conversation_id]);
  emitToUser(otherUserId(conv, req.user.id), 'message:edited', { message: msg });
  res.json({ message: msg });
}

// DELETE /api/messages/:id  — soft delete (соҳиб ё админ)
async function deleteMessage(req, res) {
  const id = Number(req.params.id);
  const m = await db.one('SELECT * FROM messages WHERE id = $1', [id]);
  if (!m) return res.status(404).json({ error: 'Паём ёфт нашуд' });
  if (m.sender_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'Иҷозат нест' });
  }
  await db.q('UPDATE messages SET deleted_at = now() WHERE id = $1', [id]);
  const conv = await db.one('SELECT * FROM conversations WHERE id = $1', [m.conversation_id]);
  emitToUser(otherUserId(conv, req.user.id), 'message:deleted', { messageId: id });
  res.json({ deleted: true });
}

// PUT /api/messages/:id/reaction  { emoji }
async function reactMessage(req, res) {
  const id = Number(req.params.id);
  const { emoji } = req.body || {};
  if (!REACTIONS.includes(emoji)) {
    return res.status(400).json({ error: 'Реаксия иҷозат нест', allowed: REACTIONS });
  }
  const m = await db.one('SELECT * FROM messages WHERE id = $1', [id]);
  if (!m) return res.status(404).json({ error: 'Паём ёфт нашуд' });

  await db.q(
    `INSERT INTO message_reactions (message_id, user_id, emoji) VALUES ($1, $2, $3)
     ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = excluded.emoji`,
    [id, req.user.id, emoji]
  );

  const reactions = await loadMsgReactions(id);
  const conv = await db.one('SELECT * FROM conversations WHERE id = $1', [m.conversation_id]);
  emitToUser(otherUserId(conv, req.user.id), 'message:reaction', { messageId: id, reactions });
  res.json({ messageId: id, reactions });
}

module.exports = {
  listConversations, openConversation, sendMessage, editMessage, deleteMessage, reactMessage,
};
