// SPDX-License-Identifier: MIT
//                                                  __
//                          __                     /\ \__
//  _____    _ __    ___   /\_\       __     ___   \ \ ,_\
// /\ '__`\ /\`'__\ / __`\ \/\ \    /'__`\  /'___\  \ \ \/
// \ \ \L\ \\ \ \/ /\ \L\ \ \ \ \  /\  __/ /\ \__/   \ \ \_
//  \ \ ,__/ \ \_\ \ \____/ _\ \ \ \ \____\\ \____\   \ \__\
//   \ \ \/   \/_/  \/___/ /\ \_\ \ \/____/ \/____/    \/__/
//    \ \_\                \ \____/
//     \/_/                 \/___/
//          ___                                             __
//         /\_ \                                           /\ \__
//    __   \//\ \       __     ___ ___       __     ___    \ \ ,_\    ___
//  /'__`\   \ \ \    /'__`\ /' __` __`\   /'__`\ /' _ `\   \ \ \/   / __`\
// /\  __/    \_\ \_ /\  __/ /\ \/\ \/\ \ /\  __/ /\ \/\ \   \ \ \_ /\ \L\ \
// \ \____\   /\____\\ \____\\ \_\ \_\ \_\\ \____\\ \_\ \_\   \ \__\\ \____/
//  \/____/   \/____/ \/____/ \/_/\/_/\/_/ \/____/ \/_/\/_/    \/__/ \/___/
// author   : k1merran.eth
// mail     : mark@fiverlabs.io
pragma solidity ^0.8.9;
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Pausable.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

// debug
// import "hardhat/console.sol";
contract ProjectElementoMemento is ERC1155Pausable, ERC1155Holder {
    uint256 nextTokenId = 1;
    // uint256 maxSupply = type(uint256).max - 1;
    mapping(uint256 => bool) isTokenPoap;
    mapping(uint256 => string) mementoCodes;
    mapping(uint256 => uint256) mementoExpiry;
    mapping(address => bool) allowedMinters;
    mapping(address => mapping(uint256 => bool)) claimedPoaps;
    address public Admin;
    string public name = "Project Elemento (Memento)";
    string public symbol = "MEMENTO";
    string private _baseMetadataApi = "";
    string private _baseUri = "";

    modifier tokenShouldExist(uint256 tokenId) {
        require(tokenId < nextTokenId, "URI: nonexistent token");
        _;
    }

    modifier onlyAdmin {
        require(msg.sender == Admin, "Only admin");
        _;
    }

    modifier onlyAllowedMinter {
        require(allowedMinters[msg.sender], "Only allowed minter");
        _;
    }

    constructor(
        string memory baseUri
    ) ERC1155(
        string(abi.encodePacked(baseUri))
    ) {
        Admin = msg.sender;
        _baseUri = baseUri;
        allowedMinters[Admin] = true;
    }

    fallback() external payable {}
    receive() external payable {}

    function addAllowedMinter(address wallet) public onlyAdmin {
        allowedMinters[wallet] = true;
    }

    function removeAllowedMinter(address wallet) public onlyAdmin {
        allowedMinters[wallet] = false;
    }

    function setBaseUri(string memory baseUri) public onlyAdmin {
        _baseUri = baseUri;
    }

    // safety: withdraw ether
    function withdraw() public payable onlyAllowedMinter {
        (bool os, ) = payable(msg.sender).call{value: address(this).balance}("");
        require(os);
    }

    // safety: withdraw ERC20
    function withdrawErc20(address erc20Address) public onlyAllowedMinter {
        IERC20 erc20 = IERC20(erc20Address);
        erc20.approve(address(this), erc20.balanceOf(address(this)));
        erc20.transferFrom(address(this), msg.sender, erc20.balanceOf(address(this)));
    }

    // safety: withdraw ERC721
    function withdrawErc721(address erc721Address, uint256 tokenId) public onlyAllowedMinter {
        IERC721 erc721 = IERC721(erc721Address);
        erc721.safeTransferFrom(address(this), msg.sender, tokenId);
    }

    // safety: withdraw ERC1155
    function transferFromContract(uint256 tokenId, uint256 amount) public onlyAllowedMinter {
        _safeTransferFrom(address(this), msg.sender, tokenId, amount, "");
    }

    function AdminPause() public onlyAdmin {
        _pause();
    }

    function AdminUnpause() public onlyAdmin {
        _unpause();
    }

    // admin: mints MEMENTO to sender's wallet
    function AdminMint(uint256 supply) public onlyAllowedMinter {
        AdminMintTo(msg.sender, supply);
    }

    // admin: mints MEMENTO to parameter wallet
    function AdminMintTo(address wallet, uint256 supply) public onlyAllowedMinter {
        __mint(wallet, supply);
    }

    // admin: add supply to existing token
    function AdminAddSupply(uint256 tokenId, uint256 supply) public onlyAllowedMinter {
        AdminAddSupplyTo(msg.sender, tokenId, supply);
    }

    // admin: add supply and send to another wallet
    function AdminAddSupplyTo(address wallet, uint256 tokenId, uint256 supply) public onlyAllowedMinter {
        require(tokenId < nextTokenId, "Not existing token");
        require(!isTokenPoap[tokenId], "Token is not POAP");
        __mint(wallet, supply, tokenId);
    }

    // admin: batch transfer to destination wallets
    function AdminBatchTransfer(address[] memory destinations, uint256 tokenId) public onlyAllowedMinter {
        for (uint256 index = 0; index < destinations.length; index++) {
            _safeTransferFrom(msg.sender, destinations[index], tokenId, 1, "");
        }
    }

    // admin: mint poap and store in contract to be claimed
    function AdminMintPOAP(uint256 supply, string memory code, uint256 expiry)
    public onlyAllowedMinter
    {
        mementoCodes[nextTokenId] = code;
        mementoExpiry[nextTokenId] = expiry;
        isTokenPoap[nextTokenId] = true;

        _mint(address(this), nextTokenId, supply, "");
        nextTokenId++;
    }

    // public: claim a memento poap
    function claimMemento(
        uint256 tokenId,
        string memory code,
        bytes32 _hashedMessage,
        uint8 _v,
        bytes32 _r,
        bytes32 _s
    ) public
    {
        address signer = verifyMessage(_hashedMessage, _v, _r, _s);
        require(msg.sender == signer, "Sender is not the signer");
        _claimMemento(tokenId, code);
    }

    // public: ERC115 metadata
    function uri(uint256 _id)
        public view override
        tokenShouldExist(_id)
        returns (string memory)
    {
        return bytes(_baseUri).length > 0
        ? string(abi.encodePacked(_baseUri, Strings.toString(_id)))
        : "";
    }

     // internal: mint token with next id
    function __mint(address wallet, uint256 supply) internal {
        __mint(wallet, supply, nextTokenId);
        nextTokenId++;
    }

    // internal: mint an existing token id
    function __mint(address wallet, uint256 supply, uint256 tokenId) internal {
        _mint(wallet, tokenId, supply, "");
    }

    function __compareStrings(string memory a, string memory b)
    internal pure returns (bool)
    {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }

    function _claimMemento(uint256 tokenId, string memory code) internal {
        require(isTokenPoap[tokenId], "Token is not POAP");
        require(claimedPoaps[msg.sender][tokenId] == false, "Limit to 1 per wallet");
        require(block.timestamp < mementoExpiry[tokenId], "Claiming expired for this ID");
        require(__compareStrings(mementoCodes[tokenId], code), "Code is not correct.");
        _safeTransferFrom(address(this), msg.sender, tokenId, 1, "");
        claimedPoaps[msg.sender][tokenId] = true;
    }

    function verifyMessage(bytes32 _hashedMessage, uint8 _v, bytes32 _r, bytes32 _s) public pure returns (address) {
        bytes memory prefix = "\x19Ethereum Signed Message:\n32";
        bytes32 prefixedHashMessage = keccak256(abi.encodePacked(prefix, _hashedMessage));
        return ecrecover(prefixedHashMessage, _v, _r, _s);
    }

    function supportsInterface(bytes4 interfaceId)
    public view virtual override(ERC1155, ERC1155Receiver) returns (bool)
    {
        return interfaceId == type(IERC1155Receiver).interfaceId || super.supportsInterface(interfaceId);
    }
}
