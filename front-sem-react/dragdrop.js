let activeCardInstance = null; // Variável global para armazenar a instância ativa da carta
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

            activeCardArea.innerHTML = ""; // Limpar qualquer carta ativa anterior

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

async function handleDrop(event) {

    event.preventDefault();
    if (is_player_turn){
        const cardIndex = event.dataTransfer.getData('text/plain');
        const hand = playerHand;
        const data = await fetch_card_data();

        const card = hand[cardIndex];
        const isLegend = await check_if_card_is_legend(card);

        if (isLegend === false && activeCardInstance) {
            const itemId = cardIndex;



            let informacao = getItemData(card.uri, data);
            let atk = informacao.ataque;
            let hp = informacao.hp;
            const itemData = [atk, hp]
            addAttributesToActiveCard(itemData);

            playerHand.splice(parseInt(cardIndex), 1);
            await updateHandDisplay(data);

        } else {

            const cardData = data.cartas.find(carta => carta.nome === hand[cardIndex].uri);


            let result = await check_if_card_is_legend(card);
            if (result) {
                playerHand.splice(parseInt(cardIndex), 1);
                await updateHandDisplay(data);
                activeCardInstance = new ActiveCard(card, cardData);
            }
        }
    } else {
        alert("Aguarde sua vez de jogar.");
    }

}


function reduceHP(amount){
    if (activeCardInstance) {
        activeCardInstance.reduceHP(amount); // Reduz o HP da carta ativa em 10 (ou qualquer valor desejado)

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

    activeCardInstance.attack += itemData[0];
    activeCardInstance.hp += itemData[1];

    let hp = itemData[1];
    let attack = itemData[0];
    let card = {hp, attack};
    item_chosen(card);

    activeCardInstance.updateCardElement();
}
