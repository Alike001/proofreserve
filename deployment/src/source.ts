import {id} from "ethers";

import {
  deployContract,
  deploymentContext,
  environmentInteger,
  writeManifest
} from "./common.js";

const expectedChainId = environmentInteger("SOURCE_CHAIN_ID", 11_155_111);
const confirmations = environmentInteger("SOURCE_DEPLOY_CONFIRMATIONS", 1);
if (confirmations === 0) throw new Error("SOURCE_DEPLOY_CONFIRMATIONS must be positive");

const portfolioLabel = process.env.PORTFOLIO_LABEL?.trim() || "proofreserve-demo-v1";
const portfolioId = id(portfolioLabel);
const {signer, chainId} = await deploymentContext(
  "SOURCE_CHAIN_RPC_URL",
  "SOURCE_DEPLOYER_PRIVATE_KEY",
  expectedChainId
);

const sourceLoanBook = await deployContract(
  "SourceLoanBook",
  "SourceLoanBook",
  signer,
  [portfolioId],
  confirmations
);
const manifestPath = process.env.SOURCE_DEPLOYMENT_MANIFEST?.trim() || "deployments/sepolia.json";
await writeManifest(manifestPath, {
  schemaVersion: 1,
  environment: "ethereum-sepolia",
  chainId,
  sourceChainKey: environmentInteger("SOURCE_CHAIN_KEY", 1),
  portfolioLabel,
  portfolioId,
  deployer: await signer.getAddress(),
  contracts: {sourceLoanBook}
});

console.log(JSON.stringify({manifestPath, sourceLoanBook, portfolioId}, null, 2));
