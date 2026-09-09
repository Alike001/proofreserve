// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ProofReservePool} from "../src/creditcoin/ProofReservePool.sol";
import {ReserveController} from "../src/creditcoin/ReserveController.sol";
import {TestAsset} from "../src/creditcoin/TestAsset.sol";

interface PoolVm {
    function prank(address sender) external;
    function expectRevert() external;
    function expectPartialRevert(bytes4 selector) external;
    function warp(uint256 timestamp) external;
}

contract MockCheckpointEvidence {
    mapping(uint64 => bytes32) public checkpointRoots;

    function setCheckpoint(uint64 epoch, bytes32 root) external {
        checkpointRoots[epoch] = root;
    }
}

contract ReserveControllerAndPoolTest {
    PoolVm private constant vm = PoolVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant AGENT = address(0xA11);
    address private constant PROVIDER = address(0x1A);
    address private constant BORROWER = address(0xB0B);
    bytes32 private constant MODEL_VERSION = keccak256("ollama-model-v1");
    bytes32 private constant POLICY_VERSION = keccak256("reserve-policy-v1");
    bytes32 private constant ROOT_1 = keccak256("checkpoint-1");
    bytes32 private constant ROOT_2 = keccak256("checkpoint-2");

    MockCheckpointEvidence private evidence;
    ReserveController private controller;
    TestAsset private asset;
    ProofReservePool private pool;

    function setUp() public {
        evidence = new MockCheckpointEvidence();
        evidence.setCheckpoint(1, ROOT_1);

        uint16[4] memory bands = [uint16(1_000), uint16(2_000), uint16(4_000), uint16(6_000)];
        controller = new ReserveController(
            address(evidence), AGENT, 1_000, 6_000, 6_000, 1 days, bands, MODEL_VERSION, POLICY_VERSION
        );
        asset = new TestAsset(address(this));
        pool = new ProofReservePool(address(asset), address(controller));

        asset.mint(PROVIDER, 100 ether);
        vm.prank(PROVIDER);
        asset.approve(address(pool), 100 ether);
        vm.prank(PROVIDER);
        pool.deposit(100 ether);
    }

    function testStressReserveChangesActualLoanCapacity() public {
        require(pool.lockedReserve() == 10 ether, "wrong normal reserve");
        require(pool.lendable() == 90 ether, "wrong normal capacity");

        pool.commitLoan(BORROWER, 70 ether);
        pool.cancelCommitment(BORROWER, 70 ether);

        ReserveController.Assessment memory stress = _assessment(
            ReserveController.Regime.Stress, 4_000, 8_500, 1, ROOT_1, keccak256("correlated-lates-plus-utilization")
        );
        vm.prank(AGENT);
        controller.submitAssessment(stress);

        require(controller.activeReserveBps() == 4_000, "stress policy not applied");
        require(pool.lockedReserve() == 40 ether, "wrong stress reserve");
        require(pool.lendable() == 60 ether, "wrong stress capacity");

        vm.expectPartialRevert(ProofReservePool.InsufficientLendable.selector);
        pool.commitLoan(BORROWER, 70 ether);
    }

    function testAgentCannotControlPoolFunds() public {
        vm.expectRevert();
        vm.prank(AGENT);
        pool.commitLoan(BORROWER, 1 ether);
    }

    function testControllerRejectsArbitraryReserveValue() public {
        ReserveController.Assessment memory invalid =
            _assessment(ReserveController.Regime.Stress, 3_500, 8_000, 1, ROOT_1, keccak256("invalid-reserve"));

        vm.expectPartialRevert(ReserveController.ReserveOutsidePolicy.selector);
        vm.prank(AGENT);
        controller.submitAssessment(invalid);
    }

    function testDecisionCannotBeReplayed() public {
        ReserveController.Assessment memory stress =
            _assessment(ReserveController.Regime.Stress, 4_000, 8_000, 1, ROOT_1, keccak256("stress"));
        vm.prank(AGENT);
        controller.submitAssessment(stress);

        vm.expectPartialRevert(ReserveController.DecisionAlreadyUsed.selector);
        vm.prank(AGENT);
        controller.submitAssessment(stress);
    }

    function testCannotRollBackToAnOlderEvidenceEpoch() public {
        evidence.setCheckpoint(2, ROOT_2);
        ReserveController.Assessment memory crisis =
            _assessment(ReserveController.Regime.Crisis, 6_000, 8_500, 2, ROOT_2, keccak256("newer-crisis"));
        vm.prank(AGENT);
        controller.submitAssessment(crisis);

        ReserveController.Assessment memory stale =
            _assessment(ReserveController.Regime.Stress, 4_000, 9_000, 1, ROOT_1, keccak256("stale-stress"));
        vm.expectPartialRevert(ReserveController.StaleEvidenceEpoch.selector);
        vm.prank(AGENT);
        controller.submitAssessment(stale);
    }

    function testReserveDecreaseRequiresDelayAndOwnerConfirmation() public {
        ReserveController.Assessment memory stress =
            _assessment(ReserveController.Regime.Stress, 4_000, 8_000, 1, ROOT_1, keccak256("stress"));
        vm.prank(AGENT);
        controller.submitAssessment(stress);

        evidence.setCheckpoint(2, ROOT_2);
        ReserveController.Assessment memory watch =
            _assessment(ReserveController.Regime.Watch, 2_000, 9_000, 2, ROOT_2, keccak256("recovery"));
        vm.prank(AGENT);
        controller.submitAssessment(watch);

        require(controller.activeReserveBps() == 4_000, "decrease applied too early");
        (,,, uint64 unlockAt,, bytes32 pendingHash) = controller.pendingDecrease();

        vm.expectPartialRevert(ReserveController.DecreaseStillLocked.selector);
        controller.confirmDecrease(pendingHash);

        vm.warp(unlockAt);
        controller.confirmDecrease(pendingHash);
        require(controller.activeReserveBps() == 2_000, "decrease not confirmed");
        require(controller.activeEpoch() == 2, "wrong recovery epoch");
    }

    function testCommittedLoanCanDrawAndRepayWithoutReducingManagedAssets() public {
        pool.commitLoan(BORROWER, 50 ether);
        vm.prank(BORROWER);
        pool.drawLoan(50 ether);

        require(pool.liquidAssets() == 50 ether, "wrong liquid assets");
        require(pool.totalPrincipalOutstanding() == 50 ether, "wrong outstanding");
        require(pool.totalManagedAssets() == 100 ether, "managed assets changed on draw");
        require(pool.lockedReserve() == 10 ether, "reserve changed on draw");

        vm.prank(BORROWER);
        asset.approve(address(pool), 50 ether);
        vm.prank(BORROWER);
        pool.repayPrincipal(50 ether);

        require(pool.liquidAssets() == 100 ether, "repayment not received");
        require(pool.totalPrincipalOutstanding() == 0, "principal not cleared");
    }

    function testWithdrawalCannotConsumeCommittedOrReservedLiquidity() public {
        pool.commitLoan(BORROWER, 80 ether);

        vm.expectPartialRevert(ProofReservePool.ReserveOrCommitmentBreach.selector);
        vm.prank(PROVIDER);
        pool.withdraw(20 ether);
    }

    function _assessment(
        ReserveController.Regime regime,
        uint16 reserveBps,
        uint16 confidenceBps,
        uint64 epoch,
        bytes32 evidenceRoot,
        bytes32 featureHash
    ) private view returns (ReserveController.Assessment memory assessment) {
        assessment = ReserveController.Assessment({
            regime: regime,
            reserveBps: reserveBps,
            confidenceBps: confidenceBps,
            epoch: epoch,
            reasonCodesHash: keccak256("reason-codes"),
            evidenceRoot: evidenceRoot,
            featureHash: featureHash,
            modelVersion: MODEL_VERSION,
            policyVersion: POLICY_VERSION,
            decisionHash: bytes32(0)
        });
        assessment.decisionHash = controller.assessmentDigest(assessment);
    }
}
