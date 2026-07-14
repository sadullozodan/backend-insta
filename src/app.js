const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const routes = require('./routes');
const openapiSpec = require('./config/openapi');
const { UPLOAD_DIR } = require('./middleware/upload');

const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Файлҳои боршуда (аватар, паёми овозӣ) — статикӣ
app.use('/uploads', express.static(UPLOAD_DIR));

// Swagger UI — ҳуҷҷати интерактивии API
app.get('/openapi.json', (req, res) => res.json(openapiSpec));
app.use(
  '/docs',
  swaggerUi.serve,
  swaggerUi.setup(openapiSpec, {
    customSiteTitle: 'backend-insta API',
    swaggerOptions: { persistAuthorization: true },
  })
);

app.get('/', (req, res) => res.json({ ok: true, name: 'backend-insta', api: '/api', docs: '/docs' }));
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api', routes);

// 404
app.use((req, res) => res.status(404).json({ error: 'Роут ёфт нашуд' }));

// Хатоҳо (multer ва ғ.)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Файл хеле калон аст' });
  }
  res.status(err.status || 500).json({ error: err.message || 'Хатои сервер' });
});

module.exports = app;
