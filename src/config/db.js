const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL танзим нашудааст. Онро дар .env гузоред.');
  process.exit(1);
}

// Render Postgres SSL талаб мекунад. Дар локал ҳам зарар надорад.
const ssl = process.env.DB_NO_SSL === '1' ? false : { rejectUnauthorized: false };

const pool = new Pool({ connectionString: DATABASE_URL, ssl });

pool.on('error', (err) => console.error('Хатои pool-и Postgres:', err.message));

// --- Помощникҳо (helpers) ---
// q    — натиҷаи хом (rowCount, rows)
// one  — сатри якум ё null
// many — ҳамаи сатрҳо
async function q(text, params) {
  return pool.query(text, params);
}
async function one(text, params) {
  const r = await pool.query(text, params);
  return r.rows[0] || null;
}
async function many(text, params) {
  const r = await pool.query(text, params);
  return r.rows;
}

// Схемаро дар оғоз татбиқ мекунад (idempotent — CREATE TABLE IF NOT EXISTS)
async function initDb() {
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('✅ Схемаи Postgres тайёр');
}

module.exports = { pool, q, one, many, initDb };
