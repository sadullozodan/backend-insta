const { Server } = require('socket.io');
const { verify } = require('../utils/jwt');
const db = require('../config/db');

let io = null;

// userId -> Set of socketId (як корбар метавонад аз якчанд дастгоҳ пайваст шавад)
const online = new Map();

function isOnline(userId) {
  return online.has(userId) && online.get(userId).size > 0;
}

// Ба ҳамаи сокетҳои як корбар event мефиристад (barои notification, seen, typing...)
function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

async function setUserOnline(userId, on) {
  const now = new Date();
  await db.q('UPDATE users SET is_online = $1, last_seen_at = $2 WHERE id = $3', [on ? 1 : 0, now, userId]);
  // Ба ҳамаи корбарон хабар медиҳем (нуқтаи сабз/хокистарӣ)
  if (io) io.emit('presence:update', { userId, isOnline: on, lastSeenAt: now.toISOString() });
}

function init(server, corsOrigin) {
  io = new Server(server, {
    cors: { origin: corsOrigin || '*', methods: ['GET', 'POST'] },
  });

  // Аутентификатсияи сокет тавассути токен
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Токен лозим аст'));
    try {
      const payload = verify(token);
      socket.userId = payload.id;
      next();
    } catch (e) {
      next(new Error('Токени нодуруст'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    socket.join(`user:${userId}`);

    // --- Online status (нуқтаи сабз) ---
    if (!online.has(userId)) online.set(userId, new Set());
    const wasOffline = online.get(userId).size === 0;
    online.get(userId).add(socket.id);
    if (wasOffline) setUserOnline(userId, true).catch((e) => console.error(e.message));

    // Ба худи корбар шумораи badge-и ҷориро мефиристем
    try {
      const row = await db.one(
        'SELECT COUNT(*) c FROM notifications WHERE user_id = $1 AND is_read = 0',
        [userId]
      );
      socket.emit('notifications:count', { unread: Number(row.c) });
    } catch (e) {
      console.error(e.message);
    }

    // --- Typing indicator ("менависад...") ---
    // Барои чат: { conversationId } | Барои коммент: { postId }
    socket.on('typing:start', (data = {}) => broadcastTyping(socket, data, true));
    socket.on('typing:stop', (data = {}) => broadcastTyping(socket, data, false));

    // --- Seen (галочкаҳо) ---
    // Корбар паёмҳоро дид => дар DB seen_at гузошта, ба фиристанда хабар медиҳем
    socket.on('messages:seen', async (data = {}) => {
      const { conversationId } = data;
      if (!conversationId) return;
      try {
        const now = new Date();
        const r = await db.q(
          `UPDATE messages SET seen_at = $1
            WHERE conversation_id = $2 AND sender_id != $3 AND seen_at IS NULL`,
          [now, conversationId, userId]
        );
        if (r.rowCount > 0) {
          const conv = await db.one('SELECT * FROM conversations WHERE id = $1', [conversationId]);
          if (conv) {
            const other = conv.user_a === userId ? conv.user_b : conv.user_a;
            emitToUser(other, 'messages:seen', {
              conversationId,
              seenBy: userId,
              seenAt: now.toISOString(),
            });
          }
        }
      } catch (e) {
        console.error(e.message);
      }
    });

    // --- Disconnect ---
    socket.on('disconnect', () => {
      const set = online.get(userId);
      if (set) {
        set.delete(socket.id);
        if (set.size === 0) {
          online.delete(userId);
          setUserOnline(userId, false).catch((e) => console.error(e.message));
        }
      }
    });
  });

  return io;
}

async function broadcastTyping(socket, data, isTyping) {
  const userId = socket.userId;
  const event = isTyping ? 'typing:start' : 'typing:stop';
  try {
    if (data.conversationId) {
      const conv = await db.one('SELECT * FROM conversations WHERE id = $1', [data.conversationId]);
      if (!conv) return;
      const other = conv.user_a === userId ? conv.user_b : conv.user_a;
      emitToUser(other, event, { conversationId: data.conversationId, userId });
    } else if (data.postId) {
      // Ба ҳамаи тамошобинони пост (ба ҷуз худаш)
      socket.broadcast.emit(event, { postId: data.postId, userId });
    }
  } catch (e) {
    console.error(e.message);
  }
}

module.exports = { init, emitToUser, isOnline };
