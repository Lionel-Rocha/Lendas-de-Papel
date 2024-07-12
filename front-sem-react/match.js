let playerHand = [];

async function start_match() {
    //1. fetch deck
    //2. shuffle deck
    //3. give 5 cards to player

    if (window.ethereum) {
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);

            let signer = provider.getSigner();
            let address = signer.getAddress();
            const deck_contract = new ethers.Contract(DECK_ADDRESS, ABI_DECK.abi, signer);
            const booster_contract = new ethers.Contract(BOOSTER_ADDRESS, ABI_BOOSTER.abi, signer);

            let player_deck = await fetch_deck(deck_contract, booster_contract);
            let shuffled_deck = shuffle_deck(player_deck);

            [playerHand, shuffled_deck] = give_hand(shuffled_deck);

            show_deck_cards(shuffled_deck);
            let data = await fetch_card_data();
            show_hand(playerHand, data);


        } catch (e) {
            console.log('Error connecting...');
            console.log(e);
        }
    }


}


function give_hand(deck) {
    let hand = [];
    let updatedDeck = [...deck]; // Faz uma cópia do deck original

    for (let i = 0; i < 5; i++) {
        if (updatedDeck.length > 0) { // Verifica se ainda há cartas no deck
            let card = updatedDeck.shift(); // Remove a primeira carta do deck
            hand.push(card);
        } else {
            console.log("O deck não tem cartas suficientes.");
            break;
        }
    }

    return [hand, updatedDeck];
}

function show_hand(hand, data){
    let hand_div = document.getElementById("hand");
    for (let i  = 0; i < hand.length; i++){
        let card = document.createElement("div");
        card.className = 'card';

        let card_image = document.createElement("img");
        card_image.src = `/imagens/lendas/${hand[i].uri}.png`;
        let description = document.createElement("p");
        if (data) {
            const cartaEncontrada = data.cartas.find(carta => carta.nome === hand[i].uri);
            if (cartaEncontrada.propriedade === "item") {
                description.innerText = cartaEncontrada.habilidade;
            } else {
                description.innerText = `HP: ${cartaEncontrada.hp}\nAtaque: ${cartaEncontrada.ataque}`;
            }
        }


        card.appendChild(card_image);
        card.appendChild(description);
        hand_div.appendChild(card);

    }
}
async function fetch_deck(deck_contract, booster_contract) {
    try {
        let user_deck = await deck_contract.getDeck();
        await fetch_card_data();
        user_deck = await Promise.all(user_deck.map(async (tokenId) => {
            let card_id = parseInt(tokenId._hex);
            let card_uri = await booster_contract.tokenURI(card_id);
            return { id: card_id, uri: card_uri };
        }));

        return user_deck;
    } catch (error) {
        console.error('Error fetching deck:', error);
        return [];
    }
}

function show_deck_cards(deck) {
    const deckGrid = document.getElementById('deck-grid');
    deckGrid.innerHTML = ""; // Limpar exibição anterior

    if (deck.length > 0) {
        const cardContainer = document.createElement('div');
        cardContainer.classList.add('card-container');

        const cardImage = document.createElement('div');
        cardImage.classList.add('card-image');
        cardImage.style.background = "linear-gradient(45deg, #990033, #b3003b, #cc0044, #e6004d, #ff0055)";
        cardImage.style.width = "125px"; // Ajuste o tamanho conforme necessário
        cardImage.style.height = "200px"; // Ajuste o tamanho conforme necessário

        const remainingCards = document.createElement('p');
        remainingCards.innerText = `${deck.length} cartas`; // Atualize conforme necessário

        cardContainer.appendChild(cardImage);
        cardImage.appendChild(remainingCards);

        deckGrid.appendChild(cardContainer);
    }
}

function shuffle_deck(arr) {
    return arr
        .map((val) => ({ val, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ val }) => val);
}

start_match().then(() => {
    addDragAndDropListeners();
});
