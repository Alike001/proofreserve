// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IReserveController {
    function activeReserveBps() external view returns (uint16);
}

/// @title ProofReservePool
/// @notice Minimal testnet lending pool whose real capacity is constrained by ProofReserve.
contract ProofReservePool is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error InvalidAmount();
    error InsufficientDeposit(uint256 available, uint256 requested);
    error InsufficientLendable(uint256 available, uint256 requested);
    error InsufficientCommitment(uint256 available, uint256 requested);
    error InsufficientOutstanding(uint256 available, uint256 requested);
    error ReserveOrCommitmentBreach();

    IERC20 public immutable asset;
    IReserveController public immutable reserveController;

    uint256 public totalDeposits;
    uint256 public totalCommitments;
    uint256 public totalPrincipalOutstanding;

    mapping(address => uint256) public deposits;
    mapping(address => uint256) public commitments;
    mapping(address => uint256) public principalOutstanding;

    event Deposited(address indexed provider, uint256 amount);
    event Withdrawn(address indexed provider, uint256 amount);
    event LoanCommitted(address indexed borrower, uint256 amount);
    event CommitmentCancelled(address indexed borrower, uint256 amount);
    event LoanDrawn(address indexed borrower, uint256 amount);
    event LoanRepaid(address indexed borrower, uint256 amount);

    constructor(address asset_, address reserveController_) Ownable(msg.sender) {
        if (asset_ == address(0) || reserveController_ == address(0)) revert ZeroAddress();
        asset = IERC20(asset_);
        reserveController = IReserveController(reserveController_);
    }

    function liquidAssets() public view returns (uint256) {
        return asset.balanceOf(address(this));
    }

    function totalManagedAssets() public view returns (uint256) {
        return liquidAssets() + totalPrincipalOutstanding;
    }

    function lockedReserve() public view returns (uint256) {
        return (totalManagedAssets() * reserveController.activeReserveBps()) / 10_000;
    }

    function lendable() public view returns (uint256) {
        uint256 protectedAndCommitted = lockedReserve() + totalCommitments;
        uint256 liquidity = liquidAssets();
        return liquidity > protectedAndCommitted ? liquidity - protectedAndCommitted : 0;
    }

    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        deposits[msg.sender] += amount;
        totalDeposits += amount;
        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        uint256 providerDeposit = deposits[msg.sender];
        if (amount == 0) revert InvalidAmount();
        if (amount > providerDeposit) revert InsufficientDeposit(providerDeposit, amount);

        uint256 liquidityAfter = liquidAssets() - amount;
        uint256 managedAssetsAfter = liquidityAfter + totalPrincipalOutstanding;
        uint256 reserveAfter = (managedAssetsAfter * reserveController.activeReserveBps()) / 10_000;
        if (liquidityAfter < reserveAfter + totalCommitments) revert ReserveOrCommitmentBreach();

        deposits[msg.sender] = providerDeposit - amount;
        totalDeposits -= amount;
        asset.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function commitLoan(address borrower, uint256 amount) external onlyOwner {
        if (borrower == address(0)) revert ZeroAddress();
        if (amount == 0) revert InvalidAmount();
        uint256 available = lendable();
        if (amount > available) revert InsufficientLendable(available, amount);

        commitments[borrower] += amount;
        totalCommitments += amount;
        emit LoanCommitted(borrower, amount);
    }

    function cancelCommitment(address borrower, uint256 amount) external onlyOwner {
        uint256 committed = commitments[borrower];
        if (amount == 0) revert InvalidAmount();
        if (amount > committed) revert InsufficientCommitment(committed, amount);

        commitments[borrower] = committed - amount;
        totalCommitments -= amount;
        emit CommitmentCancelled(borrower, amount);
    }

    function drawLoan(uint256 amount) external nonReentrant {
        uint256 committed = commitments[msg.sender];
        if (amount == 0) revert InvalidAmount();
        if (amount > committed) revert InsufficientCommitment(committed, amount);

        commitments[msg.sender] = committed - amount;
        totalCommitments -= amount;
        principalOutstanding[msg.sender] += amount;
        totalPrincipalOutstanding += amount;
        asset.safeTransfer(msg.sender, amount);
        emit LoanDrawn(msg.sender, amount);
    }

    function repayPrincipal(uint256 amount) external nonReentrant {
        uint256 outstanding = principalOutstanding[msg.sender];
        if (amount == 0) revert InvalidAmount();
        if (amount > outstanding) revert InsufficientOutstanding(outstanding, amount);

        principalOutstanding[msg.sender] = outstanding - amount;
        totalPrincipalOutstanding -= amount;
        asset.safeTransferFrom(msg.sender, address(this), amount);
        emit LoanRepaid(msg.sender, amount);
    }
}
