async function get_booster() {
    if (window.ethereum) {
        try {
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            await provider.send("eth_requestAccounts", []);

            let signer = provider.getSigner()
            const contract = new ethers.Contract(BOOSTER_ADDRESS, ABI_BOOSTER.abi, signer);

            const boosterPackPrice = ethers.utils.parseEther('0.05');

            const overrides = {
                value: boosterPackPrice // Envia o valor necessário para a função payable
            };

            const transaction = await contract.buyBoosterPack(overrides);
            await transaction.wait();

            console.log('Booster pack purchased successfully.');

        } catch (error) {
            console.log('Error connecting...');
            console.log(error);
        }
    }
}