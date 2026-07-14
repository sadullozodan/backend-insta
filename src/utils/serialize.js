// Табдили сатрҳои DB ба объектҳои тоза барои API/сокет.

function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    fullName: u.full_name,
    bio: u.bio,
    avatarUrl: u.avatar_url,
    isAdmin: !!u.is_admin,
    isOnline: !!u.is_online,
    lastSeenAt: u.last_seen_at,
    createdAt: u.created_at,
  };
}

function commentOut(c) {
  return {
    id: c.id,
    postId: c.post_id,
    parentId: c.parent_id,
    text: c.text,
    voiceUrl: c.voice_url,
    voiceSecs: c.voice_secs,
    edited: !!c.edited_at,          // "тағйир дода шуд / edited"
    editedAt: c.edited_at,
    createdAt: c.created_at,
    author: c.username
      ? {
          id: c.user_id,
          username: c.username,
          avatarUrl: c.avatar_url,
          isOnline: !!c.is_online,
        }
      : { id: c.user_id },
    reactions: c.reactions || {},   // { "❤️": 3, "😂": 1 }
    myReaction: c.my_reaction || null,
  };
}

function messageOut(m) {
  return {
    id: m.id,
    conversationId: m.conversation_id,
    senderId: m.sender_id,
    text: m.deleted_at ? null : m.text,
    voiceUrl: m.deleted_at ? null : m.voice_url,
    voiceSecs: m.deleted_at ? null : m.voice_secs,
    deleted: !!m.deleted_at,
    edited: !!m.edited_at,
    editedAt: m.edited_at,
    deliveredAt: m.delivered_at,     // як галочка
    seenAt: m.seen_at,               // ду галочкаи кабуд
    status: m.seen_at ? 'seen' : m.delivered_at ? 'delivered' : 'sent',
    createdAt: m.created_at,
    reactions: m.reactions || {},
  };
}

module.exports = { publicUser, commentOut, messageOut };
