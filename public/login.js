const socket = io();

const form = document.getElementById('loginForm');
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const surname = document.getElementById('surname').value.trim();
  const code = document.getElementById('code').value.trim();
  if (!name || !surname || !code) return alert('Remplis tous les champs');

  const user = { name, surname, code };
  localStorage.setItem('chat_user', JSON.stringify(user));
  socket.emit('login', user);
  // wait ack then redirect
  socket.once('login_ok', () => {
    window.location.href = '/chat.html';
  });
  socket.once('login_error', (msg) => alert(msg));
});

