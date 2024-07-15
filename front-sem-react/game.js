/*TODO: garantir que o jogador não pode trocar a lenda ativa até que ela morra, a não ser que o
item "Papel" seja utilizado, adicionar evento de morte de lenda (+1 ponto para o jogador inimigo)
*/

const socket = io("http://localhost:3000");


socket.on('connect', () => {
    console.log('Connected to server:', socket.id);
});

socket.on('matchFound', (roomName) => {
    console.log('Match found, room:', roomName);
    sessionStorage.setItem('roomName', roomName);  // Armazenar o nome da sala na sessionStorage

    window.location.href = `match.html?roomId=${roomName}`;

});

socket.on('enemyCardChosen', ({ card, roomName }) => {
    const storedRoomName = sessionStorage.getItem('roomName');
    if (roomName === storedRoomName) {
        displayEnemyCard(card);
    }
});

socket.on('enemyCardUpdated', ({card, roomName}) => {

    const storedRoomName = sessionStorage.getItem('roomName');
    if (roomName === storedRoomName) {
        console.log(card);
        updateEnemyCard(card);
    }
});

socket.on('startGame', (roomName) => {
    const storedRoomName = sessionStorage.getItem('roomName');
    if (roomName === storedRoomName) {
        console.log("O jogo começou na sala:", roomName);
    }

});

socket.on('hand_changes', async (deckdata) => {
    let hand = deckdata.hand;
    let updated_deck = deckdata.deck;

    // Criar uma instância única do provider e do contrato
    const provider = new ethers.providers.JsonRpcProvider("https://rpc.testnet.lachain.network");
    const contract = new ethers.Contract(BOOSTER_ADDRESS, ABI_BOOSTER.abi, provider);

    // Função para obter URI do cartão
    async function gets_card_uri_without_contract(id) {
        return await contract.tokenURI(id);
    }

    // Obter URIs das cartas na mão e no deck em paralelo
    const handPromises = hand.map(id => gets_card_uri_without_contract(id).then(uri => ({ id, uri })));
    const deckPromises = updated_deck.map(id => gets_card_uri_without_contract(id).then(uri => ({ id, uri })));

    hand = await Promise.all(handPromises);
    updated_deck = await Promise.all(deckPromises);

    // Garantir que estamos obtendo os dados das cartas corretamente
    let data = await fetch_card_data();

    // Atualizar a mão no cliente
    const handArea = document.getElementById('hand');
    handArea.innerHTML = ""; // Limpar a mão atual

    // Adicionar as novas cartas na mão
    for (let card of hand) {
        // Procurar os dados da carta no objeto 'data'
        const cardDataItem = data.cartas.find(carta => carta.nome === card.uri);
        if (!cardDataItem) {
            console.error(`Card data not found for URI: ${card.uri}`);
            continue;
        }

        const cardElement = document.createElement('div');
        cardElement.classList.add('card');

        const cardImage = document.createElement('img');
        cardImage.src = `/imagens/lendas/${card.uri}.png`;

        const cardDescription = document.createElement('p');

        if (cardDataItem.hp === 0 || cardDataItem.ataque === 0){
            cardDescription.innerText = cardDataItem.habilidade;
        } else {
            cardDescription.innerText = `HP: ${cardDataItem.hp}\nAtaque: ${cardDataItem.ataque}`;
        }



        cardElement.appendChild(cardImage);
        cardElement.appendChild(cardDescription);
        handArea.appendChild(cardElement);
        addDragAndDropListeners();
    }
});


socket.on('hand_deck_shuffled', async (deckdata) => {
    console.log("estou lento!");
    let playerHand_ = deckdata.hand;
    let updated_deck = deckdata.updated_deck;

    // Criar uma instância única do provider e do contrato
    const provider = new ethers.providers.JsonRpcProvider("https://rpc.testnet.lachain.network");
    const contract = new ethers.Contract(BOOSTER_ADDRESS, ABI_BOOSTER.abi, provider);

    // Função para obter URI do cartão
    async function gets_card_uri_without_contract(id) {
        return await contract.tokenURI(id);
    }

    console.log(updated_deck);

    // Obter URIs das cartas na mão e no deck em paralelo
    const handPromises = playerHand_.map(id => gets_card_uri_without_contract(id).then(uri => ({ id, uri })));
    const deckPromises = updated_deck.map(id => gets_card_uri_without_contract(id).then(uri => ({ id, uri })));

    // Processar as promessas em paralelo
    playerHand_ = await Promise.all(handPromises);
    updated_deck = await Promise.all(deckPromises);

    console.log(playerHand_);
    console.log(updated_deck);

    playerHand = playerHand_;

    show_deck_cards(updated_deck);
    let data = await fetch_card_data();
    show_hand(playerHand_, data);
});





socket.on('turnStarted', (roomName, playerId) => {
    const storedRoomName = sessionStorage.getItem('roomName');
    console.log(playerId);
    if (roomName === storedRoomName){
        console.log(`É a vez do jogador ${playerId}`);
        const currentPlayerId = socket.id;
        if (playerId === currentPlayerId) {
            is_player_turn = true;
            console.log("Sua vez de jogar!");
            showAttackButton();
        } else {
            is_player_turn = false;
            console.log("Aguarde a vez do seu oponente.");
            hideAttackButton();
        }
    }
});

socket.on('reduceHP', (data) => {
    const { amount } = data;
    reduceHP(amount);
});

socket.on('reduceEnemyHP', (data) => {
    console.log(data);
    updateEnemyCard(data.card);
});

socket.on('drawCard', async (card) => {

    let card_information = await gets_card_uri_without_contract(card);
    card_information = {uri: card_information};
    playerHand.push(card_information);
    console.log(`Carta recebida: ${card_information}`);
    updateHandDisplay();
    // show_deck_cards(playerdeck);
});


socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

function showAttackButton() {
    const attackButton = document.getElementById('attack-button');
    if(attackButton){
        attackButton.style.display = 'block';
        attackButton.addEventListener('click', handleAttack);
    }

}

function hideAttackButton() {
    const attackButton = document.getElementById('attack-button');
    attackButton.style.display = 'none';
    attackButton.removeEventListener('click', handleAttack);
}

function handleAttack() {
    if (activeCardInstance) {

        const roomName = sessionStorage.getItem('roomName');
        console.log(roomName);
        const attackPower = activeCardInstance.attack;
        socket.emit('attack', { roomName, attackPower });

    }
}



async function findMatch() {
    try {
        let response = await deck_exists();

        if (response.includes("Error")){
            document.getElementById("status").innerText = "Você não tem um deck para jogar.";
        } else {
            const statusDiv = document.getElementById('status');
            statusDiv.innerText = 'Procurando uma partida...';
            socket.emit('findMatch');
        }
    } catch (error) {
        console.error('Error finding match:', error);
    }
}

function chooseCard(card) {
    const roomName = sessionStorage.getItem('roomName');
    if (!roomName) {
        alert("You are not in a room yet. Please wait for a match.");
        return;
    }

    let is_legend = check_if_card_is_legend(card);
    if (is_legend){
        const data = { roomName: roomName, card: card };
        socket.emit('chooseCard', data);
        displayActiveCard(card);
    } else {
        //lógica para botar o card de volta na mão
    }
}

async function displayEnemyCard(card) {
    document.getElementById("enemy-card-area").innerText = ""
    let data = await fetch_card_data();
    create_enemy_card(card, data)

}

function displayActiveCard(card) {
    const activeCardArea = document.getElementById('active-card-area');
    activeCardArea.innerText = card.uri;
}

function create_enemy_card(card, data){
    const card_div = document.createElement('div');
    card_div.className = "card";

    const card_front = document.createElement('div');
    card_front.className = "card";

    const card_image = document.createElement("img");
    card_image.src = `/imagens/lendas/${card.uri}.png`;
    card_front.appendChild(card_image);

    card_div.appendChild(card_front);

    const description = document.createElement("p");
    description.id = "enemy-description";
    if (data) {
        const cartaEncontrada = data.cartas.find(carta => carta.nome === card.uri);
        if (cartaEncontrada.propriedade === "item") {
            description.innerText = cartaEncontrada.habilidade;
        } else {
            description.innerText = `HP: ${cartaEncontrada.hp}\nAtaque: ${cartaEncontrada.ataque}`;
        }
    }
    card_front.appendChild(description);
    document.getElementById("enemy-card-area").appendChild(card_front);
}

function item_chosen(updated_card){
    let roomName = sessionStorage.getItem('roomName');
    console.log(updated_card);
    let hp = updated_card.hp;
    let attack = updated_card.attack;
    let item = updated_card.itens.itemData[2];
    let card = {hp, attack, uri: item};

    socket.emit('item_chosen', {card, roomName});
}

function quit(){
    document.getElementById("quit-banner").style.visibility="visible";
}

function not_quit(){
    document.getElementById("quit-banner").style.visibility="hidden";
}
