# Testnet Deployment

ProofReserve deploys one source contract to Ethereum Sepolia and four product contracts to Creditcoin CC3 Testnet. Both deployment commands validate the connected chain before sending anything and write public addresses, transaction hashes, block numbers, and policy versions to JSON manifests.

## Secret roles

Use dedicated, faucet-funded testnet accounts:

- SOURCE_DEPLOYER_PRIVATE_KEY deploys and initially reports to the Sepolia loan book.
- CREDITCOIN_DEPLOYER_PRIVATE_KEY owns the Creditcoin controller, pool, and test asset.
- CREDITCOIN_WORKER_PRIVATE_KEY submits Attestcoin evidence only.
- RISK_AGENT_PRIVATE_KEY submits reserve assessments only.

The public address corresponding to the last key is supplied as RISK_AGENT_ADDRESS when deploying the controller. The keys belong only in the ignored .env file or a proper secret manager. Never commit them, paste them into chat, or use a wallet holding production assets.

## 1. Prepare

    cp .env.example .env
    pnpm install
    pnpm build:contracts

Configure the RPC endpoints, dedicated testnet accounts, and RISK_AGENT_ADDRESS. Fund the source deployer with Sepolia test ETH and the Creditcoin deployer with CC3 test CTC.

## 2. Deploy the source loan book

    pnpm deploy:source

The command targets Sepolia chain ID 11155111 by default and writes deployments/sepolia.json. Copy its contracts.sourceLoanBook.address into SOURCE_LOAN_BOOK_ADDRESS.

## 3. Deploy the Creditcoin product

    pnpm deploy:creditcoin

The command targets CC3 chain ID 102031 and writes deployments/cc3-testnet.json. Copy these manifest values into .env:

    EVIDENCE_REGISTRY_ADDRESS = contracts.evidence.address
    RESERVE_CONTROLLER_ADDRESS = contracts.controller.address
    POOL_ADDRESS = contracts.pool.address
    EVIDENCE_DEPLOYMENT_BLOCK = evidenceDeploymentBlock

The manifest also records the TestAsset address, model and policy hashes, reserve bands, agent address, source emitter, and every deployment transaction.

## 4. Register the demo portfolio and fund the pool

After copying all deployed addresses into .env, run:

    pnpm setup:testnet

This registers three demonstration borrowers on both chains. Two borrowers deliberately share one group so the risk agent can detect correlated deterioration rather than treating every late payment as an isolated event. The command also mints and deposits 100 prUSD into the Creditcoin pool. It is safe to rerun when the existing configuration matches.

## 5. Publish the source-chain stress scenario

    pnpm scenario:stress

This creates six Sepolia obligations, records four on-time settlements and two late payments from borrowers in the same group, then closes epoch 1. The resulting manifest contains the seven source transaction hashes that must be submitted to Attestcoin: six financial facts plus the checkpoint.

Enqueue every value in `attestcoinSourceTransactionHashes`, in order:

    pnpm worker:enqueue <source-transaction-hash>
    pnpm worker:run

The worker generates and verifies a native Attestcoin proof for each source transaction before the Creditcoin evidence contract accepts it. Repeat enqueue and run for all seven hashes.

## 6. Preview and submit the reserve decision

Run the full local suite, then inspect the deployed bytecode and public manifest values before registering borrowers or transferring test assets:

    pnpm risk:preview

`risk:preview` will not sign a transaction. It reconstructs the accepted facts, asks Gemini for a constrained assessment, and shows the exact assessment the controller would receive. After checking it:

    pnpm risk:submit

The Creditcoin contract independently checks the evidence epoch, model and policy versions, confidence floor, reserve band, agent identity, and replay protection. The AI cannot directly transfer assets or invent a reserve percentage.

## 7. Verify before operating

Run the full local suite before any deployment and again before recording the demo:

    pnpm check

## Current verification

Both deployment scripts were exercised against a disposable local EVM chain. The smoke test deployed the source loan book, evidence registry, reserve controller, test asset, and pool, and produced both manifests. No Sepolia or CC3 deployment is claimed until public testnet transaction hashes exist.
