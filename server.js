require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const socket = require('./src/realtime/socket');
const { initDb } = require('./src/config/db');

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

// Socket.IO-ро ба ҳамон сервер васл мекунем (real-time: online, typing, seen, notification)
socket.init(server, process.env.CLIENT_ORIGIN || '*');

// Аввал схемаи Postgres-ро тайёр карда, баъд гӯш мекунем
initDb()
  .then(() => {
    server.listen(PORT, () => {
      console.log(`🚀 backend-insta http://localhost:${PORT}`);
      console.log(`   REST:   http://localhost:${PORT}/api`);
      console.log(`   Socket: ws://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Оғози DB ноком:', err.message);
    process.exit(1);
  });
