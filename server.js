const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const MESSAGES_FILE = path.join(DATA_DIR, 'messages.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify({}));
if (!fs.existsSync(MESSAGES_FILE)) fs.writeFileSync(MESSAGES_FILE, JSON.stringify({}));

function loadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch(e){ return {}; }
}
function saveJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf8');
}

let users = loadJson(USERS_FILE);       // keyed by code -> { name, surname, code, online, socketId }
let messages = loadJson(MESSAGES_FILE); // keyed by sorted codes "codeA-codeB" -> [ {fromCode, toCode, message, timestamp} ]

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Helper: produce public user list (no socket ids)
function publicUsers() {
  return Object.values(users).map(u => ({
    name: u.name,
    surname: u.surname,
    code: u.code,
    online: !!u.online
  }));
}

io.on('connection', (socket) => {
  console.log('New socket', socket.id);

  socket.on('login', ({ name, surname, code }) => {
    if (!code || !name || !surname) {
      socket.emit('login_error', 'Données incomplètes');
      return;
    }

    if (!users[code]) {
      users[code] = { name, surname, code, online: true, socketId: socket.id };
    } else {
      users[code].name = name;
      users[code].surname = surname;
      users[code].online = true;
      users[code].socketId = socket.id;
    }

    saveJson(USERS_FILE, users);
    io.emit('userList', publicUsers());
    socket.emit('login_ok', { name, surname, code });
    console.log('User logged in:', code);
  });

  socket.on('getConversation', ({ fromCode, toCode }) => {
    if (!fromCode || !toCode) { socket.emit('conversationData', []); return; }
    const key = [fromCode, toCode].sort().join('-');
    socket.emit('conversationData', messages[key] || []);
  });

  socket.on('privateMessage', ({ fromCode, toCode, text }) => {
    if (!fromCode || !toCode || !text) return;
    const key = [fromCode, toCode].sort().join('-');
    messages[key] = messages[key] || [];
    const item = { fromCode, toCode, text, timestamp: Date.now() };
    messages[key].push(item);
    saveJson(MESSAGES_FILE, messages);

    // send to both parties if connected
    [fromCode, toCode].forEach(code => {
      const u = users[code];
      if (u && u.socketId) {
        io.to(u.socketId).emit('privateMessage', item);
      }
    });
  });

  socket.on('disconnect', () => {
    // find user by socket id and mark offline
    for (const code of Object.keys(users)) {
      if (users[code].socketId === socket.id) {
        users[code].online = false;
        users[code].socketId = null;
        break;
      }
    }
    saveJson(USERS_FILE, users);
    io.emit('userList', publicUsers());
    console.log('Socket disconnected', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

