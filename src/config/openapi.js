// OpenAPI 3 spec — барои Swagger UI дар /docs
const { REACTIONS } = require('./constants');

const bearer = [{ bearerAuth: [] }];

// Помощник: роут бо ҷавоби умумӣ
const ok = (desc = 'Муваффақ') => ({ '200': { description: desc } });

const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'backend-insta API',
    version: '1.0.0',
    description:
      'Бекенди Instagram-монанд: постҳо, лайк, коммент, чати DM, notification, реаксия, ' +
      'паёми овозӣ, edit/delete. Real-time (online, typing, seen) тавассути Socket.IO.\n\n' +
      '**Аутентификатсия:** аввал `/auth/login` кунед, токенро гиред, баъд болои **Authorize 🔓** ' +
      'пахш карда, токенро гузоред.\n\n' +
      '**Логинҳои намунавӣ** (парол `password123`): `ali` (админ), `zara`, `davron`.',
  },
  servers: [{ url: '/api', description: 'API base' }],
  tags: [
    { name: 'Auth', description: 'Бақайдгирӣ ва вуруд' },
    { name: 'Users', description: 'Профил, аватар, обуна' },
    { name: 'Posts', description: 'Постҳо ва лайк' },
    { name: 'Comments', description: 'Коммент, реаксия, овоз, edit/delete' },
    { name: 'Chat', description: 'Паёмҳои шахсӣ (DM)' },
    { name: 'Notifications', description: 'Огоҳиномаҳо ва badge' },
    { name: 'Recommendations', description: 'Тавсияҳо (корбар/пост)' },
    { name: 'Meta', description: 'Ранг ва реаксияҳо' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      LoginBody: {
        type: 'object',
        required: ['login', 'password'],
        properties: {
          login: { type: 'string', example: 'ali', description: 'username ё email' },
          password: { type: 'string', example: 'password123' },
        },
      },
      RegisterBody: {
        type: 'object',
        required: ['username', 'email', 'password'],
        properties: {
          username: { type: 'string', example: 'newuser' },
          email: { type: 'string', example: 'new@example.com' },
          password: { type: 'string', example: 'secret123' },
          fullName: { type: 'string', example: 'Ном Насаб' },
        },
      },
      UpdateProfileBody: {
        type: 'object',
        properties: {
          fullName: { type: 'string', example: 'Номи нав' },
          bio: { type: 'string', example: 'Био нав ✏️' },
          username: { type: 'string', example: 'newusername' },
        },
      },
      TextBody: {
        type: 'object',
        required: ['text'],
        properties: { text: { type: 'string', example: 'Салом!' } },
      },
      ReactionBody: {
        type: 'object',
        required: ['emoji'],
        properties: { emoji: { type: 'string', enum: REACTIONS, example: REACTIONS[1] } },
      },
    },
  },
  paths: {},
};

// --- Помощник барои сохтани роутҳо ---
function P(path, method, { tag, summary, auth = true, body, form, params, responses }) {
  openapi.paths[path] = openapi.paths[path] || {};
  const op = { tags: [tag], summary, responses: responses || ok() };
  if (auth) op.security = bearer;
  if (params) op.parameters = params;
  if (body) {
    op.requestBody = { required: true, content: { 'application/json': { schema: { $ref: `#/components/schemas/${body}` } } } };
  }
  if (form) {
    op.requestBody = { required: true, content: { 'multipart/form-data': { schema: form } } };
  }
  openapi.paths[path][method] = op;
}

const idParam = (name = 'id') => [{ name, in: 'path', required: true, schema: { type: 'integer' }, example: 1 }];

// Meta / Health
P('/meta/theme', 'get', { tag: 'Meta', summary: 'Палитраи ранги Instagram + реаксияҳо', auth: false });
P('/health', 'get', { tag: 'Meta', summary: 'Санҷиши саломатӣ', auth: false });

// Auth
P('/auth/register', 'post', { tag: 'Auth', summary: 'Бақайдгирӣ', auth: false, body: 'RegisterBody' });
P('/auth/login', 'post', { tag: 'Auth', summary: 'Вуруд (токен мегиред)', auth: false, body: 'LoginBody' });
P('/auth/me', 'get', { tag: 'Auth', summary: 'Профили ҷорӣ' });

// Users
P('/users/{id}', 'get', { tag: 'Users', summary: 'Профили корбар + статистика', params: idParam() });
P('/users/me', 'patch', { tag: 'Users', summary: 'Тағйири профил (доимӣ)', body: 'UpdateProfileBody' });
P('/users/me/avatar', 'post', {
  tag: 'Users', summary: 'Бор кардани аватар',
  form: { type: 'object', properties: { avatar: { type: 'string', format: 'binary' } } },
});
P('/users/{id}/follow', 'post', { tag: 'Users', summary: 'Обуна шудан', params: idParam() });
P('/users/{id}/follow', 'delete', { tag: 'Users', summary: 'Бекор кардани обуна', params: idParam() });
P('/users/{id}/posts', 'get', { tag: 'Users', summary: 'Постҳои корбар', params: idParam() });

// Posts
P('/posts', 'post', {
  tag: 'Posts', summary: 'Пости нав (image ихтиёрӣ)',
  form: { type: 'object', properties: { caption: { type: 'string' }, image: { type: 'string', format: 'binary' } } },
});
P('/posts/feed', 'get', { tag: 'Posts', summary: 'Тасмаи асосӣ (обунашудаҳо + худам)' });
P('/posts/{id}', 'get', { tag: 'Posts', summary: 'Як пост', params: idParam() });
P('/posts/{id}', 'delete', { tag: 'Posts', summary: 'Ҳазфи пост (соҳиб/админ)', params: idParam() });
P('/posts/{id}/like', 'post', { tag: 'Posts', summary: 'Лайк (+ notification)', params: idParam() });
P('/posts/{id}/like', 'delete', { tag: 'Posts', summary: 'Бекор кардани лайк', params: idParam() });

// Comments
P('/posts/{id}/comments', 'get', { tag: 'Comments', summary: 'Рӯйхати комментҳо', params: idParam() });
P('/posts/{id}/comments', 'post', {
  tag: 'Comments', summary: 'Коммент (text ё voice)', params: idParam(),
  form: { type: 'object', properties: { text: { type: 'string' }, parentId: { type: 'integer' }, voice: { type: 'string', format: 'binary' }, voiceSecs: { type: 'integer' } } },
});
P('/comments/{id}', 'patch', { tag: 'Comments', summary: 'Таҳрир (→ "edited")', params: idParam(), body: 'TextBody' });
P('/comments/{id}', 'delete', { tag: 'Comments', summary: 'Ҳазф (соҳиб/админ)', params: idParam() });
P('/comments/{id}/reaction', 'put', { tag: 'Comments', summary: 'Реаксия гузоштан', params: idParam(), body: 'ReactionBody' });
P('/comments/{id}/reaction', 'delete', { tag: 'Comments', summary: 'Реаксияро бардоштан', params: idParam() });

// Chat
P('/conversations', 'get', { tag: 'Chat', summary: 'Рӯйхати чатҳо' });
P('/conversations/with/{userId}', 'get', { tag: 'Chat', summary: 'Кушодани чат + паёмҳо', params: idParam('userId') });
P('/conversations/with/{userId}/messages', 'post', {
  tag: 'Chat', summary: 'Фиристодани паём (text ё voice)', params: idParam('userId'),
  form: { type: 'object', properties: { text: { type: 'string' }, voice: { type: 'string', format: 'binary' }, voiceSecs: { type: 'integer' } } },
});
P('/messages/{id}', 'patch', { tag: 'Chat', summary: 'Таҳрири паём (→ "edited")', params: idParam(), body: 'TextBody' });
P('/messages/{id}', 'delete', { tag: 'Chat', summary: 'Ҳазфи паём (soft)', params: idParam() });
P('/messages/{id}/reaction', 'put', { tag: 'Chat', summary: 'Реаксия ба паём', params: idParam(), body: 'ReactionBody' });

// Notifications
P('/notifications', 'get', { tag: 'Notifications', summary: 'Рӯйхати огоҳиномаҳо' });
P('/notifications/unread-count', 'get', { tag: 'Notifications', summary: 'Рақами badge-и сурх' });
P('/notifications/read', 'post', { tag: 'Notifications', summary: 'Ҳамаро хонда кардан' });
P('/notifications/{id}/read', 'post', { tag: 'Notifications', summary: 'Якеро хонда кардан', params: idParam() });

// Recommendations
P('/recommendations/users', 'get', { tag: 'Recommendations', summary: 'Корбарони пешниҳодшуда' });
P('/recommendations/posts', 'get', { tag: 'Recommendations', summary: 'Explore — постҳои маъмул' });

module.exports = openapi;
