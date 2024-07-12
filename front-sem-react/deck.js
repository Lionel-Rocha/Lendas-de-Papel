async function get_user_cards() {
    if (!window.ethereum) {
        alert("Provider not connected");
        return [];
    }

    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);

        const signer = provider.getSigner();
        const contract = new ethers.Contract(BOOSTER_ADDRESS, ABI_BOOSTER.abi, signer);
        const address = await signer.getAddress();
        return await contract.getTokensByAddress(address);
    } catch (error) {
        console.log('Error connecting...');
        console.log(error);
        return [];
    }
}

async function fetch_card_data() {
    const response = await fetch('Lendas.json');
    return response.json();
}

async function display_cards() {
    const cards_display = document.getElementById("deck_display");
    cards_display.style.visibility = "visible";
    cards_display.innerHTML = ""; // Limpar exibição anterior

    try {
        // const [cards, data] = await Promise.all([get_user_cards(), fetch_card_data()]);
        let data = await fetch_card_data();
        let cards = await get_user_cards();
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const booster_contract = new ethers.Contract(BOOSTER_ADDRESS, ABI_BOOSTER.abi, signer);

        const deck_contract = new ethers.Contract(DECK_ADDRESS, ABI_DECK.abi, signer);

        const user_deck = await deck_contract.getDeck();

        const deckIds = user_deck.map(card => parseInt(card._hex));

        const deck_cards = [];
        const available_cards = [];

        for (let i = 0; i < cards.length; i++){
            let card_id = parseInt(cards[i]);

            let card_uri = await booster_contract.tokenURI(card_id);

            let card_completo = {id: card_id, uri: card_uri}

            if (deckIds.includes(card_id)){
                deck_cards.push(card_completo);
            } else {
                available_cards.push(card_completo);
            }
        }

        render_deck(deck_cards, data, true);
        render_available_cards(available_cards, data, false);
    } catch (error) {
        console.error('Error displaying cards:', error);
    }
}

async function deck_manager() {
    if (!window.ethereum) {
        alert("Provider not connected");
        return;
    }

    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);

        const signer = provider.getSigner();
        const deck_contract = new ethers.Contract(DECK_ADDRESS, ABI_DECK.abi, signer);
        const booster_contract = new ethers.Contract(BOOSTER_ADDRESS, ABI_BOOSTER.abi, signer);

        const address = await signer.getAddress();

        // Verificar se o usuário já possui um deck
        try {
            const user_deck = await deck_contract.getDeck();
            await display_cards(); // Exibir as cartas após verificar o deck existente

            console.log("User already has a deck, displaying existing deck...");
        } catch (error) {
            if (error.message.includes("execution reverted: Deck already exists")) {
                console.log("User already has a deck, displaying existing deck...");
            } else {
                console.error("Error fetching user deck:", error);
            }
        }

        // Se o usuário não tiver um deck, criar um novo com as cartas disponíveis
        if (!user_deck || user_deck.length === 0) {
            await create_deck_with_available_cards(deck_contract, booster_contract, address);
        }

    } catch (error) {
        console.log('Error connecting...');
        console.log(error);
    }
}

async function create_deck_with_available_cards(deck_contract, booster_contract, address) {
    try {
        const user_cards = await booster_contract.getTokensByAddress(address);
        const cardIds = user_cards.slice(0, 20).map(card => parseInt(card._hex)); // Pegar até 20 cartas

        if (cardIds.length === 20) { // Assegurar que existem exatamente 20 cartas
            const createDeckTx = await deck_contract.createDeck(cardIds);
            await createDeckTx.wait(); // Esperar a transação ser minerada

            console.log('Deck created:', createDeckTx);
            await display_cards(); // Exibir as cartas após criar o deck
        } else {
            console.error('Not enough cards to create a deck. A deck must contain exactly 20 cards.');
        }
    } catch (error) {
        console.error('Error creating deck with available cards:', error);
    }
}

async function remove_card_from_deck(cardId) {
    console.log(cardId);
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const deck_contract = new ethers.Contract(DECK_ADDRESS, ABI_DECK.abi, signer);
        await deck_contract.removeCardFromDeck(cardId);
        await display_cards(); // Atualizar a exibição após remover a carta do deck
    } catch (error) {
        console.error('Error removing card from deck:', error);
    }
}

async function add_card_to_deck(cardId) {
    try {
        const provider = new ethers.providers.Web3Provider(window.ethereum);
        const signer = provider.getSigner();
        const deck_contract = new ethers.Contract(DECK_ADDRESS, ABI_DECK.abi, signer);
        await deck_contract.addCardToDeck(cardId);
        await display_cards(); // Atualizar a exibição após adicionar a carta ao deck
    } catch (error) {
        console.error('Error adding card to deck:', error);
    }
}

function render_deck(cards, data, isInDeck) {
    const deck_display = document.getElementById("deck_display");
    deck_display.style.visibility = "visible";
    deck_display.innerHTML = ""; // Limpar exibição anterior

    cards.forEach(card => {
        const card_element = create_card_element(card, data, isInDeck);
        deck_display.appendChild(card_element);
    });
}

function render_available_cards(cards, data, isInDeck) {
    const available_cards_display = document.getElementById("available_cards_display");
    available_cards_display.style.visibility = "visible";
    available_cards_display.innerHTML = ""; // Limpar exibição anterior

    cards.forEach(card => {
        const card_element = create_card_element(card, data, isInDeck);
        available_cards_display.appendChild(card_element);
    });
}

function create_card_element(card, data, isInDeck) {
    const card_div = document.createElement('div');
    card_div.className = "card";

    // Conteúdo frontal do card (visível por padrão)
    const card_front = document.createElement('div');
    card_front.className = "card-front";

    const card_name = document.createElement("h3");
    card_name.innerText = card.uri === 'Coracao' ? 'Coração' : card.uri;
    card_front.appendChild(card_name);

    const card_image = document.createElement("img");
    card_image.src = `/imagens/lendas/${card.uri}.png`;
    card_front.appendChild(card_image);

    card_div.appendChild(card_front);

    // Conteúdo traseiro do card (oculto inicialmente)
    const card_back = document.createElement('div');
    card_back.className = "card-back";
    card_back.style.display = "none";

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

    const flip_button = document.createElement("button");
    flip_button.className = "flip-button";
    flip_button.innerText = isInDeck ? "Remover do Deck" : "Adicionar ao Deck";
    flip_button.onclick = async (event) => {
        event.stopPropagation(); // Impedir a propagação do clique para o card_div
        if (isInDeck) {
            await remove_card_from_deck(card.id);
        } else {
            await add_card_to_deck(card.id);
        }
    };
    card_back.appendChild(flip_button);

    card_div.appendChild(card_back);

    // Adicionar evento de clique para o flip
    card_div.addEventListener('click', () => {
        card_div.classList.toggle('flipped');
        if (card_front.style.display === "none") {
            card_front.style.display = "block";
            card_back.style.display = "none";
        } else {
            card_front.style.display = "none";
            card_back.style.display = "block";
        }
    });

    return card_div;
}

// Inicializar o gerenciamento de deck

