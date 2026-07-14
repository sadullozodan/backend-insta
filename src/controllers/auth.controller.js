const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { sign } = require('../utils/jwt');
const { publicUser } = require('../utils/serialize');

async function register(req, res) {
  const { username, email, password, fullName } = req.body || {};
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, password лозиманд' });
  }
  const exists = await db.one('SELECT id FROM users WHERE username = $1 OR email = $2', [username, email]);
  if (exists) return res.status(409).json({ error: 'Username ё email аллакай истифода шудааст' });

  const hash = bcrypt.hashSync(password, 10);
  const user = await db.one(
    'INSERT INTO users (username, email, password_hash, full_name) VALUES ($1, $2, $3, $4) RETURNING *',
    [username, email, hash, fullName || '']
  );

  const token = sign({ id: user.id });
  res.status(201).json({ token, user: publicUser(user) });
}

async function login(req, res) {
  const { login, password } = req.body || {};
  if (!login || !password) {
    return res.status(400).json({ error: 'login (username/email) ва password лозиманд' });
  }
  const user = await db.one('SELECT * FROM users WHERE username = $1 OR email = $1', [login]);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Логин ё парол нодуруст' });
  }
  const token = sign({ id: user.id });
  res.json({ token, user: publicUser(user) });
}

function me(req, res) {
  res.json({ user: publicUser(req.user) });
}

module.exports = { register, login, me };
