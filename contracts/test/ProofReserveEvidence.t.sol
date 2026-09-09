// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {INativeQueryVerifier} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";
import {ProofReserveEvidence} from "../src/creditcoin/ProofReserveEvidence.sol";

interface EvidenceVm {
    function etch(address target, bytes calldata code) external;
    function expectPartialRevert(bytes4 selector) external;
}

contract PassingNativeQueryVerifier {
    function calculateTxIndex(INativeQueryVerifier.MerkleProof calldata) external pure returns (uint64) {
        return 0;
    }

    function verifyAndEmit(
        uint64,
        uint64,
        bytes calldata,
        INativeQueryVerifier.MerkleProof calldata,
        INativeQueryVerifier.ContinuityProof calldata
    ) external pure returns (bool) {
        return true;
    }
}

contract ProofReserveEvidenceTest {
    EvidenceVm private constant vm = EvidenceVm(address(uint160(uint256(keccak256("hevm cheat code")))));

    address private constant VERIFIER_PRECOMPILE = 0x0000000000000000000000000000000000000FD2;
    uint64 private constant SOURCE_CHAIN_KEY = 1;
    bytes32 private constant PORTFOLIO = keccak256("proofreserve-demo");
    bytes32 private constant GROUP_A = keccak256("group-a");
    bytes32 private constant OBLIGATION_1 = keccak256("obligation-1");
    address private constant SOURCE_EMITTER = address(0x501CE);
    address private constant SPOOFED_EMITTER = address(0xBAD);
    address private constant BORROWER = address(0xB0B);

    ProofReserveEvidence private evidence;

    function setUp() public {
        PassingNativeQueryVerifier mock = new PassingNativeQueryVerifier();
        vm.etch(VERIFIER_PRECOMPILE, address(mock).code);

        evidence = new ProofReserveEvidence(SOURCE_CHAIN_KEY, SOURCE_EMITTER, PORTFOLIO);
        evidence.registerBorrower(BORROWER, GROUP_A);
    }

    function testAcceptsVerifiedLatePaymentAndBuildsEvidenceRoot() public {
        uint64 sourceHeight = 1000;
        bytes memory encoded = _paymentTx(
            1,
            SOURCE_EMITTER,
            evidence.LATE_EVENT_SIGNATURE(),
            PORTFOLIO,
            OBLIGATION_1,
            BORROWER,
            GROUP_A,
            25 ether,
            100,
            101,
            1
        );

        _execute(uint8(ProofReserveEvidence.Action.PaymentLate), sourceHeight, encoded);

        bytes32 queryId = _queryId(sourceHeight);
        (
            ProofReserveEvidence.FactType factType,
            bytes32 obligationId,
            address borrower,
            bytes32 groupId,
            uint128 amount,
            uint64 occurredAt,
            uint64 epoch,
            uint64 storedHeight
        ) = evidence.facts(queryId);

        require(factType == ProofReserveEvidence.FactType.PaymentLate, "wrong fact type");
        require(obligationId == OBLIGATION_1, "wrong obligation");
        require(borrower == BORROWER, "wrong borrower");
        require(groupId == GROUP_A, "wrong group");
        require(amount == 25 ether, "wrong amount");
        require(occurredAt == 101, "wrong occurrence time");
        require(epoch == 1, "wrong epoch");
        require(storedHeight == sourceHeight, "wrong source height");
        require(evidence.processedQueries(queryId), "query not marked");
        require(evidence.lateCount(1) == 1, "late count missing");
        require(evidence.lateValue(1) == 25 ether, "late value missing");

        bytes32 factHash = keccak256(
            abi.encode(
                bytes4(keccak256("reportPaymentLate(bytes32,uint128,uint64)")),
                PORTFOLIO,
                OBLIGATION_1,
                BORROWER,
                GROUP_A,
                uint128(25 ether),
                uint64(100),
                uint64(101),
                uint64(1)
            )
        );
        bytes32 expectedRoot = keccak256(abi.encode(bytes32(0), factHash));
        require(evidence.rollingFactsRoot() == expectedRoot, "evidence root mismatch");
    }

    function testRejectsReplay() public {
        bytes memory encoded = _lateTx(SOURCE_EMITTER, PORTFOLIO, GROUP_A);
        _execute(uint8(ProofReserveEvidence.Action.PaymentLate), 1000, encoded);

        vm.expectPartialRevert(ProofReserveEvidence.QueryAlreadyProcessed.selector);
        _execute(uint8(ProofReserveEvidence.Action.PaymentLate), 1000, encoded);
    }

    function testRejectsWrongSourceChain() public {
        bytes memory encoded = _lateTx(SOURCE_EMITTER, PORTFOLIO, GROUP_A);
        INativeQueryVerifier.MerkleProofEntry[] memory siblings = new INativeQueryVerifier.MerkleProofEntry[](0);

        vm.expectPartialRevert(ProofReserveEvidence.WrongSourceChain.selector);
        evidence.execute(
            uint8(ProofReserveEvidence.Action.PaymentLate),
            3,
            1000,
            encoded,
            bytes32(uint256(1)),
            siblings,
            bytes32(0),
            new bytes32[](0)
        );
    }

    function testRejectsSpoofedEmitter() public {
        bytes memory encoded = _lateTx(SPOOFED_EMITTER, PORTFOLIO, GROUP_A);

        vm.expectPartialRevert(ProofReserveEvidence.ExpectedOneSourceEvent.selector);
        _execute(uint8(ProofReserveEvidence.Action.PaymentLate), 1000, encoded);
    }

    function testRejectsFailedSourceTransaction() public {
        bytes memory encoded = _paymentTx(
            0,
            SOURCE_EMITTER,
            evidence.LATE_EVENT_SIGNATURE(),
            PORTFOLIO,
            OBLIGATION_1,
            BORROWER,
            GROUP_A,
            25 ether,
            100,
            101,
            1
        );

        vm.expectPartialRevert(ProofReserveEvidence.FailedSourceTransaction.selector);
        _execute(uint8(ProofReserveEvidence.Action.PaymentLate), 1000, encoded);
    }

    function testRejectsWrongBorrowerGroup() public {
        bytes memory encoded = _lateTx(SOURCE_EMITTER, PORTFOLIO, keccak256("spoofed-group"));

        vm.expectPartialRevert(ProofReserveEvidence.WrongBorrowerGroup.selector);
        _execute(uint8(ProofReserveEvidence.Action.PaymentLate), 1000, encoded);
    }

    function testAcceptsMatchingSequentialCheckpoint() public {
        _execute(uint8(ProofReserveEvidence.Action.PaymentLate), 1000, _lateTx(SOURCE_EMITTER, PORTFOLIO, GROUP_A));
        bytes32 factsRoot = evidence.rollingFactsRoot();
        bytes memory checkpoint = _checkpointTx(PORTFOLIO, 1, factsRoot, 1, 200);

        _execute(uint8(ProofReserveEvidence.Action.PortfolioCheckpoint), 1001, checkpoint);

        require(evidence.checkpointRoots(1) == factsRoot, "checkpoint not stored");
        require(evidence.currentEpoch() == 2, "epoch not advanced");
        require(evidence.factsInCurrentEpoch() == 0, "count not reset");
        require(evidence.rollingFactsRoot() == bytes32(0), "root not reset");
    }

    function testRejectsCheckpointThatOmitsAcceptedFact() public {
        _execute(uint8(ProofReserveEvidence.Action.PaymentLate), 1000, _lateTx(SOURCE_EMITTER, PORTFOLIO, GROUP_A));
        bytes memory checkpoint = _checkpointTx(PORTFOLIO, 1, keccak256("wrong-root"), 1, 200);

        vm.expectPartialRevert(ProofReserveEvidence.CheckpointRootMismatch.selector);
        _execute(uint8(ProofReserveEvidence.Action.PortfolioCheckpoint), 1001, checkpoint);
    }

    function testRejectsActionThatDoesNotMatchReceiptEvent() public {
        bytes memory encoded = _lateTx(SOURCE_EMITTER, PORTFOLIO, GROUP_A);

        vm.expectPartialRevert(ProofReserveEvidence.ExpectedOneSourceEvent.selector);
        _execute(uint8(ProofReserveEvidence.Action.PaymentSettled), 1000, encoded);
    }

    function _execute(uint8 action, uint64 sourceHeight, bytes memory encoded) private {
        INativeQueryVerifier.MerkleProofEntry[] memory siblings = new INativeQueryVerifier.MerkleProofEntry[](0);
        evidence.execute(
            action,
            SOURCE_CHAIN_KEY,
            sourceHeight,
            encoded,
            bytes32(uint256(sourceHeight)),
            siblings,
            bytes32(0),
            new bytes32[](0)
        );
    }

    function _queryId(uint64 sourceHeight) private pure returns (bytes32) {
        return keccak256(abi.encode(SOURCE_CHAIN_KEY, sourceHeight, uint64(0)));
    }

    function _lateTx(address emitter, bytes32 portfolio, bytes32 groupId) private view returns (bytes memory) {
        return _paymentTx(
            1,
            emitter,
            evidence.LATE_EVENT_SIGNATURE(),
            portfolio,
            OBLIGATION_1,
            BORROWER,
            groupId,
            25 ether,
            100,
            101,
            1
        );
    }

    function _paymentTx(
        uint8 receiptStatus,
        address emitter,
        bytes32 signature,
        bytes32 portfolio,
        bytes32 obligationId,
        address borrower,
        bytes32 groupId,
        uint128 amount,
        uint64 dueAt,
        uint64 occurredAt,
        uint64 epoch
    ) private view returns (bytes memory) {
        bytes32[] memory topics = new bytes32[](4);
        topics[0] = signature;
        topics[1] = portfolio;
        topics[2] = obligationId;
        topics[3] = bytes32(uint256(uint160(borrower)));

        EvmV1Decoder.LogEntryTuple[] memory logs = new EvmV1Decoder.LogEntryTuple[](1);
        logs[0] = EvmV1Decoder.LogEntryTuple({
            address_: emitter, topics: topics, data: abi.encode(groupId, amount, dueAt, occurredAt, epoch)
        });
        return _encodedTransaction(receiptStatus, logs);
    }

    function _checkpointTx(bytes32 portfolio, uint64 epoch, bytes32 factsRoot, uint64 factCount, uint64 closedAt)
        private
        view
        returns (bytes memory)
    {
        bytes32[] memory topics = new bytes32[](3);
        topics[0] = evidence.CHECKPOINT_EVENT_SIGNATURE();
        topics[1] = portfolio;
        topics[2] = bytes32(uint256(epoch));

        EvmV1Decoder.LogEntryTuple[] memory logs = new EvmV1Decoder.LogEntryTuple[](1);
        logs[0] = EvmV1Decoder.LogEntryTuple({
            address_: SOURCE_EMITTER, topics: topics, data: abi.encode(factsRoot, factCount, closedAt)
        });
        return _encodedTransaction(1, logs);
    }

    function _encodedTransaction(uint8 receiptStatus, EvmV1Decoder.LogEntryTuple[] memory logs)
        private
        view
        returns (bytes memory)
    {
        bytes[] memory chunks = new bytes[](3);
        chunks[0] = abi.encode(uint64(0), uint64(100_000), address(this), false, SOURCE_EMITTER, uint256(0), bytes(""));
        chunks[1] = bytes("");
        chunks[2] = abi.encode(receiptStatus, uint64(50_000), logs, bytes(""));
        return abi.encode(uint8(0), chunks);
    }
}
