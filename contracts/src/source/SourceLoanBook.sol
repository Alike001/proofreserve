// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title SourceLoanBook
/// @notice Configured source of purpose-specific loan lifecycle facts for ProofReserve.
/// @dev This contract reports only its configured portfolio. It makes no claim about global borrower history.
contract SourceLoanBook {
    enum ObligationStatus {
        None,
        Active,
        Late,
        Settled,
        Loss
    }

    struct Borrower {
        bytes32 groupId;
        bool registered;
    }

    struct Obligation {
        address borrower;
        uint128 principal;
        uint64 dueAt;
        ObligationStatus status;
    }

    error Unauthorized();
    error ZeroAddress();
    error ZeroIdentifier();
    error InvalidAmount();
    error BorrowerNotRegistered(address borrower);
    error BorrowerAlreadyRegistered(address borrower);
    error ObligationAlreadyExists(bytes32 obligationId);
    error ObligationNotActive(bytes32 obligationId, ObligationStatus status);
    error ObligationNotLate(bytes32 obligationId, ObligationStatus status);
    error PaymentAfterDueDate(uint64 paidAt, uint64 dueAt);
    error PaymentBeforeDueDate(uint64 paidAt, uint64 dueAt);
    error LossExceedsPrincipal(uint128 lossAmount, uint128 principal);
    error NoFactsInEpoch(uint64 epoch);
    error WrongEpoch(uint64 expected, uint64 supplied);

    event ReporterSet(address indexed reporter, bool allowed);
    event BorrowerRegistered(address indexed borrower, bytes32 indexed groupId);
    event ObligationOpened(
        bytes32 indexed portfolioId,
        bytes32 indexed obligationId,
        address indexed borrower,
        bytes32 groupId,
        uint128 principal,
        uint64 dueAt,
        uint64 epoch
    );
    event PaymentSettled(
        bytes32 indexed portfolioId,
        bytes32 indexed obligationId,
        address indexed borrower,
        bytes32 groupId,
        uint128 amount,
        uint64 dueAt,
        uint64 paidAt,
        uint64 epoch
    );
    event PaymentLate(
        bytes32 indexed portfolioId,
        bytes32 indexed obligationId,
        address indexed borrower,
        bytes32 groupId,
        uint128 amount,
        uint64 dueAt,
        uint64 observedAt,
        uint64 epoch
    );
    event LossRealized(
        bytes32 indexed portfolioId,
        bytes32 indexed obligationId,
        address indexed borrower,
        bytes32 groupId,
        uint128 principalLoss,
        uint64 observedAt,
        uint64 epoch
    );
    event PortfolioCheckpoint(
        bytes32 indexed portfolioId, uint64 indexed epoch, bytes32 factsRoot, uint64 factCount, uint64 closedAt
    );

    address public immutable owner;
    bytes32 public immutable portfolioId;

    uint64 public currentEpoch = 1;
    uint64 public factsInCurrentEpoch;
    bytes32 public rollingFactsRoot;

    mapping(address => bool) public reporters;
    mapping(address => Borrower) public borrowers;
    mapping(bytes32 => Obligation) public obligations;
    mapping(uint64 => bytes32) public checkpointRoots;

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyReporter() {
        if (!reporters[msg.sender]) revert Unauthorized();
        _;
    }

    constructor(bytes32 portfolioId_) {
        if (portfolioId_ == bytes32(0)) revert ZeroIdentifier();
        owner = msg.sender;
        portfolioId = portfolioId_;
        reporters[msg.sender] = true;
        emit ReporterSet(msg.sender, true);
    }

    function setReporter(address reporter, bool allowed) external onlyOwner {
        if (reporter == address(0)) revert ZeroAddress();
        reporters[reporter] = allowed;
        emit ReporterSet(reporter, allowed);
    }

    function registerBorrower(address borrower, bytes32 groupId) external onlyOwner {
        if (borrower == address(0)) revert ZeroAddress();
        if (groupId == bytes32(0)) revert ZeroIdentifier();
        if (borrowers[borrower].registered) revert BorrowerAlreadyRegistered(borrower);

        borrowers[borrower] = Borrower({groupId: groupId, registered: true});
        emit BorrowerRegistered(borrower, groupId);
    }

    function openObligation(bytes32 obligationId, address borrower, uint128 principal, uint64 dueAt)
        external
        onlyReporter
    {
        if (obligationId == bytes32(0)) revert ZeroIdentifier();
        if (!borrowers[borrower].registered) revert BorrowerNotRegistered(borrower);
        if (principal == 0) revert InvalidAmount();
        if (obligations[obligationId].status != ObligationStatus.None) {
            revert ObligationAlreadyExists(obligationId);
        }

        obligations[obligationId] =
            Obligation({borrower: borrower, principal: principal, dueAt: dueAt, status: ObligationStatus.Active});

        emit ObligationOpened(
            portfolioId, obligationId, borrower, borrowers[borrower].groupId, principal, dueAt, currentEpoch
        );
    }

    function reportPaymentSettled(bytes32 obligationId, uint128 amount, uint64 paidAt) external onlyReporter {
        Obligation storage obligation = obligations[obligationId];
        if (obligation.status != ObligationStatus.Active && obligation.status != ObligationStatus.Late) {
            revert ObligationNotActive(obligationId, obligation.status);
        }
        if (amount == 0) revert InvalidAmount();

        if (obligation.status == ObligationStatus.Active && paidAt > obligation.dueAt) {
            revert PaymentAfterDueDate(paidAt, obligation.dueAt);
        }
        if (obligation.status == ObligationStatus.Late && paidAt <= obligation.dueAt) {
            revert PaymentBeforeDueDate(paidAt, obligation.dueAt);
        }

        obligation.status = ObligationStatus.Settled;
        bytes32 groupId = borrowers[obligation.borrower].groupId;
        _appendFact(
            keccak256(
                abi.encode(
                    this.reportPaymentSettled.selector,
                    portfolioId,
                    obligationId,
                    obligation.borrower,
                    groupId,
                    amount,
                    obligation.dueAt,
                    paidAt,
                    currentEpoch
                )
            )
        );

        emit PaymentSettled(
            portfolioId, obligationId, obligation.borrower, groupId, amount, obligation.dueAt, paidAt, currentEpoch
        );
    }

    function reportPaymentLate(bytes32 obligationId, uint128 amount, uint64 observedAt) external onlyReporter {
        Obligation storage obligation = obligations[obligationId];
        if (obligation.status != ObligationStatus.Active) {
            revert ObligationNotActive(obligationId, obligation.status);
        }
        if (amount == 0) revert InvalidAmount();
        if (observedAt <= obligation.dueAt) revert PaymentBeforeDueDate(observedAt, obligation.dueAt);

        obligation.status = ObligationStatus.Late;
        bytes32 groupId = borrowers[obligation.borrower].groupId;
        _appendFact(
            keccak256(
                abi.encode(
                    this.reportPaymentLate.selector,
                    portfolioId,
                    obligationId,
                    obligation.borrower,
                    groupId,
                    amount,
                    obligation.dueAt,
                    observedAt,
                    currentEpoch
                )
            )
        );

        emit PaymentLate(
            portfolioId, obligationId, obligation.borrower, groupId, amount, obligation.dueAt, observedAt, currentEpoch
        );
    }

    function reportLoss(bytes32 obligationId, uint128 principalLoss, uint64 observedAt) external onlyReporter {
        Obligation storage obligation = obligations[obligationId];
        if (obligation.status != ObligationStatus.Late) {
            revert ObligationNotLate(obligationId, obligation.status);
        }
        if (principalLoss == 0) revert InvalidAmount();
        if (principalLoss > obligation.principal) {
            revert LossExceedsPrincipal(principalLoss, obligation.principal);
        }
        if (observedAt <= obligation.dueAt) revert PaymentBeforeDueDate(observedAt, obligation.dueAt);

        obligation.status = ObligationStatus.Loss;
        bytes32 groupId = borrowers[obligation.borrower].groupId;
        _appendFact(
            keccak256(
                abi.encode(
                    this.reportLoss.selector,
                    portfolioId,
                    obligationId,
                    obligation.borrower,
                    groupId,
                    principalLoss,
                    observedAt,
                    currentEpoch
                )
            )
        );

        emit LossRealized(
            portfolioId, obligationId, obligation.borrower, groupId, principalLoss, observedAt, currentEpoch
        );
    }

    function closeCheckpoint(uint64 epoch) external onlyReporter returns (bytes32 factsRoot) {
        if (epoch != currentEpoch) revert WrongEpoch(currentEpoch, epoch);
        if (factsInCurrentEpoch == 0) revert NoFactsInEpoch(epoch);

        factsRoot = rollingFactsRoot;
        uint64 factCount = factsInCurrentEpoch;
        checkpointRoots[epoch] = factsRoot;

        emit PortfolioCheckpoint(portfolioId, epoch, factsRoot, factCount, uint64(block.timestamp));

        currentEpoch = epoch + 1;
        factsInCurrentEpoch = 0;
        rollingFactsRoot = bytes32(0);
    }

    function _appendFact(bytes32 factHash) private {
        rollingFactsRoot = keccak256(abi.encode(rollingFactsRoot, factHash));
        unchecked {
            factsInCurrentEpoch += 1;
        }
    }
}
