// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {SourceLoanBook} from "../src/source/SourceLoanBook.sol";

interface Vm {
    function prank(address sender) external;
    function expectRevert(bytes4 selector) external;
    function expectPartialRevert(bytes4 selector) external;
}

contract SourceLoanBookTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    bytes32 private constant PORTFOLIO = keccak256("proofreserve-demo");
    bytes32 private constant GROUP_A = keccak256("group-a");
    bytes32 private constant OBLIGATION_1 = keccak256("obligation-1");
    address private constant BORROWER = address(0xB0B);
    address private constant OUTSIDER = address(0xBAD);

    SourceLoanBook private loanBook;

    function setUp() public {
        loanBook = new SourceLoanBook(PORTFOLIO);
        loanBook.registerBorrower(BORROWER, GROUP_A);
    }

    function testOwnerIsInitialReporter() public view {
        require(loanBook.owner() == address(this), "wrong owner");
        require(loanBook.reporters(address(this)), "owner not reporter");
        require(loanBook.currentEpoch() == 1, "wrong initial epoch");
    }

    function testUnauthorizedReporterCannotOpenObligation() public {
        vm.expectRevert(SourceLoanBook.Unauthorized.selector);
        vm.prank(OUTSIDER);
        loanBook.openObligation(OBLIGATION_1, BORROWER, 100 ether, 100);
    }

    function testOnTimePaymentCreatesOneCheckpointFact() public {
        loanBook.openObligation(OBLIGATION_1, BORROWER, 100 ether, 100);
        loanBook.reportPaymentSettled(OBLIGATION_1, 110 ether, 90);

        require(loanBook.factsInCurrentEpoch() == 1, "fact not counted");
        require(loanBook.rollingFactsRoot() != bytes32(0), "fact root missing");

        bytes32 root = loanBook.closeCheckpoint(1);
        require(root != bytes32(0), "checkpoint root missing");
        require(loanBook.checkpointRoots(1) == root, "checkpoint not stored");
        require(loanBook.currentEpoch() == 2, "epoch not advanced");
        require(loanBook.factsInCurrentEpoch() == 0, "fact count not reset");
        require(loanBook.rollingFactsRoot() == bytes32(0), "rolling root not reset");
    }

    function testLateThenLossCreatesTwoFacts() public {
        loanBook.openObligation(OBLIGATION_1, BORROWER, 100 ether, 100);
        loanBook.reportPaymentLate(OBLIGATION_1, 25 ether, 101);
        loanBook.reportLoss(OBLIGATION_1, 40 ether, 120);

        require(loanBook.factsInCurrentEpoch() == 2, "wrong fact count");
        (, uint128 principal,, SourceLoanBook.ObligationStatus status) = loanBook.obligations(OBLIGATION_1);
        require(principal == 100 ether, "principal changed");
        require(status == SourceLoanBook.ObligationStatus.Loss, "wrong status");
    }

    function testCannotCloseEmptyOrSkipCheckpoint() public {
        vm.expectPartialRevert(SourceLoanBook.NoFactsInEpoch.selector);
        loanBook.closeCheckpoint(1);

        loanBook.openObligation(OBLIGATION_1, BORROWER, 100 ether, 100);
        loanBook.reportPaymentLate(OBLIGATION_1, 10 ether, 101);

        vm.expectPartialRevert(SourceLoanBook.WrongEpoch.selector);
        loanBook.closeCheckpoint(2);
    }

    function testCannotSpoofOnTimePaymentAfterDueDate() public {
        loanBook.openObligation(OBLIGATION_1, BORROWER, 100 ether, 100);

        vm.expectPartialRevert(SourceLoanBook.PaymentAfterDueDate.selector);
        loanBook.reportPaymentSettled(OBLIGATION_1, 100 ether, 101);
    }

    function testCannotReportLossBeforeLate() public {
        loanBook.openObligation(OBLIGATION_1, BORROWER, 100 ether, 100);

        vm.expectPartialRevert(SourceLoanBook.ObligationNotLate.selector);
        loanBook.reportLoss(OBLIGATION_1, 20 ether, 101);
    }
}
