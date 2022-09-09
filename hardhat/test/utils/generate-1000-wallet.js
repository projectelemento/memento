const ethers = require('ethers')
const generateWallet = (howMany) => {
    const wallets = []
    for (let index = 0; index < howMany; index++) {
        const wallet = ethers.Wallet.createRandom()
        wallets.push(wallet.address)
    }
    return wallets;
}

module.exports = {
    generateWallet,
}