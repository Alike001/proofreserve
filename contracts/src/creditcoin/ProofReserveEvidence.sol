// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {EvmV1Decoder} from "@gluwa/asc-contracts/contracts/common/EvmV1Decoder.sol";
import {
    INativeQueryVerifier,
    NativeQueryVerifierLib
} from "@gluwa/asc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

/// @title ProofReserveEvidence
/// @notice Verifies and records source-loan facts through Attestcoin Readability.
contract ProofReserveEvidence {
    enum Action {
        PaymentSettled,
        PaymentLate,
        LossRealized,
        PortfolioCheckpoint
    }

    enum FactType {
        None,
        PaymentSettled,
        PaymentLate,
        LossRealized,
        PortfolioCheckpoint
    }

    struct Fact {
        FactType factType;
        bytes32 obligationId;
        address borrower;
        bytes32 groupId;
        uint128 amount;
        uint64 occurredAt;
        uint64 epoch;
        uint64 sourceHeight;
    }

    struct PaymentEventData {
        bytes32 groupId;
        uint128 amount;
        uint64 dueAt;
        uint64 occurredAt;
        uint64 epoch;
    }

    struct LossEventData {
        bytes32 groupId;
        uint128 amount;
        uint64 occurredAt;
        uint64 epoch;
    }

    error Unauthorized();
    error ZeroAddress();
    error ZeroIdentifier();
    error InvalidAction(uint8 action);
    error WrongSourceChain(uint64 expected, uint64 supplied);
    error QueryAlreadyProcessed(bytes32 queryId);
    error ProofVerificationFailed();
    error InvalidTransactionType(uint8 transactionType);
    error FailedSourceTransaction();
    error ExpectedOneSourceEvent(uint256 found);
    error InvalidEventTopics(uint256 found);
    error WrongPortfolio(bytes32 expected, bytes32 supplied);
    error BorrowerNotRegistered(address borrower);
    error WrongBorrowerGroup(address borrower, bytes32 expected, bytes32 supplied);
    error WrongEpoch(uint64 expected, uint64 supplied);
    error CheckpointRootMismatch(bytes32 expected, bytes32 supplied);
    error CheckpointCountMismatch(uint64 expected, uint64 supplied);

    bytes32 public constant SETTLED_EVENT_SIGNATURE =
        keccak256("PaymentSettled(bytes32,bytes32,address,bytes32,uint128,uint64,uint64,uint64)");
    bytes32 public constant LATE_EVENT_SIGNATURE =
        keccak256("PaymentLate(bytes32,bytes32,address,bytes32,uint128,uint64,uint64,uint64)");
    bytes32 public constant LOSS_EVENT_SIGNATURE =
        keccak256("LossRealized(bytes32,bytes32,address,bytes32,uint128,uint64,uint64)");
    bytes32 public constant CHECKPOINT_EVENT_SIGNATURE =
        keccak256("PortfolioCheckpoint(bytes32,uint64,bytes32,uint64,uint64)");

    bytes4 private constant SETTLED_SELECTOR = bytes4(keccak256("reportPaymentSettled(bytes32,uint128,uint64)"));
    bytes4 private constant LATE_SELECTOR = bytes4(keccak256("reportPaymentLate(bytes32,uint128,uint64)"));
    bytes4 private constant LOSS_SELECTOR = bytes4(keccak256("reportLoss(bytes32,uint128,uint64)"));

    INativeQueryVerifier public immutable verifier;
    address public immutable owner;
    uint64 public immutable sourceChainKey;
    address public immutable sourceEmitter;
    bytes32 public immutable portfolioId;

    uint64 public currentEpoch = 1;
    uint64 public factsInCurrentEpoch;
    bytes32 public rollingFactsRoot;

    mapping(address => bytes32) public borrowerGroups;
    mapping(bytes32 => bool) public processedQueries;
    mapping(bytes32 => Fact) public facts;
    mapping(uint64 => bytes32) public checkpointRoots;
    mapping(uint64 => uint64) public settledCount;
    mapping(uint64 => uint64) public lateCount;
    mapping(uint64 => uint64) public lossCount;
    mapping(uint64 => uint256) public settledValue;
    mapping(uint64 => uint256) public lateValue;
    mapping(uint64 => uint256) public lossValue;

    event BorrowerRegistered(address indexed borrower, bytes32 indexed groupId);
    event FactAccepted(
        bytes32 indexed queryId,
        FactType indexed factType,
        bytes32 indexed obligationId,
        address borrower,
        bytes32 groupId,
        uint128 amount,
        uint64 occurredAt,
        uint64 epoch,
        uint64 sourceHeight,
        bytes32 evidenceRoot
    );
    event CheckpointAccepted(
        bytes32 indexed queryId,
        uint64 indexed epoch,
        bytes32 indexed factsRoot,
        uint64 factCount,
        uint64 sourceHeight,
        uint64 closedAt
    );

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(uint64 sourceChainKey_, address sourceEmitter_, bytes32 portfolioId_) {
        if (sourceEmitter_ == address(0)) revert ZeroAddress();
        if (portfolioId_ == bytes32(0)) revert ZeroIdentifier();

        verifier = NativeQueryVerifierLib.getVerifier();
        owner = msg.sender;
        sourceChainKey = sourceChainKey_;
        sourceEmitter = sourceEmitter_;
        portfolioId = portfolioId_;
    }

    function registerBorrower(address borrower, bytes32 groupId) external onlyOwner {
        if (borrower == address(0)) revert ZeroAddress();
        if (groupId == bytes32(0)) revert ZeroIdentifier();
        borrowerGroups[borrower] = groupId;
        emit BorrowerRegistered(borrower, groupId);
    }

    /// @notice Verify one Attestcoin proof and apply its exact source-loan event.
    function execute(
        uint8 action,
        uint64 chainKey,
        uint64 blockHeight,
        bytes calldata encodedTransaction,
        bytes32 merkleRoot,
        INativeQueryVerifier.MerkleProofEntry[] calldata siblings,
        bytes32 lowerEndpointDigest,
        bytes32[] calldata continuityRoots
    ) external returns (bool success) {
        if (chainKey != sourceChainKey) revert WrongSourceChain(sourceChainKey, chainKey);
        if (action > uint8(Action.PortfolioCheckpoint)) revert InvalidAction(action);

        INativeQueryVerifier.MerkleProof memory merkleProof =
            INativeQueryVerifier.MerkleProof({root: merkleRoot, siblings: siblings});
        uint64 transactionIndex = verifier.calculateTxIndex(merkleProof);
        bytes32 queryId = keccak256(abi.encode(chainKey, blockHeight, transactionIndex));
        if (processedQueries[queryId]) revert QueryAlreadyProcessed(queryId);

        INativeQueryVerifier.ContinuityProof memory continuityProof =
            INativeQueryVerifier.ContinuityProof({lowerEndpointDigest: lowerEndpointDigest, roots: continuityRoots});
        bool verified = verifier.verifyAndEmit(chainKey, blockHeight, encodedTransaction, merkleProof, continuityProof);
        if (!verified) revert ProofVerificationFailed();

        processedQueries[queryId] = true;
        _process(Action(action), queryId, blockHeight, encodedTransaction);
        return true;
    }

    function _process(Action action, bytes32 queryId, uint64 blockHeight, bytes memory encodedTransaction) internal {
        uint8 transactionType = EvmV1Decoder.getTransactionType(encodedTransaction);
        if (!EvmV1Decoder.isValidTransactionType(transactionType)) {
            revert InvalidTransactionType(transactionType);
        }

        EvmV1Decoder.ReceiptFields memory receipt = EvmV1Decoder.decodeReceiptFields(encodedTransaction);
        if (receipt.receiptStatus != 1) revert FailedSourceTransaction();

        if (action == Action.PaymentSettled) {
            _acceptPaymentFact(
                queryId, blockHeight, FactType.PaymentSettled, _singleSourceLog(receipt, SETTLED_EVENT_SIGNATURE)
            );
        } else if (action == Action.PaymentLate) {
            _acceptPaymentFact(
                queryId, blockHeight, FactType.PaymentLate, _singleSourceLog(receipt, LATE_EVENT_SIGNATURE)
            );
        } else if (action == Action.LossRealized) {
            _acceptLossFact(queryId, blockHeight, _singleSourceLog(receipt, LOSS_EVENT_SIGNATURE));
        } else {
            _acceptCheckpoint(queryId, blockHeight, _singleSourceLog(receipt, CHECKPOINT_EVENT_SIGNATURE));
        }
    }

    function _acceptPaymentFact(
        bytes32 queryId,
        uint64 blockHeight,
        FactType factType,
        EvmV1Decoder.LogEntry memory sourceLog
    ) private {
        _requireFactTopics(sourceLog);
        bytes32 suppliedPortfolio = sourceLog.topics[1];
        bytes32 obligationId = sourceLog.topics[2];
        address borrower = address(uint160(uint256(sourceLog.topics[3])));
        PaymentEventData memory eventData = abi.decode(sourceLog.data, (PaymentEventData));

        _requireSubject(suppliedPortfolio, borrower, eventData.groupId, eventData.epoch);
        bytes4 selector = factType == FactType.PaymentSettled ? SETTLED_SELECTOR : LATE_SELECTOR;
        bytes32 factHash = keccak256(
            abi.encode(
                selector,
                portfolioId,
                obligationId,
                borrower,
                eventData.groupId,
                eventData.amount,
                eventData.dueAt,
                eventData.occurredAt,
                eventData.epoch
            )
        );
        Fact memory fact = Fact({
            factType: factType,
            obligationId: obligationId,
            borrower: borrower,
            groupId: eventData.groupId,
            amount: eventData.amount,
            occurredAt: eventData.occurredAt,
            epoch: eventData.epoch,
            sourceHeight: blockHeight
        });
        _storeFact(queryId, fact, factHash);

        if (factType == FactType.PaymentSettled) {
            settledCount[eventData.epoch] += 1;
            settledValue[eventData.epoch] += eventData.amount;
        } else {
            lateCount[eventData.epoch] += 1;
            lateValue[eventData.epoch] += eventData.amount;
        }
    }

    function _acceptLossFact(bytes32 queryId, uint64 blockHeight, EvmV1Decoder.LogEntry memory sourceLog) private {
        _requireFactTopics(sourceLog);
        bytes32 suppliedPortfolio = sourceLog.topics[1];
        bytes32 obligationId = sourceLog.topics[2];
        address borrower = address(uint160(uint256(sourceLog.topics[3])));
        LossEventData memory eventData = abi.decode(sourceLog.data, (LossEventData));

        _requireSubject(suppliedPortfolio, borrower, eventData.groupId, eventData.epoch);
        bytes32 factHash = keccak256(
            abi.encode(
                LOSS_SELECTOR,
                portfolioId,
                obligationId,
                borrower,
                eventData.groupId,
                eventData.amount,
                eventData.occurredAt,
                eventData.epoch
            )
        );
        Fact memory fact = Fact({
            factType: FactType.LossRealized,
            obligationId: obligationId,
            borrower: borrower,
            groupId: eventData.groupId,
            amount: eventData.amount,
            occurredAt: eventData.occurredAt,
            epoch: eventData.epoch,
            sourceHeight: blockHeight
        });
        _storeFact(queryId, fact, factHash);
        lossCount[eventData.epoch] += 1;
        lossValue[eventData.epoch] += eventData.amount;
    }

    function _acceptCheckpoint(bytes32 queryId, uint64 blockHeight, EvmV1Decoder.LogEntry memory sourceLog) private {
        if (sourceLog.topics.length != 3) revert InvalidEventTopics(sourceLog.topics.length);
        bytes32 suppliedPortfolio = sourceLog.topics[1];
        uint64 epoch = uint64(uint256(sourceLog.topics[2]));
        (bytes32 suppliedRoot, uint64 suppliedCount, uint64 closedAt) =
            abi.decode(sourceLog.data, (bytes32, uint64, uint64));

        if (suppliedPortfolio != portfolioId) revert WrongPortfolio(portfolioId, suppliedPortfolio);
        if (epoch != currentEpoch) revert WrongEpoch(currentEpoch, epoch);
        if (suppliedRoot != rollingFactsRoot) {
            revert CheckpointRootMismatch(rollingFactsRoot, suppliedRoot);
        }
        if (suppliedCount != factsInCurrentEpoch) {
            revert CheckpointCountMismatch(factsInCurrentEpoch, suppliedCount);
        }

        checkpointRoots[epoch] = suppliedRoot;
        facts[queryId] = Fact({
            factType: FactType.PortfolioCheckpoint,
            obligationId: bytes32(0),
            borrower: address(0),
            groupId: bytes32(0),
            amount: 0,
            occurredAt: closedAt,
            epoch: epoch,
            sourceHeight: blockHeight
        });

        emit CheckpointAccepted(queryId, epoch, suppliedRoot, suppliedCount, blockHeight, closedAt);

        currentEpoch = epoch + 1;
        factsInCurrentEpoch = 0;
        rollingFactsRoot = bytes32(0);
    }

    function _storeFact(bytes32 queryId, Fact memory fact, bytes32 factHash) private {
        rollingFactsRoot = keccak256(abi.encode(rollingFactsRoot, factHash));
        factsInCurrentEpoch += 1;
        facts[queryId] = fact;

        emit FactAccepted(
            queryId,
            fact.factType,
            fact.obligationId,
            fact.borrower,
            fact.groupId,
            fact.amount,
            fact.occurredAt,
            fact.epoch,
            fact.sourceHeight,
            rollingFactsRoot
        );
    }

    function _singleSourceLog(EvmV1Decoder.ReceiptFields memory receipt, bytes32 signature)
        private
        view
        returns (EvmV1Decoder.LogEntry memory selected)
    {
        uint256 found;
        for (uint256 i; i < receipt.receiptLogs.length; ++i) {
            EvmV1Decoder.LogEntry memory candidate = receipt.receiptLogs[i];
            if (candidate.address_ == sourceEmitter && candidate.topics.length > 0 && candidate.topics[0] == signature)
            {
                selected = candidate;
                found += 1;
            }
        }
        if (found != 1) revert ExpectedOneSourceEvent(found);
    }

    function _requireFactTopics(EvmV1Decoder.LogEntry memory sourceLog) private pure {
        if (sourceLog.topics.length != 4) revert InvalidEventTopics(sourceLog.topics.length);
    }

    function _requireSubject(bytes32 suppliedPortfolio, address borrower, bytes32 groupId, uint64 epoch) private view {
        if (suppliedPortfolio != portfolioId) revert WrongPortfolio(portfolioId, suppliedPortfolio);
        bytes32 expectedGroup = borrowerGroups[borrower];
        if (expectedGroup == bytes32(0)) revert BorrowerNotRegistered(borrower);
        if (groupId != expectedGroup) revert WrongBorrowerGroup(borrower, expectedGroup, groupId);
        if (epoch != currentEpoch) revert WrongEpoch(currentEpoch, epoch);
    }
}
