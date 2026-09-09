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

Validate every public endpoint, chain ID, signer role, balance, Attestcoin source-chain registration, and proof-builder response without sending a transaction:

    pnpm preflight:testnet

The preflight prints public addresses and testnet balances but never prints private keys. It also requires the Creditcoin deployer, Attestcoin worker, and risk agent to be separate accounts and verifies that `RISK_AGENT_ADDRESS` matches `RISK_AGENT_PRIVATE_KEY`.

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

Capture the pool's normal-state capacity before publishing stress evidence:

    pnpm capacity:check before

This is a read-only `eth_call` made as the pool owner. It does not create a commitment or require a private key. The command records the pool/controller state and simulates the configured 70 prUSD request against the actual `commitLoan` function in `deployments/capacity-before.json`. In the intended initial state the contract allows the request because 90 prUSD is lendable.

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

`risk:preview` will not sign a transaction. It reconstructs the accepted facts, asks Gemini for a constrained assessment, and writes the exact reviewed assessment to `deployments/risk-assessment.json`. After checking it:

    pnpm risk:submit

`risk:submit` reads that saved artifact instead of calling Gemini again. It recomputes the artifact hashes, reconstructs the canonical features at its pinned Creditcoin block, and refuses a deterministic fallback by default. The Creditcoin contract then independently checks the evidence epoch, model and policy versions, confidence floor, reserve band, agent identity, and replay protection. The AI cannot directly transfer assets or invent a reserve percentage.

Capture the enforced post-decision capacity:

    pnpm capacity:check after

The same read-only contract simulation should now record `BLOCKED` in `deployments/capacity-after.json`: the STRESS policy protects 40 prUSD, leaves 60 prUSD lendable, and the pool's own `InsufficientLendable` error rejects the 70 prUSD request.

## 7. Verify before operating

Run the full local suite before any deployment and again before recording the demo:

    pnpm check

## Current verification

The complete flow was executed publicly on 2026-09-10. The source loan book is deployed on Sepolia; the evidence registry, reserve controller, test asset, and pool are deployed on CC3. Six payment facts—four settled and two late—plus their checkpoint were processed as seven native Attestcoin proofs, a reviewed Gemini `STRESS` assessment was submitted, the protected reserve moved from 10% to 40%, and the pool rejected a 70 prUSD request after allowing it in the normal state.

See [the public testnet evidence](./testnet-evidence.md) and the machine-readable JSON files under `deployments/` for addresses, source transactions, proof acceptances, decision artifacts, and before/after capacity snapshots.
