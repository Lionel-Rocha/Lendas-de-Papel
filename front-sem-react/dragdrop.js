class ActiveCard {
    constructor(card, cardData) {
        this.card = card;
        this.hp = cardData.hp;
        this.attack = cardData.ataque;
        this.createCardElement();
    }

    createCardElement() {
        const activeCardArea = document.getElementById('active-card-area');
        activeCardArea.innerHTML = ""; // Limpar qualquer carta ativa anterior

        const cardContainer = document.createElement('div');
        cardContainer.classList.add('active-card');

        const cardImage = document.createElement('img');
        console.log(this.card);

        cardImage.src = `/imagens/lendas/${this.card.uri}.png`;

        const description = document.createElement('p');
        description.innerText = `HP: ${this.hp}\nAtaque: ${this.attack}`;

        cardContainer.appendChild(cardImage);
        cardContainer.appendChild(description);

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
    const cardIndex = event.dataTransfer.getData('text/plain');
    const hand = playerHand;

    const data = await fetch_card_data();
    const cardData = data.cartas.find(carta => carta.nome === hand[cardIndex].uri);

    console.log(cardData);
    // const cardData = hand.cartas[cardIndex];
    const card = hand[cardIndex];
    const activeCard = new ActiveCard(card, cardData);

}