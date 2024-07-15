// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract OrigamiCards is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;

    uint256 public boosterPackPrice = 0.05 ether;

    event BoosterPackPurchased(address buyer, uint256[] tokenIds);
    event TokenMinted(address owner, uint256 tokenId, string tokenName);

    mapping(address => uint256[]) private addressToTokens;

    string[] private cardNames;

    constructor() ERC721("OrigamiCards", "OGC") Ownable (msg.sender) {
        cardNames.push("Baleia");
        cardNames.push("Beija-flor");
        cardNames.push("Borboleta");
        cardNames.push("Caranguejo");
        cardNames.push("Elefante");
        cardNames.push("Esquilo");
        cardNames.push("Girafa");
        cardNames.push("Grou");
        cardNames.push("Raposa");
        cardNames.push("Urso");
        cardNames.push("Catavento");
        cardNames.push("Coracao");
        cardNames.push("Dobradura");
        cardNames.push("Tesoura");
        cardNames.push("Catavento");
        cardNames.push("Coracao");
        cardNames.push("Dobradura");
        cardNames.push("Tesoura");
        
    }

    function buyBoosterPack() external payable {
        require(msg.value == boosterPackPrice, "Incorrect payment amount");

        uint256[] memory newTokenIds = new uint256[](5); // Cada booster pack contém 5 cartas
        for (uint256 i = 0; i < 5; i++) {
            _tokenIds.increment();
            uint256 newItemId = _tokenIds.current();
            _mint(msg.sender, newItemId);
            string memory tokenName = _getRandomCardName();
            _setTokenURI(newItemId, tokenName);
            newTokenIds[i] = newItemId;

            addressToTokens[msg.sender].push(newItemId);

            emit TokenMinted(msg.sender, newItemId, tokenName); // Emitir evento para cada token mintado
        }

        emit BoosterPackPurchased(msg.sender, newTokenIds);
    }

    function _getRandomCardName() internal view returns (string memory) {
        uint256 randomIndex = uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, _tokenIds.current()))) % cardNames.length;
        return cardNames[randomIndex];
    }

    function getTokensByAddress(address _address) external view returns (uint256[] memory) {
        return addressToTokens[_address];
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
