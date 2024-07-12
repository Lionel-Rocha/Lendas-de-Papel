// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract DeckManager {
    IERC721 public origamiCards;

    struct Deck {
        uint256[] cards;
    }

    mapping(address => Deck) private decks;

    event DeckCreated(address indexed user, uint256[] cards);
    event CardAdded(address indexed user, uint256 cardId);
    event CardRemoved(address indexed user, uint256 cardId);

    constructor(address _origamiCardsAddress) {
        origamiCards = IERC721(_origamiCardsAddress);
    }

    modifier ownsCard(uint256 cardId) {
        require(origamiCards.ownerOf(cardId) == msg.sender, "You don't own this card");
        _;
    }

    modifier deckExists() {
        require(decks[msg.sender].cards.length > 0, "Deck does not exist");
        _;
    }

    function createDeck(uint256[] memory cardIds) external {
        require(cardIds.length == 20, "A deck must contain exactly 20 cards");
        require(decks[msg.sender].cards.length == 0, "Deck already exists");

        for (uint256 i = 0; i < cardIds.length; i++) {
            require(origamiCards.ownerOf(cardIds[i]) == msg.sender, "You don't own one of these cards");
        }

        decks[msg.sender] = Deck({cards: cardIds});
        emit DeckCreated(msg.sender, cardIds);
    }

    function addCardToDeck(uint256 cardId) external ownsCard(cardId) deckExists {
        require(decks[msg.sender].cards.length < 20, "Deck is already full");

        decks[msg.sender].cards.push(cardId);
        emit CardAdded(msg.sender, cardId);
    }

    function removeCardFromDeck(uint256 cardId) external deckExists {
        uint256 cardIndex = getCardIndex(cardId);
        require(cardIndex < 20, "Card not found in deck");

        decks[msg.sender].cards[cardIndex] = decks[msg.sender].cards[decks[msg.sender].cards.length - 1];
        decks[msg.sender].cards.pop();
        emit CardRemoved(msg.sender, cardId);
    }

    function getDeck() external view deckExists returns (uint256[] memory) {
        return decks[msg.sender].cards;
    }

    function isCardInDeck(uint256 cardId) public view returns (bool) {
        uint256[] memory userDeck = decks[msg.sender].cards;

        for (uint256 i = 0; i < userDeck.length; i++) {
            if (userDeck[i] == cardId) {
                return true;
            }
        }
        return false;
    }

    function getCardIndex(uint256 cardId) internal view returns (uint256) {
        uint256[] memory userDeck = decks[msg.sender].cards;

        for (uint256 i = 0; i < userDeck.length; i++) {
            if (userDeck[i] == cardId) {
                return i;
            }
        }
        revert("Card not found in deck");
    }
}
