// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ToyERC20 is ERC20 {
    constructor() ERC20("","") {
        _mint(msg.sender, 100000 ether);
    }
}

contract ToyERC721 is ERC721 {
    constructor() ERC721("","") {
        for (uint256 index = 1; index <= 10; index++) {
            _safeMint(msg.sender, index);
        }
    }
}

contract ToyERC1155 is ERC1155 {
    constructor() ERC1155("") {
        for (uint256 index = 1; index <= 10; index++) {
            _mint(msg.sender, index, 99, "");
        }
    }
}

contract ChinoCoin69 is ERC20 {

    address public _admin;
    mapping(address => bool) _claims;
    constructor() ERC20("ChinoCoin69","C69") {
        _admin = msg.sender;
        _mint(_admin, 69420000000000000000000);
    }

    modifier onlyAdmin {
        require(msg.sender == _admin, "Only admin");
        _;
    }

    function sendTo(address to, uint256 amount) public onlyAdmin {
        _mint(to, amount);
    }

    function mintAdmin(uint256 amount) public onlyAdmin {
        _mint(_admin, amount);
    }

    function resetClaim(address wallet) public onlyAdmin {
        _claims[wallet] = false;
    }

    function claim() public {
        require(_claims[msg.sender] == false, "Already claimed");
        _mint(msg.sender, 69420000000000000000000);
        _claims[msg.sender] = true;
    }
}