-- ============================================================
--  Instagram-like backend schema (SQLite)
--  Ҳама амалҳои корбар дар ин ҷо доимӣ (persistent) захира мешаванд.
-- ============================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ---------- Users / Profile ----------
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  full_name     TEXT    DEFAULT '',
  bio           TEXT    DEFAULT '',
  avatar_url    TEXT    DEFAULT NULL,
  is_admin      INTEGER NOT NULL DEFAULT 0,   -- 1 = модератор/админ
  is_online     INTEGER NOT NULL DEFAULT 0,   -- нуқтаи сабз
  last_seen_at  TEXT    DEFAULT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ---------- Follows (обуна) ----------
CREATE TABLE IF NOT EXISTS follows (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  follower_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (follower_id, following_id)
);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

-- ---------- Posts ----------
CREATE TABLE IF NOT EXISTS posts (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  caption    TEXT    DEFAULT '',
  image_url  TEXT    DEFAULT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at);

-- ---------- Likes ----------
CREATE TABLE IF NOT EXISTS likes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);

-- ---------- Comments (бо voice, edit, delete) ----------
CREATE TABLE IF NOT EXISTS comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id    INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id  INTEGER DEFAULT NULL REFERENCES comments(id) ON DELETE CASCADE,
  text       TEXT    DEFAULT NULL,
  voice_url  TEXT    DEFAULT NULL,           -- паёми овозӣ
  voice_secs INTEGER DEFAULT NULL,
  edited_at  TEXT    DEFAULT NULL,           -- != NULL => "тағйир дода шуд / edited"
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);

-- ---------- Comment reactions (эмодзи) ----------
CREATE TABLE IF NOT EXISTS comment_reactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (comment_id, user_id)               -- як реаксия аз ҳар корбар
);

-- ---------- Direct-message conversations (чат) ----------
CREATE TABLE IF NOT EXISTS conversations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_a     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text            TEXT    DEFAULT NULL,
  voice_url       TEXT    DEFAULT NULL,
  voice_secs      INTEGER DEFAULT NULL,
  delivered_at    TEXT    DEFAULT NULL,       -- як галочка
  seen_at         TEXT    DEFAULT NULL,       -- ду галочкаи кабуд
  edited_at       TEXT    DEFAULT NULL,       -- "edited"
  deleted_at      TEXT    DEFAULT NULL,       -- soft delete
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);

CREATE TABLE IF NOT EXISTS message_reactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  emoji      TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (message_id, user_id)
);

-- ---------- Notifications (огоҳиномаҳо + badge) ----------
CREATE TABLE IF NOT EXISTS notifications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- гиранда
  actor_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- иҷрокунанда
  type       TEXT    NOT NULL,   -- 'like' | 'follow' | 'comment' | 'reaction' | 'message'
  post_id    INTEGER DEFAULT NULL REFERENCES posts(id) ON DELETE CASCADE,
  comment_id INTEGER DEFAULT NULL REFERENCES comments(id) ON DELETE CASCADE,
  is_read    INTEGER NOT NULL DEFAULT 0,   -- 0 => badge сурх
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);
