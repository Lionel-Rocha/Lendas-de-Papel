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
let activeCards = {};

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

        // Armazenar a carta ativa do jogador
        if (!activeCards[roomName]) {
            activeCards[roomName] = {};
        }
        activeCards[roomName][socket.id] = { ...cartaEscolhida, itens: [] };

        if (Object.keys(playersReady[roomName]).length === 2) {
            io.emit('startGame', roomName);
            startTurn(roomName, playersReady[roomName]);
            // playersReady[roomName] = {};
        }
    });

    socket.on('item_chosen', (data) => {

        const roomName = data.roomName;
        const item = data.card;

        if (playerTurn[roomName] !== socket.id) {
            console.log(`Jogador ${socket.id} tentou usar um item fora de sua vez.`);
            return;
        }

        if (!activeCards[roomName] || !activeCards[roomName][socket.id]) {
            console.log(`Carta ativa não encontrada para o jogador ${socket.id}`);
            return;
        }

        // Anexar o item à carta ativa
        activeCards[roomName][socket.id].itens.push(item);
        activeCards[roomName][socket.id].hp += item.hp;
        activeCards[roomName][socket.id].ataque += item.attack;
        let card = activeCards[roomName][socket.id];

        console.log(card);

        socket.broadcast.emit('enemyCardUpdated', { card, roomName });
    });

    socket.on('attack', (data) => {
        const roomName = data.roomName;
        // console.log(playersReady);
        // console.log(roomName);
        // console.log(playersReady[roomName]);

        const opponentId = Object.keys(playersReady[roomName]).find(id => id !== socket.id);

        if (playerTurn[roomName] !== socket.id) {
            console.log(`Jogador ${socket.id} tentou atacar fora de sua vez.`);
            return;
        }

        if (!activeCards[roomName] || !activeCards[roomName][socket.id]) {
            console.log(`Carta ativa não encontrada para o jogador ${socket.id}`);
            return;
        }

        const activeCard = activeCards[roomName][socket.id];

        // console.log(activeCard);
        // console.log(opponentId);
        let attackPower = activeCard.ataque;

        // Calcular o ataque total com base nos itens anexados
        for (const item of activeCard.itens) {
            attackPower += item.attack || 0;
        }

        if (opponentId) {
            let opponentCard = activeCards[roomName][opponentId];
            opponentCard.hp -= attackPower;

            io.to(opponentId).emit('reduceHP', { roomName, amount: attackPower });
            io.to(socket.id).emit('reduceEnemyHP', {roomName, card:opponentCard});
            let hp = opponentCard.hp;
            let ataque = opponentCard.ataque;


            let card = opponentCard;

            card = {card};

            // socket.broadcast.emit('attacked', {card,roomName});

            switchTurn(roomName, playersReady[roomName]);
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
    if (Object.keys(players).length === 0) {
        console.log(`Nenhum jogador encontrado na sala ${roomName}`);
        return;
    }

    const firstPlayerId = Object.keys(players)[0];
    const secondPlayerId = Object.keys(players)[1];
    const randomIndex = Math.floor(Math.random() * 2);
    const startingPlayer = [firstPlayerId, secondPlayerId][randomIndex];

    playerTurn[roomName] = startingPlayer;
    io.emit('turnStarted', roomName, startingPlayer);
    console.log(`O jogador ${startingPlayer} começa a partida na sala ${roomName}`);
}

function switchTurn(roomName, players) {
    const playerIds = Object.keys(players);
    const currentTurn = playerTurn[roomName];

    const currentTurnIndex = playerIds.findIndex(id => id === currentTurn);
    const nextTurnIndex = (currentTurnIndex + 1) % playerIds.length;
    const nextTurn = playerIds[nextTurnIndex];

    playerTurn[roomName] = nextTurn;
    io.emit('turnStarted', roomName, playerTurn[roomName]);
    console.log(`Agora é a vez do jogador ${playerTurn[roomName]} na sala ${roomName}`);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
