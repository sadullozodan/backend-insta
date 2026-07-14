const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// DATA_DIR — барои Render/production метавон онро ба диски доимӣ (масалан /var/data)
// равона кард, то data.db баъди redeploy гум нашавад. Пешфарз: реши лоиҳа.
const ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = process.env.DATA_DIR
  ? (path.isAbsolute(process.env.DATA_DIR) ? process.env.DATA_DIR : path.join(ROOT, process.env.DATA_DIR))
  : ROOT;
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'data.db');
const SCHEMA_PATH = path.join(__dirname, '..', 'db', 'schema.sql');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Схемаро дар оғоз татбиқ мекунем (idempotent — CREATE TABLE IF NOT EXISTS)
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

module.exports = db;
