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

        } catch (e) {
            console.log('Error connecting...');
            console.log(e);
        }
    }


}

async function fetch_deck(contract, address){
    let user_deck = await contract.getDeck();

}