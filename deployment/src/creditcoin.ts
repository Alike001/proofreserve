import {getAddress, id} from "ethers";

import {DEFAULT_POLICY, versionHash} from "../../risk/src/policy.js";
import {
  deployContract,
  deploymentContext,
  environmentInteger,
  required,
  writeManifest
} from "./common.js";

const expectedChainId = environmentInteger("CREDITCOIN_CHAIN_ID", 102_031);
const confirmations = environmentInteger("CREDITCOIN_DEPLOY_CONFIRMATIONS", 1);
if (confirmations === 0) throw new Error("CREDITCOIN_DEPLOY_CONFIRMATIONS must be positive");

const portfolioLabel = process.env.PORTFOLIO_LABEL?.trim() || "proofreserve-demo-v1";
const portfolioId = id(portfolioLabel);
const sourceEmitter = getAddress(required("SOURCE_LOAN_BOOK_ADDRESS"));
const riskAgent = getAddress(required("RISK_AGENT_ADDRESS"));
const {signer, chainId} = await deploymentContext(
  "CREDITCOIN_RPC_URL",
  "CREDITCOIN_DEPLOYER_PRIVATE_KEY",
  expectedChainId
);

const evidence = await deployContract(
  "ProofReserveEvidence",
  "ProofReserveEvidence",
  signer,
  [environmentInteger("SOURCE_CHAIN_KEY", 1), sourceEmitter, portfolioId],
  confirmations
);
const reserveBands = [
  DEFAULT_POLICY.reserveBps.NORMAL,
  DEFAULT_POLICY.reserveBps.WATCH,
  DEFAULT_POLICY.reserveBps.STRESS,
  DEFAULT_POLICY.reserveBps.CRISIS
] as const;
const controller = await deployContract(
  "ReserveController",
  "ReserveController",
  signer,
  [
    evidence.address,
    riskAgent,
    reserveBands[0],
    reserveBands[3],
    DEFAULT_POLICY.minimumModelConfidenceBps,
    environmentInteger("RESERVE_DECREASE_DELAY_SECONDS", 86_400),
    reserveBands,
    versionHash(DEFAULT_POLICY.modelVersionLabel),
    versionHash(DEFAULT_POLICY.policyVersionLabel)
  ],
  confirmations
);

const testAsset = await deployContract(
  "TestAsset",
  "TestAsset",
  signer,
  [await signer.getAddress()],
  confirmations
);
const pool = await deployContract(
  "ProofReservePool",
  "ProofReservePool",
  signer,
  [testAsset.address, controller.address],
  confirmations
);

const manifestPath = process.env.CREDITCOIN_DEPLOYMENT_MANIFEST?.trim() || "deployments/cc3-testnet.json";
await writeManifest(manifestPath, {
  schemaVersion: 1,
  environment: "creditcoin-cc3-testnet",
  chainId,
  sourceChainKey: environmentInteger("SOURCE_CHAIN_KEY", 1),
  portfolioLabel,
  portfolioId,
  deployer: await signer.getAddress(),
  sourceEmitter,
  riskAgent,
  contracts: {
    evidence,
    controller,
    testAsset,
    pool
  },
  evidenceDeploymentBlock: evidence.blockNumber,
  policy: {
    reserveBands,
    minimumModelConfidenceBps: DEFAULT_POLICY.minimumModelConfidenceBps,
    decreaseDelaySeconds: environmentInteger("RESERVE_DECREASE_DELAY_SECONDS", 86_400),
    modelVersion: versionHash(DEFAULT_POLICY.modelVersionLabel),
    policyVersion: versionHash(DEFAULT_POLICY.policyVersionLabel)
  }
});

console.log(JSON.stringify({manifestPath, evidence, controller, testAsset, pool}, null, 2));
