let activeCardInstance = null;
let is_player_turn = true;
class ActiveCard {
    constructor(card, cardData) {
        this.card = card;
        this.hp = cardData.hp;
        this.attack = cardData.ataque;
        this.createCardElement();
    }

    createCardElement() {

            chooseCard(this.card);
            const activeCardArea = document.getElementById('active-card-area');

            activeCardArea.innerHTML = "";

            const cardContainer = document.createElement('div');
            cardContainer.classList.add('active-card');

            const cardImage = document.createElement('img');

            cardImage.src = `/imagens/lendas/${this.card.uri}.png`;

            const description = document.createElement('p');
            description.innerText = `HP: ${this.hp}\nAtaque: ${this.attack}`;

            cardContainer.appendChild(cardImage);
            cardContainer.appendChild(description);
            cardContainer.className = "card";
            activeCardArea.appendChild(cardContainer);
    }

    reduceHP(amount) {
        this.hp -= amount;
        this.updateCardElement();
        if (this.hp <= 0) {
            console.log('Card defeated!');
        }
    }

    updateCardElement() {
        const activeCardArea = document.getElementById('active-card-area');
        const description = activeCardArea.querySelector('p');
        description.innerText = `HP: ${this.hp}\nAtaque: ${this.attack}`;
    }
}

function addDragAndDropListeners() {
    const handCards = document.querySelectorAll('.card');
    const activeCardArea = document.getElementById('active-card-area');

    handCards.forEach(card => {
        card.setAttribute('draggable', true);
        card.addEventListener('dragstart', handleDragStart);
    });

    activeCardArea.addEventListener('dragover', handleDragOver);
    activeCardArea.addEventListener('drop', handleDrop);


}

function handleDragStart(event) {
    const cardIndex = Array.from(event.target.parentNode.children).indexOf(event.target);
    event.dataTransfer.setData('text/plain', cardIndex);
}

function handleDragOver(event) {
    event.preventDefault();
}

function reduceHP(amount){
    if (activeCardInstance) {
        activeCardInstance.reduceHP(amount);

    }
}

socket.on('reduceHP', (data) => {
    const { amount } = data;
    reduceEnemyHP(amount);
});

function reduceEnemyHP(amount) {
    const enemyCardArea = document.getElementById('enemy-card-area');
    const enemyDescription = enemyCardArea.querySelector('p');

    if (enemyDescription) {
        let enemyHP = parseInt(enemyDescription.innerText.split('HP: ')[1].split('\n')[0]);
        enemyHP -= amount;
        enemyDescription.innerText = `HP: ${enemyHP}\n${enemyDescription.innerText.split('\n')[1]}`;

        if (enemyHP <= 0) {
            console.log('Carta do oponente derrotada!');
        }
    }
}


function getItemData(itemUri, data) {
    let informacao = data.cartas.find(carta => carta.nome === itemUri);
    return informacao;
}

function addAttributesToActiveCard(itemData) {
    if (!activeCardInstance) return;

    if (!Array.isArray(itemData) || itemData.length < 2 || typeof itemData[0] !== 'number' || typeof itemData[1] !== 'number') {
        console.error('Dados inválidos para o item:', itemData);
        return;
    }

    activeCardInstance.attack += itemData[0];
    activeCardInstance.hp += itemData[1];

    let hp = itemData[1];
    let attack = itemData[0];
    let card = { id: activeCardInstance.card.id, uri: activeCardInstance.card.uri, itens: {itemData}, hp, attack };

    if (activeCardInstance.card.uri === "Papel") {
        trocarLenda();
    }

    item_chosen(card);
    activeCardInstance.updateCardElement();
}

async function trocarLenda() {
    const data = await fetch_card_data();

    let novaLendaIndex;
    do {
        novaLendaIndex = prompt("Selecione o índice da nova lenda da sua mão:");
        novaLendaIndex = parseInt(novaLendaIndex);

        if (isNaN(novaLendaIndex) || novaLendaIndex < 0 || novaLendaIndex >= playerHand.length) {
            alert("Índice inválido. Tente novamente.");
            novaLendaIndex = null;
        }
    } while (novaLendaIndex === null);

    const novaLenda = playerHand[novaLendaIndex];

    const cardData = data.cartas.find(carta => carta.nome === novaLenda.uri);
    activeCardInstance = new ActiveCard(novaLenda, cardData);

    playerHand.splice(novaLendaIndex, 1);
    playerHand.push({ id: activeCardInstance.card.id, uri: activeCardInstance.card.uri });

    await updateHandDisplay(data);
}



async function handleDrop(event) {
    event.preventDefault();
    if (is_player_turn) {
        const cardIndex = event.dataTransfer.getData('text/plain');
        const hand = playerHand;
        const data = await fetch_card_data();


        const card = hand[cardIndex];

        console.log(card);

        const cardData = data.cartas.find(carta => carta.nome === card.uri);

        console.log(cardData);

        const isLegend = await check_if_card_is_legend(card);

        if (!isLegend && activeCardInstance) {
            console.log(card.uri);
            let informacao = getItemData(card.uri, data);
            let atk = informacao.ataque;
            let hp = informacao.hp;
            const itemData = [atk, hp, card.uri];

            addAttributesToActiveCard(itemData);

            playerHand.splice(parseInt(cardIndex), 1);
            await updateHandDisplay(data);
        } else if (!activeCardInstance) {
            if (cardData) {
                playerHand.splice(parseInt(cardIndex), 1);
                await updateHandDisplay(data);
                activeCardInstance = new ActiveCard(card, cardData);
            }
        } else {
            alert("tentou");
        }

    } else {
        alert("Aguarde sua vez de jogar.");
    }
}
