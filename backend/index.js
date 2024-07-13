const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Servidor Socket.io para Matchmaking\n');
});

const io = require('socket.io')(server, {
    cors: {
        origin: '*',
    }
});
let waitingPlayers = [];

io.on('connection', (socket) => {

    socket.on('findMatch', () => {

        waitingPlayers.push(socket);

        if (waitingPlayers.length >= 2) {
            const player1 = waitingPlayers.shift();
            const player2 = waitingPlayers.shift();
            const roomName = `room-${player1.id}-${player2.id}`;

            player1.join(roomName);
            player2.join(roomName);

            io.to(roomName).emit('matchFound', roomName);
        }
    });

    socket.on('chooseCard', (data) => {
        const roomName = data.roomName;
        const card = data.card;

        socket.broadcast.emit('enemyCardChosen', { card, roomName });
    });

    socket.on('disconnect', () => {
        console.log(`Usuário desconectado: ${socket.id}`);

        waitingPlayers = waitingPlayers.filter(player => player.id !== socket.id);
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
