// Маълумоти намунавӣ барои санҷиш: node src/db/seed.js
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

const pass = bcrypt.hashSync('password123', 10);

async function upsertUser(username, email, fullName, isAdmin = 0) {
  const existing = await db.one('SELECT id FROM users WHERE username = $1', [username]);
  if (existing) return existing.id;
  const row = await db.one(
    `INSERT INTO users (username, email, password_hash, full_name, bio, is_admin)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [username, email, pass, fullName, `Салом, ман ${fullName}`, isAdmin]
  );
  return row.id;
}

async function main() {
  await db.initDb();

  const ali = await upsertUser('ali', 'ali@example.com', 'Алӣ Раҳимов', 1);
  const zara = await upsertUser('zara', 'zara@example.com', 'Зара Каримова');
  const dav = await upsertUser('davron', 'davron@example.com', 'Даврон Саидов');

  // Обунаҳо
  for (const [f, t] of [[ali, zara], [zara, ali], [dav, ali]]) {
    await db.q(
      'INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [f, t]
    );
  }

  // Постҳо (танҳо агар холӣ бошад)
  const cnt = Number((await db.one('SELECT COUNT(*) c FROM posts')).c);
  if (cnt === 0) {
    await db.q('INSERT INTO posts (user_id, caption) VALUES ($1, $2)', [zara, 'Аввалин пости ман 🌸']);
    await db.q('INSERT INTO posts (user_id, caption) VALUES ($1, $2)', [ali, 'Рӯзи хуб! ☀️']);
  }

  console.log('✅ Seed тайёр. Логин: ali / zara / davron — парол: password123');
  console.log('   ali = админ (is_admin=1)');
  await db.pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Seed ноком:', e.message);
  process.exit(1);
});
