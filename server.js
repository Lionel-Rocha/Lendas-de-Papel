const http = require('http');
const socketIo = require('socket.io');
const { join } = require("path");
const lendas = require(join(__dirname, "Lendas.json"));
const { ethers } = require('ethers');
const DECK_ADDRESS = '0xbbF7d1677Cf1781f8d887be420b3980cF4c7d6Ce';
const JSON_DECK = require('./DeckManager.json');
const ABI_DECK = JSON_DECK.abi;

const BOOSTER_ADDRESS = "0x633971307324998C03D9a71A5f106B58E42d95af"
const JSON_BOOSTER = require("./OrigamiCards.json");
const ABI_BOOSTER = JSON_BOOSTER.abi;

const PROVIDER_URL = 'https://rpc.testnet.lachain.network';

const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
const deck_contract = new ethers.Contract(DECK_ADDRESS, ABI_DECK, provider);
const booster_contract = new ethers.Contract(BOOSTER_ADDRESS, ABI_BOOSTER, provider);

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
let playerPoints = {};
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
            let deck = deckBigInt.map(card => Number(card));
            deck = shuffle_deck(deck);

            [hand, updated_deck] = give_hand(deck);

            if (!playerDecks[socket.id]) {
                playerDecks[socket.id] = {};
            }
            playerDecks[socket.id].deck = updated_deck;
            playerDecks[socket.id].hand = hand;

            checkSpecialCards(hand, socket.id);

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

        removeCardFromHand(socket.id, card.id);

        if (!playerPoints[roomName]) {
            playerPoints[roomName] = {};
        }

        if (Object.keys(playersReady[roomName]).length === 2) {
            console.log(playersReady[roomName]);

            for (let playerId in playersReady[roomName]) {
                if (playersReady[roomName].hasOwnProperty(playerId)) {
                    playerPoints[roomName][playerId] = 0;
                }
            }
            startTurn(roomName, playersReady[roomName]);
        }
    });


    socket.on('item_chosen', async (data) => {
        const roomName = data.roomName;


        if (playerTurn[roomName] !== socket.id) {
            console.log(`Jogador ${socket.id} tentou usar um item fora de sua vez.`);
            return;
        }

        if (!activeCards[roomName] || !activeCards[roomName][socket.id]) {
            console.log(`Carta ativa não encontrada para o jogador ${socket.id}`);
            return;
        }

        let activeCard = activeCards[roomName][socket.id];

        let item;
        item = data.card;

        if (item.uri === "Catavento") {
            await reshuffleHand(socket.id, roomName);
        } else if (item.uri === "Dobradura") {
            const newCard = await dobradura(socket.id, roomName);
            if (newCard) {
               let hand = playerDecks[socket.id].hand;
               let deck = playerDecks[socket.id];
               io.to(socket.id).emit("hand_changes", {hand, deck: deck.deck });
            }
        } else {

            activeCard.itens.push(item);
            activeCard.hp += item.hp;
            activeCard.ataque += item.attack;

        }

        socket.broadcast.emit('enemyCardUpdated', { card: activeCard, roomName });
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
        let attackPower = activeCard.ataque;

        if (opponentId) {
            let opponentCard = activeCards[roomName][opponentId];
            opponentCard.hp -= attackPower;

            console.log(opponentCard.hp);

            if (opponentCard.hp <= 0){
                handleLegendDeath(socket.id, roomName)
            }

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

        Object.keys(playersReady).forEach(roomName => {
            if (playersReady[roomName][socket.id]) {
                delete playersReady[roomName][socket.id];
            }
        });

        Object.keys(playersReady).forEach(roomName => {
            if (Object.keys(playersReady[roomName]).length === 0) {
                delete playersReady[roomName];
                delete playerTurn[roomName];
                delete activeCards[roomName];
                delete playerDecks[roomName];
                delete playerPoints[roomName];
            }
        });
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
    if (drawnCard) {
        io.to(startingPlayer).emit('drawCard', drawnCard);
    }
}

async function dobradura(playerId, roomName) {
    const deck = playerDecks[playerId].deck;
    const items = ["Catavento", 'Coracao', 'Dobradura', 'Tesoura'];

    let card;
    for (let i = 0; i < deck.length; i++) {
        const uri = await booster_contract.tokenURI(deck[i]);
        if (!items.includes(uri)) {
            card = deck[i];
            playerDecks[playerId].deck = deck.filter((_, index) => index !== i);
            playerDecks[playerId].hand.push(card);
            console.log(card);
            return card;
        }
    }
    return null;
}

async function check_if_has_legend(playerId) {
    const deck = playerDecks[playerId].hand;
    const items = ["Catavento", 'Coracao', 'Dobradura', 'Tesoura'];

    let card;
    for (let i = 0; i < deck.length; i++) {
        const uri = await booster_contract.tokenURI(deck[i]);
        if (!items.includes(uri)) {
            card = {id: deck[i], uri: uri}
            return card;
        }
    }
    return null;
}

async function reshuffleHand(playerId, roomName) {
    let deck = playerDecks[playerId].deck;

    playerDecks[playerId].deck = shuffle_deck([...deck, ...playerDecks[playerId].hand]);

    let [newHand, updatedDeck] = give_hand(playerDecks[playerId].deck);

    playerDecks[playerId].hand = newHand;
    playerDecks[playerId].deck = updatedDeck;

    io.to(playerId).emit("hand_changes", { hand: newHand, deck: updatedDeck });
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

function checkSpecialCards(hand, playerId) {
    const specialCards = ['Catavento', 'Dobradura'];
    hand.forEach(card => {
        if (specialCards.includes(card.nome)) {

            io.to(playerId).emit('specialCardReceived', { card });
            if (card.nome === 'Catavento') {
                handleCataventoCard(playerId);
            }
        }
    });
}

function handleCataventoCard(playerId) {
    playerDecks[playerId].deck.push(...playerDecks[playerId].hand);
    playerDecks[playerId].deck = shuffle_deck(playerDecks[playerId].deck);
    [hand, updated_deck] = give_hand(playerDecks[playerId].deck);

    playerDecks[playerId].deck = updated_deck;
    playerDecks[playerId].hand = hand;

    io.to(playerId).emit("hand_deck_shuffled", { hand, updated_deck });
}

function removeCardFromHand(playerId, cardId) {
    if (playerDecks[playerId] && playerDecks[playerId].hand) {
        playerDecks[playerId].hand = playerDecks[playerId].hand.filter(card => card.id !== cardId);
    }
}

function handleLegendDeath(playerId, roomName) {
    const opponentId = Object.keys(playersReady[roomName]).find(id => id !== playerId);

    if (playerPoints[roomName] && playerPoints[roomName][playerId] !== undefined) {
        playerPoints[roomName][playerId]++;
    } else {
        console.error(`Player points not initialized for playerId: ${playerId}, roomName: ${roomName}`);
    }

    console.log("morreu");
    io.to(opponentId).emit('legendDied', roomName);
    io.to(playerId).emit('enemyLegendDied', roomName);

    if (playerDecks[opponentId] && playerDecks[opponentId].hand.length > 0) {
        io.to(opponentId).emit('selectNewLegend', playerDecks[opponentId].hand);
    } else {
        checkGameOver(roomName);
    }
}

async function checkGameOver(roomName) {
    const points = playerPoints[roomName];

    let has_legend_p1 = await check_if_has_legend(playerDecks[Object.keys(points)[0]]);
    let has_legend_p2 = await check_if_has_legend(playerDecks[Object.keys(points)[1]]);

    console.log(has_legend_p1);
    console.log(has_legend_p2);

    const player1NoCards = playerDecks[Object.keys(points)[0]].deck.length === 0 && has_legend_p1;
    const player2NoCards = playerDecks[Object.keys(points)[1]].deck.length === 0 && has_legend_p2;

    if (player1NoCards || player2NoCards) {
        const winner = Object.keys(points).reduce((a, b) => points[a] > points[b] ? a : b);
        console.log('Jogo terminado. Vencedor:', winner);
        io.to(roomName).emit('gameOver', {winner, points});
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
