const http = require('http');
const socketIo = require('socket.io');
const { join } = require("path");
const lendas = require(join(__dirname, "Lendas.json"));
const { ethers } = require('ethers');
const DECK_ADDRESS = '0x1cdaf3E833BA67623047148C292f9c47eE64BBd1';
const JSON_DECK = require('./DeckManager.json');
const ABI_DECK = JSON_DECK.abi;
const PROVIDER_URL = 'https://rpc.testnet.lachain.network';

const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
const deck_contract = new ethers.Contract(DECK_ADDRESS, ABI_DECK, provider);

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Servidor Socket.io para Matchmaking\n');
});

const io = socketIo(server, {
    cors: {
        origin: '*',
    }
});

let waitingPlayers = [];
let playersReady = {};
let playerTurn = {};
let activeCards = {};
let playerDecks = {};

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

    socket.on('getDeck', async (data) => {
        let id = socket.id;
        let address = data.address;
        let player = { id, address };

        try {
            const deckBigInt = await deck_contract.getUserDeck(player.address);
            let deck = deckBigInt.map(card => Number(card)); // Convertendo BigInt para Number
            deck = shuffle_deck(deck);

            [hand, updated_deck] = give_hand(deck);

            if (!playerDecks[socket.id]) {
                playerDecks[socket.id] = {};
            }
            playerDecks[socket.id].deck = updated_deck;
            playerDecks[socket.id].hand = hand;

            io.to(socket.id).emit("hand_deck_shuffled", { hand, updated_deck });
        } catch (e) {
            console.log(e);
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

        if (!activeCards[roomName]) {
            activeCards[roomName] = {};
        }
        activeCards[roomName][socket.id] = { ...cartaEscolhida, itens: [] };

        if (Object.keys(playersReady[roomName]).length === 2) {
            // io.emit('turnStarted', roomName, playerTurn);
            startTurn(roomName, playersReady[roomName]);
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

        activeCards[roomName][socket.id].itens.push(item);
        activeCards[roomName][socket.id].hp += item.hp;
        activeCards[roomName][socket.id].ataque += item.attack;
        let card = activeCards[roomName][socket.id];

        socket.broadcast.emit('enemyCardUpdated', { card, roomName });
    });

    socket.on('attack', (data) => {
        const roomName = data.roomName;

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
        console.log(activeCard);
        let attackPower = activeCard.ataque;

        for (const item of activeCard.itens) {
            attackPower += item.attack || 0;
        }

        if (opponentId) {
            let opponentCard = activeCards[roomName][opponentId];
            opponentCard.hp -= attackPower;

            io.to(opponentId).emit('reduceHP', { roomName, amount: attackPower });
            io.to(socket.id).emit('reduceEnemyHP', { roomName, card: opponentCard });

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

    const drawnCard = drawCard(startingPlayer, roomName);
    console.log(drawnCard);
    console.log(playerTurn[roomName]);
    if (drawnCard) {
        io.to(startingPlayer).emit('drawCard', drawnCard);
    }
}

function give_hand(deck) {
    let hand = [];
    let updatedDeck = [...deck];

    for (let i = 0; i < 5; i++) {
        if (updatedDeck.length > 0) {
            let card = updatedDeck.shift();
            hand.push(card);
        } else {
            console.log("O deck não tem cartas suficientes.");
            break;
        }
    }

    return [hand, updatedDeck];
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

    const drawnCard = drawCard(nextTurn, roomName);
    if (drawnCard) {
        io.to(nextTurn).emit('drawCard', drawnCard);
    }
}

function drawCard(playerId, roomName) {


    if (!playerDecks[playerId] || !playerDecks[playerId].deck || playerDecks[playerId].deck.length === 0) {
        console.log(`O jogador ${playerId} não tem mais cartas no baralho.`);
        return null;
    }

    let card = playerDecks[playerId].deck.shift();

    return card;
}

function shuffle_deck(arr) {
    return arr
        .map((val) => ({ val, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ val }) => val);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});


// const http = require('http');
// const socketIo = require('socket.io');
// const {join} = require("path");
// const lendas = require(join(__dirname, "Lendas.json"));
// const { ethers } = require('ethers');
// const DECK_ADDRESS = '0x1cdaf3E833BA67623047148C292f9c47eE64BBd1';
// const JSON_DECK = require('./DeckManager.json');
// const ABI_DECK = JSON_DECK.abi;
// const PROVIDER_URL = 'https://rpc.testnet.lachain.network'; // Por exemplo, 'https://mainnet.infura.io/v3/SEU_INFURA_PROJECT_ID'
//
// const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
// const deck_contract = new ethers.Contract(DECK_ADDRESS, ABI_DECK, provider);
//
// const server = http.createServer((req, res) => {
//     res.writeHead(200, { 'Content-Type': 'text/plain' });
//     res.end('Servidor Socket.io para Matchmaking\n');
// });
//
// const io = require('socket.io')(server, {
//     cors: {
//         origin: '*',
//     }
// });
//
// let waitingPlayers = [];
// let playersReady = {};
// let playerTurn = {};
// let activeCards = {};
// let playerDecks = {};
//
// io.on('connection', (socket) => {
//
//     socket.on('findMatch', () => {
//         console.log('Player is looking for a match:', socket.id);
//         waitingPlayers.push(socket);
//
//         if (waitingPlayers.length >= 2) {
//             const player1 = waitingPlayers.shift();
//             const player2 = waitingPlayers.shift();
//             const roomName = `room-${player1.id}-${player2.id}`;
//
//             player1.join(roomName);
//             player2.join(roomName);
//
//             io.to(roomName).emit('matchFound', roomName);
//             console.log(`Sala criada: ${roomName}`);
//             console.log('Jogadores na sala:', Array.from(io.sockets.adapter.rooms.get(roomName) || []));
//         }
//     });
//
//     socket.on('getDeck', async (data) => {
//
//         let id = socket.id;
//         let address = data.address;
//         let player = {id, address};
//         console.log(player.address);
//         console.log(typeof player.address);
//         try{
//             let deck;
//             const deckBigInt = await deck_contract.getUserDeck(player.address);
//             deck = deckBigInt.map(card => Number(card)); // Convertendo BigInt para Number
//             // console.log('Deck do jogador:', deck);
//
//             deck = shuffle_deck(deck);
//
//             [hand,updated_deck] = give_hand(deck);
//
//             playerDecks.push(updated_deck);
//
//             io.to(socket.id).emit("hand_deck_shuffled", {hand, updated_deck});
//         } catch(e){
//             console.log(e);
//         }
//
//     })
//
//     socket.on('chooseCard', (data) => {
//         const roomName = data.roomName;
//         const card = data.card;
//
//         const cartaEscolhida = lendas.cartas.find(carta => carta.nome === card.uri);
//
//         if (!cartaEscolhida) {
//             return;
//         }
//
//         if (cartaEscolhida.propriedade === 'lenda') {
//             socket.broadcast.emit('enemyCardChosen', { card, roomName });
//         }
//
//         if (!playersReady[roomName]) {
//             playersReady[roomName] = {};
//         }
//         playersReady[roomName][socket.id] = true;
//
//         // Armazenar a carta ativa do jogador
//         if (!activeCards[roomName]) {
//             activeCards[roomName] = {};
//         }
//         activeCards[roomName][socket.id] = { ...cartaEscolhida, itens: [] };
//
//         if (Object.keys(playersReady[roomName]).length === 2) {
//             io.emit('startGame', roomName);
//             startTurn(roomName, playersReady[roomName]);
//             // playersReady[roomName] = {};
//         }
//     });
//
//     socket.on('item_chosen', (data) => {
//
//         const roomName = data.roomName;
//         const item = data.card;
//
//         if (playerTurn[roomName] !== socket.id) {
//             console.log(`Jogador ${socket.id} tentou usar um item fora de sua vez.`);
//             return;
//         }
//
//         if (!activeCards[roomName] || !activeCards[roomName][socket.id]) {
//             console.log(`Carta ativa não encontrada para o jogador ${socket.id}`);
//             return;
//         }
//
//         // Anexar o item à carta ativa
//         activeCards[roomName][socket.id].itens.push(item);
//         activeCards[roomName][socket.id].hp += item.hp;
//         activeCards[roomName][socket.id].ataque += item.attack;
//         let card = activeCards[roomName][socket.id];
//
//         console.log(card);
//
//         socket.broadcast.emit('enemyCardUpdated', { card, roomName });
//     });
//
//     socket.on('attack', (data) => {
//         const roomName = data.roomName;
//
//         const opponentId = Object.keys(playersReady[roomName]).find(id => id !== socket.id);
//
//         if (playerTurn[roomName] !== socket.id) {
//             console.log(`Jogador ${socket.id} tentou atacar fora de sua vez.`);
//             return;
//         }
//
//         if (!activeCards[roomName] || !activeCards[roomName][socket.id]) {
//             console.log(`Carta ativa não encontrada para o jogador ${socket.id}`);
//             return;
//         }
//
//         const activeCard = activeCards[roomName][socket.id];
//
//         let attackPower = activeCard.ataque;
//
//         // Calcular o ataque total com base nos itens anexados
//         for (const item of activeCard.itens) {
//             attackPower += item.attack || 0;
//         }
//
//         if (opponentId) {
//             let opponentCard = activeCards[roomName][opponentId];
//             opponentCard.hp -= attackPower;
//
//             io.to(opponentId).emit('reduceHP', { roomName, amount: attackPower });
//             io.to(socket.id).emit('reduceEnemyHP', {roomName, card:opponentCard});
//
//             switchTurn(roomName, playersReady[roomName]);
//         } else {
//             console.error('Oponente não encontrado ou nenhuma carta ativa.');
//         }
//     });
//
//     socket.on('disconnect', () => {
//         console.log(`Usuário desconectado: ${socket.id}`);
//         waitingPlayers = waitingPlayers.filter(player => player.id !== socket.id);
//     });
// });
//
// function startTurn(roomName, players) {
//     if (Object.keys(players).length === 0) {
//         console.log(`Nenhum jogador encontrado na sala ${roomName}`);
//         return;
//     }
//
//     const firstPlayerId = Object.keys(players)[0];
//     const secondPlayerId = Object.keys(players)[1];
//     const randomIndex = Math.floor(Math.random() * 2);
//     const startingPlayer = [firstPlayerId, secondPlayerId][randomIndex];
//
//     playerTurn[roomName] = startingPlayer;
//     io.to(roomName).emit('turnStarted', roomName, startingPlayer);
//     console.log(`O jogador ${startingPlayer} começa a partida na sala ${roomName}`);
//
//     // Distribuir uma carta ao jogador no início do turno
//     const drawnCard = drawCard(startingPlayer, roomName);
//     if (drawnCard) {
//         io.to(startingPlayer).emit('drawCard', drawnCard);
//     }
// }
//
// function give_hand(deck) {
//     let hand = [];
//     let updatedDeck = [...deck]; // Faz uma cópia do deck original
//
//     for (let i = 0; i < 5; i++) {
//         if (updatedDeck.length > 0) { // Verifica se ainda há cartas no deck
//             let card = updatedDeck.shift(); // Remove a primeira carta do deck
//             hand.push(card);
//         } else {
//             console.log("O deck não tem cartas suficientes.");
//             break;
//         }
//     }
//
//     return [hand, updatedDeck];
// }
//
// function switchTurn(roomName, players) {
//     const playerIds = Object.keys(players);
//     const currentTurn = playerTurn[roomName];
//
//     const currentTurnIndex = playerIds.findIndex(id => id === currentTurn);
//     const nextTurnIndex = (currentTurnIndex + 1) % playerIds.length;
//     const nextTurn = playerIds[nextTurnIndex];
//
//     playerTurn[roomName] = nextTurn;
//     io.to(roomName).emit('turnStarted', roomName, playerTurn[roomName]);
//     console.log(`Agora é a vez do jogador ${playerTurn[roomName]} na sala ${roomName}`);
//
//     // Distribuir uma carta ao jogador no início do turno
//     const drawnCard = drawCard(nextTurn, roomName);
//     if (drawnCard) {
//         io.to(nextTurn).emit('drawCard', drawnCard);
//     }
// }
//
//
// function drawCard(playerId, roomName) {
//     console.log(playerDecks);
//     console.log(roomName);
//     if (!playerDecks[roomName] || !playerDecks[roomName][playerId] || playerDecks[roomName][playerId].length === 0) {
//         console.log(`O jogador ${playerId} não tem mais cartas no baralho.`);
//         return null;
//     }
//     return playerDecks[roomName][playerId].shift();
// }
//
//
//
// function shuffle_deck(arr) {
//     return arr
//         .map((val) => ({ val, sort: Math.random() }))
//         .sort((a, b) => a.sort - b.sort)
//         .map(({ val }) => val);
// }
//
//
// const PORT = process.env.PORT || 3000;
// server.listen(PORT, () => {
//     console.log(`Servidor rodando na porta ${PORT}`);
// });
