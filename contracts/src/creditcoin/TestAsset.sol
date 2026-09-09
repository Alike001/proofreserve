// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Mintable test-only asset for the Creditcoin CC3 ProofReserve pool.
contract TestAsset is ERC20, Ownable {
    constructor(address initialOwner) ERC20("ProofReserve Test Dollar", "prUSD") Ownable(initialOwner) {}

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
