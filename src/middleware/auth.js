const { verify } = require('../utils/jwt');
const db = require('../config/db');

// Талаб мекунад, ки токен дуруст бошад.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Токен лозим аст' });
  try {
    const payload = verify(token);
    const user = await db.one('SELECT * FROM users WHERE id = $1', [payload.id]);
    if (!user) return res.status(401).json({ error: 'Корбар ёфт нашуд' });
    req.user = user;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Токени нодуруст ё муддаташ гузашта' });
  }
}

module.exports = { requireAuth };
