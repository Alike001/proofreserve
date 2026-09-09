// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IProofReserveEvidence {
    function checkpointRoots(uint64 epoch) external view returns (bytes32);
}

/// @title ReserveController
/// @notice Bounds AI recommendations to finite reserve policy and keeps final authority on-chain.
contract ReserveController is Ownable {
    enum Regime {
        Normal,
        Watch,
        Stress,
        Crisis
    }

    struct Assessment {
        Regime regime;
        uint16 reserveBps;
        uint16 confidenceBps;
        uint64 epoch;
        bytes32 reasonCodesHash;
        bytes32 evidenceRoot;
        bytes32 featureHash;
        bytes32 modelVersion;
        bytes32 policyVersion;
        bytes32 decisionHash;
    }

    struct PendingDecrease {
        Regime regime;
        uint16 reserveBps;
        uint64 epoch;
        uint64 unlockAt;
        bytes32 evidenceRoot;
        bytes32 decisionHash;
    }

    error UnauthorizedAgent();
    error ZeroAddress();
    error InvalidReservePolicy();
    error InvalidConfidence(uint16 minimum, uint16 supplied);
    error InvalidRegime(uint8 regime);
    error StaleEvidenceEpoch(uint64 current, uint64 supplied);
    error ReserveOutsidePolicy(uint16 expected, uint16 supplied);
    error UnknownEvidence(uint64 epoch);
    error EvidenceRootMismatch(bytes32 expected, bytes32 supplied);
    error ModelVersionMismatch(bytes32 expected, bytes32 supplied);
    error PolicyVersionMismatch(bytes32 expected, bytes32 supplied);
    error DecisionHashMismatch(bytes32 expected, bytes32 supplied);
    error DecisionAlreadyUsed(bytes32 decisionHash);
    error NoPendingDecrease();
    error WrongPendingDecision(bytes32 expected, bytes32 supplied);
    error DecreaseStillLocked(uint64 unlockAt);

    IProofReserveEvidence public immutable evidence;
    uint16 public immutable baseReserveBps;
    uint16 public immutable maximumReserveBps;
    uint16 public immutable minimumConfidenceBps;
    uint64 public immutable decreaseDelay;
    bytes32 public immutable modelVersion;
    bytes32 public immutable policyVersion;

    address public agent;
    Regime public activeRegime;
    uint16 public activeReserveBps;
    uint16[4] public reserveBands;
    bytes32 public activeEvidenceRoot;
    uint64 public activeEpoch;
    PendingDecrease public pendingDecrease;

    mapping(bytes32 => bool) public usedDecisions;

    event AgentUpdated(address indexed previousAgent, address indexed newAgent);
    event ReserveIncreased(
        bytes32 indexed decisionHash,
        Regime indexed regime,
        uint16 reserveBps,
        uint64 indexed epoch,
        bytes32 evidenceRoot
    );
    event ReserveDecreaseScheduled(
        bytes32 indexed decisionHash, Regime indexed regime, uint16 reserveBps, uint64 indexed epoch, uint64 unlockAt
    );
    event ReserveDecreaseConfirmed(
        bytes32 indexed decisionHash, Regime indexed regime, uint16 reserveBps, uint64 indexed epoch
    );

    modifier onlyAgent() {
        if (msg.sender != agent) revert UnauthorizedAgent();
        _;
    }

    constructor(
        address evidence_,
        address agent_,
        uint16 baseReserveBps_,
        uint16 maximumReserveBps_,
        uint16 minimumConfidenceBps_,
        uint64 decreaseDelay_,
        uint16[4] memory reserveBands_,
        bytes32 modelVersion_,
        bytes32 policyVersion_
    ) Ownable(msg.sender) {
        if (evidence_ == address(0) || agent_ == address(0)) revert ZeroAddress();
        if (
            baseReserveBps_ > 10_000 || maximumReserveBps_ > 10_000 || minimumConfidenceBps_ > 10_000
                || decreaseDelay_ == 0 || modelVersion_ == bytes32(0) || policyVersion_ == bytes32(0)
                || baseReserveBps_ > maximumReserveBps_ || reserveBands_[0] < baseReserveBps_
                || reserveBands_[3] > maximumReserveBps_ || reserveBands_[0] > reserveBands_[1]
                || reserveBands_[1] > reserveBands_[2] || reserveBands_[2] > reserveBands_[3]
        ) revert InvalidReservePolicy();

        evidence = IProofReserveEvidence(evidence_);
        agent = agent_;
        baseReserveBps = baseReserveBps_;
        maximumReserveBps = maximumReserveBps_;
        minimumConfidenceBps = minimumConfidenceBps_;
        decreaseDelay = decreaseDelay_;
        reserveBands = reserveBands_;
        modelVersion = modelVersion_;
        policyVersion = policyVersion_;
        activeRegime = Regime.Normal;
        activeReserveBps = reserveBands_[0];
    }

    function setAgent(address newAgent) external onlyOwner {
        if (newAgent == address(0)) revert ZeroAddress();
        address previousAgent = agent;
        agent = newAgent;
        emit AgentUpdated(previousAgent, newAgent);
    }

    function submitAssessment(Assessment calldata assessment) external onlyAgent {
        _validateAssessment(assessment);
        usedDecisions[assessment.decisionHash] = true;

        if (assessment.reserveBps >= activeReserveBps) {
            delete pendingDecrease;
            _applyIncrease(assessment);
        } else {
            uint64 unlockAt = uint64(block.timestamp) + decreaseDelay;
            pendingDecrease = PendingDecrease({
                regime: assessment.regime,
                reserveBps: assessment.reserveBps,
                epoch: assessment.epoch,
                unlockAt: unlockAt,
                evidenceRoot: assessment.evidenceRoot,
                decisionHash: assessment.decisionHash
            });
            emit ReserveDecreaseScheduled(
                assessment.decisionHash, assessment.regime, assessment.reserveBps, assessment.epoch, unlockAt
            );
        }
    }

    function confirmDecrease(bytes32 decisionHash) external onlyOwner {
        PendingDecrease memory pending = pendingDecrease;
        if (pending.decisionHash == bytes32(0)) revert NoPendingDecrease();
        if (pending.decisionHash != decisionHash) {
            revert WrongPendingDecision(pending.decisionHash, decisionHash);
        }
        // A one-day safety delay is intentionally time-based; sub-minute timestamp variance cannot bypass it materially.
        // forge-lint: disable-next-line(block-timestamp)
        if (block.timestamp < pending.unlockAt) revert DecreaseStillLocked(pending.unlockAt);
        if (evidence.checkpointRoots(pending.epoch) != pending.evidenceRoot) {
            revert EvidenceRootMismatch(evidence.checkpointRoots(pending.epoch), pending.evidenceRoot);
        }

        activeRegime = pending.regime;
        activeReserveBps = pending.reserveBps;
        activeEvidenceRoot = pending.evidenceRoot;
        activeEpoch = pending.epoch;
        delete pendingDecrease;

        emit ReserveDecreaseConfirmed(decisionHash, pending.regime, pending.reserveBps, pending.epoch);
    }

    function assessmentDigest(Assessment memory assessment) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                assessment.regime,
                assessment.reserveBps,
                assessment.confidenceBps,
                assessment.epoch,
                assessment.reasonCodesHash,
                assessment.evidenceRoot,
                assessment.featureHash,
                assessment.modelVersion,
                assessment.policyVersion
            )
        );
    }

    function _validateAssessment(Assessment calldata assessment) private view {
        uint8 regimeIndex = uint8(assessment.regime);
        if (regimeIndex > uint8(Regime.Crisis)) revert InvalidRegime(regimeIndex);
        uint16 expectedReserve = reserveBands[regimeIndex];
        if (assessment.reserveBps != expectedReserve) {
            revert ReserveOutsidePolicy(expectedReserve, assessment.reserveBps);
        }
        if (assessment.confidenceBps < minimumConfidenceBps) {
            revert InvalidConfidence(minimumConfidenceBps, assessment.confidenceBps);
        }
        if (assessment.epoch < activeEpoch) {
            revert StaleEvidenceEpoch(activeEpoch, assessment.epoch);
        }

        bytes32 checkpointRoot = evidence.checkpointRoots(assessment.epoch);
        if (checkpointRoot == bytes32(0)) revert UnknownEvidence(assessment.epoch);
        if (checkpointRoot != assessment.evidenceRoot) {
            revert EvidenceRootMismatch(checkpointRoot, assessment.evidenceRoot);
        }
        if (assessment.modelVersion != modelVersion) {
            revert ModelVersionMismatch(modelVersion, assessment.modelVersion);
        }
        if (assessment.policyVersion != policyVersion) {
            revert PolicyVersionMismatch(policyVersion, assessment.policyVersion);
        }
        bytes32 expectedDecisionHash = assessmentDigest(assessment);
        if (assessment.decisionHash != expectedDecisionHash) {
            revert DecisionHashMismatch(expectedDecisionHash, assessment.decisionHash);
        }
        if (usedDecisions[assessment.decisionHash]) {
            revert DecisionAlreadyUsed(assessment.decisionHash);
        }
    }

    function _applyIncrease(Assessment calldata assessment) private {
        activeRegime = assessment.regime;
        activeReserveBps = assessment.reserveBps;
        activeEvidenceRoot = assessment.evidenceRoot;
        activeEpoch = assessment.epoch;
        emit ReserveIncreased(
            assessment.decisionHash, assessment.regime, assessment.reserveBps, assessment.epoch, assessment.evidenceRoot
        );
    }
}
