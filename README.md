# backend-insta

Бекенди Instagram-монанд бо **Node.js + Express + Socket.IO + SQLite**.
Ҳама амалҳои корбар доимӣ (persistent) захира мешаванд ва features-и real-time
(онлайн, typing, seen, notification) тавассути Socket.IO кор мекунанд.

## Технологияҳо
- **Express** — REST API
- **Socket.IO** — real-time (online status, typing, seen, live notification)
- **better-sqlite3** — базаи маълумот (файли `data.db`)
- **multer** — боркунии аватар ва паёми овозӣ ба папкаи `uploads/`
- **JWT + bcrypt** — аутентификатсия

## Оғоз
```bash
npm install
cp .env.example .env      # JWT_SECRET-ро иваз кунед
npm run seed              # маълумоти намунавӣ (ихтиёрӣ)
npm start                 # ё: npm run dev  (auto-reload)
```
Сервер: `http://localhost:4000` · API: `/api` · Socket: `ws://localhost:4000`

Логинҳои намунавӣ (баъди `npm run seed`): `ali` (админ), `zara`, `davron` — парол `password123`.

---

## Ҳамоҳангии features бо спецификатсия

| № | Талаб | Чӣ гуна татбиқ шуд |
|---|-------|-------------------|
| 1 | Захиракунии ҳама амалҳо | Ҳама дар SQLite; профил PATCH `/users/me` доимӣ |
| 2 | Тавсияҳо | `/recommendations/users` + `/recommendations/posts` (Explore) |
| 3 | Notification (like/follow) + badge сурх | `notify()` + сокет `notification:new`, `notifications:count`; ранги badge `#FF3040` |
| 4.1 | Ранги воқеии Instagram | `GET /meta/theme` палитраи аслро медиҳад |
| 4.2 | Timestamp + seen/delivered | Ҳар паём `createdAt`, `status: sent/delivered/seen` |
| 4.3 | Online (сабз) + typing | Сокет `presence:update`, `typing:start/stop` |
| 4.4 | 5-6 реаксия | `👍 ❤️ 😂 😮 😢 😡` — `PUT /comments/:id/reaction` |
| 4.5 | Паёми овозӣ | Field `voice` дар comment/message (multipart) |
| 4.6 | Edit/Delete + "edited" | Соҳиб edit/delete; `edited:true` баъди таҳрир |

### Ҷавоб ба саволҳои кушода
1. **Реаксияҳо:** `👍 ❤️ 😂 😮 😢 😡` (дар `src/config/constants.js`).
2. **Delete:** соҳиби коммент/паём **ё** админ/модератор (`is_admin=1`) метавонад делет кунад.
3. **Voice:** маҳдудияти дарозӣ `VOICE_MAX_SECONDS=60` (тавсия — client enforce мекунад; сервер `voiceSecs` қабул мекунад). Ҳаҷми файл `MAX_UPLOAD_MB=15`.
4. **Stack:** Node.js + Express + Socket.IO + SQLite (диски локалӣ барои файлҳо).

---

## REST API (ҳама ба ҷуз auth/meta токен талаб мекунанд)
`Authorization: Bearer <token>`

### Auth
- `POST /api/auth/register` — `{ username, email, password, fullName? }`
- `POST /api/auth/login` — `{ login, password }` (login = username ё email)
- `GET  /api/auth/me`

### Profile / Users
- `GET   /api/users/:id` — профил + статистика + `isFollowing`
- `PATCH /api/users/me` — `{ fullName?, bio?, username? }` (доимӣ захира)
- `POST  /api/users/me/avatar` — multipart, field `avatar`
- `POST/DELETE /api/users/:id/follow` — обуна/бекоркунӣ (+ notification)
- `GET   /api/users/:id/posts`

### Posts & Likes
- `POST   /api/posts` — multipart, `image` (ихтиёрӣ) + `caption`
- `GET    /api/posts/feed` — обунашудаҳо + худам
- `GET    /api/posts/:id`
- `DELETE /api/posts/:id` — соҳиб ё админ
- `POST/DELETE /api/posts/:id/like` — (+ notification)

### Comments
- `GET    /api/posts/:id/comments`
- `POST   /api/posts/:id/comments` — `{ text }` ё multipart `voice` (+ `voiceSecs`, `parentId?`)
- `PATCH  /api/comments/:id` — `{ text }` (танҳо соҳиб → `edited:true`)
- `DELETE /api/comments/:id` — соҳиб ё админ
- `PUT/DELETE /api/comments/:id/reaction` — `{ emoji }`

### Chat (Direct Messages)
- `GET  /api/conversations` — рӯйхат + паёми охирин + `unread`
- `GET  /api/conversations/with/:userId` — кушодан/сохтан + ҳама паёмҳо
- `POST /api/conversations/with/:userId/messages` — `{ text }` ё multipart `voice`
- `PATCH  /api/messages/:id` — `{ text }` (edit → `edited:true`)
- `DELETE /api/messages/:id` — soft delete (соҳиб ё админ)
- `PUT    /api/messages/:id/reaction` — `{ emoji }`

### Notifications (badge)
- `GET  /api/notifications`
- `GET  /api/notifications/unread-count` — рақами badge-и сурх
- `POST /api/notifications/read` — ҳамаро хонда (badge → 0)
- `POST /api/notifications/:id/read`

### Recommendations & Meta
- `GET /api/recommendations/users` — корбарони пешниҳодшуда (mutual followers)
- `GET /api/recommendations/posts` — тасмаи Explore
- `GET /api/meta/theme` — палитраи ранги Instagram + рӯйхати реаксияҳо

---

## Socket.IO (real-time)

**Пайвастшавӣ** (токен ҳатмист):
```js
import { io } from 'socket.io-client';
const socket = io('http://localhost:4000', { auth: { token } });
```

### Eventҳое, ки сервер мефиристад (client `.on(...)`)
| Event | Payload | Барои чӣ |
|-------|---------|----------|
| `presence:update` | `{ userId, isOnline, lastSeenAt }` | Нуқтаи сабз/хокистарӣ |
| `typing:start` / `typing:stop` | `{ conversationId?, postId?, userId }` | "менависад..." |
| `message:new` | `{ conversationId, message }` | Паёми нав |
| `message:edited` / `message:deleted` / `message:reaction` | ... | Навсозии чат |
| `messages:seen` | `{ conversationId, seenBy, seenAt }` | Ду галочка |
| `notification:new` | notification-и пурра | Огоҳии нав |
| `notifications:count` | `{ unread }` | Рақами badge-и сурх |

### Eventҳое, ки client мефиристад (`socket.emit(...)`)
| Event | Payload |
|-------|---------|
| `typing:start` / `typing:stop` | `{ conversationId }` (чат) ё `{ postId }` (коммент) |
| `messages:seen` | `{ conversationId }` — паёмҳоро дидашуда мекунад |

Онлайн будани корбар автоматӣ ҳангоми connect/disconnect идора мешавад.

---

## Сохтори лоиҳа
```
server.js                 — оғоз (HTTP + Socket.IO)
src/
  app.js                  — Express app, middleware, static /uploads
  config/db.js            — SQLite + схема
  config/constants.js     — реаксияҳо + палитраи Instagram
  db/schema.sql           — ҷадвалҳо
  db/seed.js              — маълумоти намунавӣ
  middleware/auth.js      — JWT guard
  middleware/upload.js    — multer (аватар/овоз)
  realtime/socket.js      — online, typing, seen, emitToUser
  services/notify.js      — сохтани notification + push
  controllers/            — auth, users, posts, comments, messages, notifications, recommendations
  routes/index.js         — ҳама роутҳо
uploads/                  — файлҳои боршуда
```
