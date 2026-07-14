const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const ROOT = path.join(__dirname, '..', '..');
const UPLOAD_ENV = process.env.UPLOAD_DIR || 'uploads';
// Роҳи мутлақ (диски доимии Render) ё нисбӣ (реши лоиҳа)
const UPLOAD_DIR = path.isAbsolute(UPLOAD_ENV) ? UPLOAD_ENV : path.join(ROOT, UPLOAD_ENV);
const MAX_MB = Number(process.env.MAX_UPLOAD_MB || 15);

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${Date.now()}-${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

// URL-и оммавии файли захирашуда
function fileUrl(req, filename) {
  if (!filename) return null;
  return `${req.protocol}://${req.get('host')}/uploads/${filename}`;
}

module.exports = { upload, fileUrl, UPLOAD_DIR };
