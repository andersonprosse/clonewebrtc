const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" } 
});

app.get('/', (req, res) => {
  res.send('Servidor de Sinalização ON! 🚀');
});

io.on('connection', (socket) => {
  console.log('✅ Conectado:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);
    // Avisa quem já estava na sala que alguém novo chegou
    socket.to(roomId).emit('user-joined', socket.id);
  });

  socket.on('signal', (data) => {
    // Repassa o sinal (oferta/resposta/ICE) para o outro usuário
    socket.to(data.to).emit('signal', { from: socket.id, signal: data.signal });
  });

  socket.on('disconnect', () => console.log('❌ Desconectado'));
});

server.listen(3001, () => console.log('Servidor rodando na porta 3001'));