// Маълумоти намунавӣ барои санҷиш: node src/db/seed.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const pass = bcrypt.hashSync('password123', 10);

function upsertUser(username, email, fullName, isAdmin = 0) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return existing.id;
  const info = db
    .prepare('INSERT INTO users (username, email, password_hash, full_name, bio, is_admin) VALUES (?,?,?,?,?,?)')
    .run(username, email, pass, fullName, `Салом, ман ${fullName}`, isAdmin);
  return info.lastInsertRowid;
}

const ali = upsertUser('ali', 'ali@example.com', 'Алӣ Раҳимов', 1);
const zara = upsertUser('zara', 'zara@example.com', 'Зара Каримова');
const dav = upsertUser('davron', 'davron@example.com', 'Даврон Саидов');

// Обунаҳо
const f = db.prepare('INSERT OR IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)');
f.run(ali, zara);
f.run(zara, ali);
f.run(dav, ali);

// Постҳо
const p = db.prepare('INSERT INTO posts (user_id, caption) VALUES (?, ?)');
p.run(zara, 'Аввалин пости ман 🌸');
p.run(ali, 'Рӯзи хуб! ☀️');

console.log('✅ Seed тайёр. Логин: ali / zara / davron — парол: password123');
console.log('   ali = админ (is_admin=1)');
process.exit(0);
