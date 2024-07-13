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


socket.on('disconnect', () => {
    console.log('Disconnected from server');
});

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
    const data = { roomName: roomName, card: card };
    socket.emit('chooseCard', data);
    displayActiveCard(card);
}


async function displayEnemyCard(card) {
    document.getElementById("enemy-card-area").innerText = ""
    let data = await fetch_card_data();
    create_card(card, data)

}

function displayActiveCard(card) {
    const activeCardArea = document.getElementById('active-card-area');
    activeCardArea.innerText = card.uri;
}

function create_card(card, data){
    const card_div = document.createElement('div');
    card_div.className = "card";

    const card_front = document.createElement('div');
    card_front.className = "card";

    const card_image = document.createElement("img");
    card_image.src = `/imagens/lendas/${card.uri}.png`;
    card_front.appendChild(card_image);

    card_div.appendChild(card_front);

    const description = document.createElement("p");
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

function quit(){
    document.getElementById("quit-banner").style.visibility="visible";
}

function not_quit(){
    document.getElementById("quit-banner").style.visibility="hidden";
}
