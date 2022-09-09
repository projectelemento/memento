const { expect, assert } = require("chai");
const { ethers, network } = require("hardhat");

const ELEMENTO_MEMENTO__BASE_URI = 'https://mock.fiverlabs.xyz/api/mock/mm2-1/'

const debug = (...args) => console.log('debug>>>>', args)
const log = debug;

const { generateWallet } = require('./utils/generate-1000-wallet')
const forwardInSeconds = (seconds) => {
    return Math.floor(+new Date()/1000) + seconds;
}

const signMessage = async (message, wallet) => {
    const messageHash = ethers.utils.id(message);
    const hashBytes = ethers.utils.arrayify(messageHash)
    const signature = await wallet.signMessage(hashBytes)
    const sig = ethers.utils.splitSignature(signature)

    // debug({sig, messageHash})
    return {
        sig,
        messageHash
    }
}

const expectError = (error, expectedMessage, messageLength = 32) => {
    expect(expectedMessage.split('').length).to.be.lessThanOrEqual(messageLength)
    expect(error.message).contains(expectedMessage)
}

const FIVE_MINUTES = forwardInSeconds(60*5);

describe("Project Elemento - Memento", () => {
    let contract_Memento;
    let contract_erc20;
    let contract_erc721;
    let contract_erc1155;

    beforeEach(async() => {
        [deployer, operator, anon, user1, user2, user3, user4, user5] = await ethers.getSigners();
        const ProjectElementoMemento = await ethers.getContractFactory("ProjectElementoMemento");

        const ToyERC20 = await ethers.getContractFactory("ToyERC20");
        const ToyERC721 = await ethers.getContractFactory("ToyERC721");
        const ToyERC1155 = await ethers.getContractFactory("ToyERC1155");

        contract_erc20 = await ToyERC20.deploy()
        contract_erc721 = await ToyERC721.deploy()
        contract_erc1155 = await ToyERC1155.deploy()

        contract_Memento = await ProjectElementoMemento.deploy(
            ELEMENTO_MEMENTO__BASE_URI
        )

        await contract_Memento.deployed()
        await contract_erc20.deployed()
        await contract_erc721.deployed()
        await contract_erc1155.deployed()
    })

    describe("Contract Safety", () => {
        it("should withdraw ether", async () => {
            expect(+await ethers.provider.getBalance(contract_Memento.address)).to.be.eq(0)
            await deployer.sendTransaction({
                to: contract_Memento.address,
                value: ethers.utils.parseEther("10"),
                gasLimit: 1_000_000
            })

            const mementoBalance = await ethers.provider.getBalance(contract_Memento.address)
            expect(+mementoBalance).to.be.eq(10000000000000000000)

            await contract_Memento.connect(deployer).withdraw()
        })

        it("should withdraw erc20", async () => {
            await contract_erc20
            .connect(deployer)
            .transfer(contract_Memento.address, 1234)

            expect(+await contract_erc20.balanceOf(contract_Memento.address)).to.be.eq(1234)

            await contract_Memento
            .connect(deployer)
            .withdrawErc20(contract_erc20.address)

            expect(+await contract_erc20.balanceOf(contract_Memento.address)).to.be.eq(0)
        })
        it("erc721: throw error on safeTransferFrom", async () => {
            try {
                await contract_erc721
                .connect(deployer)
                ['safeTransferFrom(address,address,uint256)'](deployer.address, contract_Memento.address, 1)
            } catch (error) {
                expectError(error, 'Transaction reverted: function returned an unexpected amount of data', 100)
            }
        })
        it("should be able to accept and withdraw erc721 using `transferFrom`", async () => {
            await contract_erc721
            .connect(deployer)
            .transferFrom(deployer.address, contract_Memento.address, 1)

            expect(+await contract_erc721.balanceOf(contract_Memento.address)).to.be.eq(1)

            await contract_Memento
            .connect(deployer)
            .withdrawErc721(contract_erc721.address, 1)

            expect(+await contract_erc721.balanceOf(contract_Memento.address)).to.be.eq(0)

        })
    })

    describe("Regular ERC1155", () => {
        it("should deploy", async () => {
            expect(contract_Memento)
        })

        it("admin account should mint", async () => {
            await contract_Memento
            .connect(deployer)
            .AdminMint(1000)

            const txRes = await contract_Memento
            .connect(anon)
            .balanceOf(deployer.address, 1)
            expect(txRes).to.be.eq(1000)
        })
        it("admin operator should mint", async () => {
            await contract_Memento
            .connect(deployer)
            .addAllowedMinter(operator.address)

            await contract_Memento
            .connect(operator)
            .AdminMint(1000)

            const txRes = await contract_Memento
            .connect(anon)
            .balanceOf(operator.address, 1)
            expect(txRes).to.be.eq(1000)
        })
        it("mint to another address", async () => {
            await contract_Memento
            .connect(deployer)
            .addAllowedMinter(operator.address)

            await contract_Memento
            .connect(operator)
            .AdminMintTo(user1.address, 1000)

            const txRes = await contract_Memento
            .connect(anon)
            .balanceOf(user1.address, 1)
            expect(txRes).to.be.eq(1000)
        })
        it("add supply to existing token ID", async () => {
            await contract_Memento
            .connect(deployer)
            .addAllowedMinter(operator.address)

            await contract_Memento
            .connect(operator)
            .AdminMint(12)

            await contract_Memento
            .connect(operator)
            .AdminAddSupply(1, 13)

            const txRes = await contract_Memento
            .connect(anon)
            .balanceOf(operator.address, 1)
            expect(txRes).to.be.eq(25)
        })
        it("add supply to existing token ID to address", async () => {
            await contract_Memento
            .connect(deployer)
            .addAllowedMinter(operator.address)

            await contract_Memento
            .connect(operator)
            .AdminMintTo(user1.address, 10)

            await contract_Memento
            .connect(operator)
            .AdminAddSupplyTo(user1.address, 1, 3)

            const txRes = await contract_Memento
            .connect(anon)
            .balanceOf(user1.address, 1)
            expect(txRes).to.be.eq(13)
        })
        it("get uri", async () => {
            await contract_Memento
            .connect(deployer)
            .addAllowedMinter(operator.address)

            await contract_Memento
            .connect(operator)
            .AdminMintTo(user1.address, 1000)

            const txRes = await contract_Memento
            .connect(anon)
            .uri(1)
            expect(txRes).to.be.eq(`${ELEMENTO_MEMENTO__BASE_URI}1`)
        })
        it("transfer by batch", async() => {
            await contract_Memento
            .connect(deployer)
            .addAllowedMinter(operator.address)

            await contract_Memento
            .connect(operator)
            .AdminMint(1000)

            const thousandWallets = generateWallet(500)
            await contract_Memento
            .connect(operator)
            .AdminBatchTransfer(thousandWallets, 1)

            const txRes = await contract_Memento
            .connect(anon)
            .balanceOf(operator.address, 1)
            expect(txRes).to.be.eq(500)
        })
    })

    describe("POAP ERC1155", () => {
        it("should mint poap", async () => {
            await contract_Memento
            .connect(deployer)
            .AdminMintPOAP(50, "code-is-here", FIVE_MINUTES)
            const txRes = await contract_Memento
            .connect(anon)
            .balanceOf(contract_Memento.address, 1)
            expect(txRes).to.be.eq(50)
        })
        it("should claim poap", async () => {
            await contract_Memento
            .connect(deployer)
            .AdminMintPOAP(50, "code-is-here", FIVE_MINUTES)

            const { sig, messageHash } = await signMessage('code-is-here', user1)
            await contract_Memento
            .connect(user1)
            .claimMemento(1, 'code-is-here', messageHash, sig.v, sig.r, sig.s)

            const txRes = await contract_Memento
            .connect(anon)
            .balanceOf(user1.address, 1)
            expect(txRes).to.be.eq(1)
            // process.exit()
        })
        it("should not claim poap wrong code", async () => {
            await contract_Memento
            .connect(deployer)
            .AdminMintPOAP(50, "code-is-here", FIVE_MINUTES)
            try {
                const { sig, messageHash } = await signMessage('code-is-x', user1)
                await contract_Memento
                .connect(user1)
                .claimMemento(1, 'code-is-x', messageHash, sig.v, sig.r, sig.s)
            } catch (error) {
                
                expectError(error, 'Code is not correct.')
            }
        })
        it("should not claim a regular memento", async () => {
            await contract_Memento
            .connect(deployer)
            .AdminMint(50)
            try {
                const { sig, messageHash } = await signMessage('code-is-here', user1)
                await contract_Memento
                .connect(user1)
                .claimMemento(1, 'code-is-x', messageHash, sig.v, sig.r, sig.s)
            } catch (error) {
                expectError(error, 'Token is not POAP')
            }
        })
        it("should not claim more than 1 POAP", async () => {
            await contract_Memento
            .connect(deployer)
            .AdminMintPOAP(50, "code-is-here", FIVE_MINUTES)
            try {
                const { sig, messageHash } = await signMessage('code-is-here', user1)
                await contract_Memento
                .connect(user1)
                .claimMemento(1, 'code-is-here', messageHash, sig.v, sig.r, sig.s)

                await contract_Memento
                .connect(user1)
                .claimMemento(1, 'code-is-here', messageHash, sig.v, sig.r, sig.s)
            } catch (error) {
                expectError(error, 'Limit to 1 per wallet')
            }
        })

        it("should not claim if POAP expired", async() => {
            await contract_Memento
            .connect(deployer)
            .AdminMintPOAP(50, "code-is-here", FIVE_MINUTES)
            await network.provider.send("evm_increaseTime", [FIVE_MINUTES + 1000])
            try {
                const { sig, messageHash } = await signMessage('code-is-here', user1)

                await contract_Memento
                .connect(user1)
                .claimMemento(1, 'code-is-here', messageHash, sig.v, sig.r, sig.s)
            } catch (error) {
                expectError(error, 'Claiming expired for this ID')
            }

        })
        it("should be able to transfer locked tokens", async() => {
            await contract_Memento
            .connect(deployer)
            .AdminMintPOAP(50, "code-is-here", FIVE_MINUTES)
            await network.provider.send("evm_increaseTime", [FIVE_MINUTES + 1000])

            try {
                const { sig, messageHash } = await signMessage('code-is-here', user1)

                await contract_Memento
                .connect(user1)
                .claimMemento(1, 'code-is-here', messageHash, sig.v, sig.r, sig.s)
            } catch (error) {
                expectError(error, 'Claiming expired for this ID')
            }

            const txRes1 = await contract_Memento.balanceOf(contract_Memento.address, 1)
            expect(+txRes1).to.be.eq(50)

            expect(+await contract_Memento.balanceOf(deployer.address, 1)).to.be.eq(0)
            await contract_Memento
            .connect(deployer)
            .transferFromContract(1, 50)

            expect(+await contract_Memento.balanceOf(deployer.address, 1)).to.be.eq(50)
        })

        it("should not be able to transfer when paused", async() => {
            await contract_Memento
            .connect(deployer)
            .AdminMintTo(user1.address, 10)

            expect(+await contract_Memento.balanceOf(user1.address, 1)).to.be.eq(10)

            await contract_Memento
            .connect(deployer)
            .AdminPause()

            try {
                await contract_Memento
                .connect(user1)
                .safeTransferFrom(user1.address, user2.address, 1, 5, [])
            } catch (error) {
                expectError(error, 'ERC1155Pausable: token transfer while paused', 100)
            }

            await contract_Memento
            .connect(deployer)
            .AdminUnpause()

            await contract_Memento
            .connect(user1)
            .safeTransferFrom(user1.address, user2.address, 1, 5, [])

            expect(+await contract_Memento.balanceOf(user1.address, 1)).to.be.eq(5)
            expect(+await contract_Memento.balanceOf(user2.address, 1)).to.be.eq(5)

        })
    })

})