// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ResearchToken is ERC20, Ownable {

    address public fundingContract;

    constructor() ERC20("Research Token", "RST") Ownable(msg.sender) {}

    modifier onlyFundingContract() {
        require(msg.sender == fundingContract, "Not authorized");
        _;
    }

    function setFundingContract(address _addr) external onlyOwner {
        fundingContract = _addr;
    }

    function mint(address to, uint256 amount) external onlyFundingContract {
        _mint(to, amount);
    }
}
