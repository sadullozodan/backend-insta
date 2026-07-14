const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { sign } = require('../utils/jwt');
const { publicUser } = require('../utils/serialize');

function register(req, res) {
  const { username, email, password, fullName } = req.body || {};
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email, password лозиманд' });
  }
  const exists = db
    .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(username, email);
  if (exists) return res.status(409).json({ error: 'Username ё email аллакай истифода шудааст' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare('INSERT INTO users (username, email, password_hash, full_name) VALUES (?, ?, ?, ?)')
    .run(username, email, hash, fullName || '');

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = sign({ id: user.id });
  res.status(201).json({ token, user: publicUser(user) });
}

function login(req, res) {
  const { login, password } = req.body || {};
  if (!login || !password) {
    return res.status(400).json({ error: 'login (username/email) ва password лозиманд' });
  }
  const user = db
    .prepare('SELECT * FROM users WHERE username = ? OR email = ?')
    .get(login, login);
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
