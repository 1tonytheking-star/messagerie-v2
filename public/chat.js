const socket = io();
const stored = localStorage.getItem('chat_user');
if (!stored) {
  window.location.href = '/';
}
const me = JSON.parse(stored);

const usersList = document.getElementById('users');
const messagesEl = document.getElementById('messages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const conversationHeader = document.getElementById('conversationHeader');
const filter = document.getElementById('filter');
const meDiv = document.getElementById('me');
const logoutBtn = document.getElementById('logoutBtn');

meDiv.textContent = `Vous : ${me.name} ${me.surname}`;

let selected = null; // { name, surname, code }

socket.emit('login', me);

socket.on('userList', (users) => {
  renderUsers(users);
});

function renderUsers(users) {
  usersList.innerHTML = '';
  const q = filter && filter.value.toLowerCase();
  users.filter(u => u.code !== me.code)
       .filter(u => !q || (u.name + ' ' + u.surname).toLowerCase().includes(q))
       .forEach(u => {
    const li = document.createElement('li');
    li.className = 'user-item';
    li.innerHTML = `<div class="name">${u.name} ${u.surname}</div><div class="status">${u.online ? '● en ligne' : '○ hors-ligne'}</div>`;
    li.onclick = () => selectUser(u);
    usersList.appendChild(li);
  });
}

filter && filter.addEventListener('input', () => {
  // request not necessary, we have live list
});

function selectUser(u) {
  selected = u;
  conversationHeader.textContent = `Conversation avec ${u.name} ${u.surname}`;
  messagesEl.innerHTML = '';
  socket.emit('getConversation', { fromCode: me.code, toCode: u.code });
}

socket.on('conversationData', (data) => {
  messagesEl.innerHTML = '';
  data.forEach(m => appendMessage(m));
  scrollBottom();
});

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!selected) return alert('Sélectionne d’abord un contact');
  const text = messageInput.value.trim();
  if (!text) return;
  socket.emit('privateMessage', { fromCode: me.code, toCode: selected.code, text });
  messageInput.value = '';
});

socket.on('privateMessage', (item) => {
  // incoming or echoed message relevant to current conversation?
  if (!selected) return;
  if ( (item.fromCode === selected.code && item.toCode === me.code) ||
       (item.fromCode === me.code && item.toCode === selected.code) ) {
    appendMessage(item);
    scrollBottom();
  }
});

function appendMessage(msg) {
  const div = document.createElement('div');
  div.className = 'msg ' + (msg.fromCode === me.code ? 'me' : '');
  const meta = document.createElement('div');
  meta.className = 'meta';
  const sender = msg.fromCode === me.code ? 'Vous' : (selected && msg.fromCode === selected.code ? `${selected.name}` : msg.fromCode);
  meta.textContent = `${sender} • ${new Date(msg.timestamp).toLocaleString()}`;
  const text = document.createElement('div');
  text.className = 'text';
  text.textContent = msg.text;
  div.appendChild(meta);
  div.appendChild(text);
  messagesEl.appendChild(div);
}

function scrollBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('chat_user');
  window.location.href = '/';
});

