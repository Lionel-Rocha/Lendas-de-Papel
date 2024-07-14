const http = require('http');
const socketIo = require('socket.io');
const {join} = require("path");
const lendas = require(join(__dirname, "Lendas.json"));

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
let playersReady = {};
let playerTurn = {};

io.on('connection', (socket) => {

    socket.on('findMatch', () => {
        console.log('Player is looking for a match:', socket.id);
        waitingPlayers.push(socket);

        if (waitingPlayers.length >= 2) {
            const player1 = waitingPlayers.shift();
            const player2 = waitingPlayers.shift();
            const roomName = `room-${player1.id}-${player2.id}`;

            player1.join(roomName);
            player2.join(roomName);

            io.to(roomName).emit('matchFound', roomName);
            console.log(`Sala criada: ${roomName}`);
            console.log('Jogadores na sala:', Array.from(io.sockets.adapter.rooms.get(roomName) || []));
        }
    });

    socket.on('chooseCard', (data) => {
        const roomName = data.roomName;
        const card = data.card;

        const cartaEscolhida = lendas.cartas.find(carta => carta.nome === card.uri);


        if (!cartaEscolhida) {
            return;
        }

        if (cartaEscolhida.propriedade === 'lenda') {
            socket.broadcast.emit('enemyCardChosen', { card, roomName });
        }

        if (!playersReady[roomName]) {
            playersReady[roomName] = {};
        }
        playersReady[roomName][socket.id] = true;

        if (Object.keys(playersReady[roomName]).length === 2) {
            io.emit('startGame', roomName);

            startTurn(roomName, playersReady[roomName]);
            playersReady[roomName] = {};

        }
    });

    socket.on('item_chosen', (data) => {
        const card = data.card;

        let roomName = data.roomName;

        console.log(playerTurn[roomName]);

        if (playerTurn[roomName] !== socket.id) {
            console.log(`Jogador ${socket.id} tentou usar um item fora de sua vez.`);
            return;
        }


        socket.broadcast.emit('enemyCardUpdated', {card, roomName});
    })

    socket.on('attack', (data) => {
        const { roomName, attackPower } = data;
        const opponentId = Object.keys(playersReady[roomName]).find(id => id !== socket.id);

        console.log(playerTurn[roomName]);

        if (playerTurn[roomName] !== socket.id) {
            console.log(`Jogador ${socket.id} tentou atacar fora de sua vez.`);
            return;
        }

        if (opponentId && activeCardInstance) {
            io.to(opponentId).emit('reduceHP', { roomName, amount: attackPower });
            io.emit('update')
            switchTurn(roomName);
        } else {
            console.error('Oponente não encontrado ou nenhuma carta ativa.');
        }
    });


    socket.on('disconnect', () => {
        console.log(`Usuário desconectado: ${socket.id}`);

        waitingPlayers = waitingPlayers.filter(player => player.id !== socket.id);
    });
});

function startTurn(roomName, players) {
    if (players.length === 0) {
        console.log(`Nenhum jogador encontrado na sala ${roomName}`);
        return;
    }

    const firstPlayerId = Object.keys(players)[0];
    const secondPlayerId = Object.keys(players)[1];

    players = [firstPlayerId, secondPlayerId];

    const randomIndex = Math.floor(Math.random() * players.length);
    const startingPlayer = players[randomIndex];
    playerTurn[roomName] = startingPlayer;
    io.emit('turnStarted', roomName, startingPlayer);
    console.log(`O jogador ${startingPlayer} começa a partida na sala ${roomName}`);
}

function switchTurn(roomName) {
    const players = Array.from(io.sockets.adapter.rooms.get(roomName));
    const currentTurnIndex = players.indexOf(playerTurn[roomName]);
    const nextTurnIndex = (currentTurnIndex + 1) % players.length;
    playerTurn[roomName] = players[nextTurnIndex];
    io.to(roomName).emit('turnStarted', playerTurn[roomName]);
    console.log(`Agora é a vez do jogador ${playerTurn[roomName]} na sala ${roomName}`);
}


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
