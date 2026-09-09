# Public Testnet Evidence

ProofReserve's canonical hackathon demonstration is live on Ethereum Sepolia and Creditcoin CC3 Testnet. Every address, source event, Attestcoin acceptance, AI artifact, enforcement transaction, and capacity snapshot below is public and reproducible.

## Deployments

| Component | Network | Address |
| --- | --- | --- |
| SourceLoanBook | Sepolia | [`0xD5CC…0A4b`](https://sepolia.etherscan.io/address/0xD5CC39ab46B923Cc4F40CB919BE971c0529b0A4b) |
| ProofReserveEvidence | Creditcoin CC3 | [`0xCd14…659a`](https://creditcoin-testnet.blockscout.com/address/0xCd144E5C8FCB6b9b9C4fddC55C660A131C99659a) |
| ReserveController | Creditcoin CC3 | [`0xd7D5…6be9`](https://creditcoin-testnet.blockscout.com/address/0xd7D5e7d923407B9D4c40ec275F0a6AA6D87C6be9) |
| TestAsset (`prUSD`) | Creditcoin CC3 | [`0x447c…0e12`](https://creditcoin-testnet.blockscout.com/address/0x447cE53AEC6c1BA488a07b21C96afBd22f540e12) |
| ProofReservePool | Creditcoin CC3 | [`0x8305…714D`](https://creditcoin-testnet.blockscout.com/address/0x8305921B241cAEC35750d9532B22210802e9714D) |

The evidence registry is bound to Sepolia chain key `1`, the source loan-book address above, portfolio ID `0x5da0382070fc14e51c84ffcc8b30a705a64b12f7bc4adb46f1651ef00a587db0`, and Creditcoin's native Attestcoin verifier at `0x0000000000000000000000000000000000000FD2`.

## Attestcoin proof trail

Epoch 1 contains four settled payments, two late payments from related borrowers, and one checkpoint. The checkpoint commits to all six facts under root `0x89e111fc3fd81620221c994b8ec9e754d35a977ab2ea2813809ea233ecd20e06`.

| Fact | Sepolia source transaction | CC3 Attestcoin acceptance |
| --- | --- | --- |
| Settled 1 | [`0x17be…cfd7`](https://sepolia.etherscan.io/tx/0x17bebbb2667fd011af35f8fde76f0f51b59f57a0f0066d687b929f27a8b9cfd7) | [`0xbb23…697d`](https://creditcoin-testnet.blockscout.com/tx/0xbb2357e273a0f54d07cf14b50c8afe43a7748abc656c336d4ef8b02ff738697d) |
| Settled 2 | [`0x4be5…65d2`](https://sepolia.etherscan.io/tx/0x4be5211a82fac3221ba0fbcaf27b56b5dd954208a9907a689bf0890a316565d2) | [`0x4170…4582`](https://creditcoin-testnet.blockscout.com/tx/0x4170ff70a1397f6ac383d22d9fba40ed7e3d8446ce7f00ed3fb1a454a25c4582) |
| Settled 3 | [`0x19ca…0161`](https://sepolia.etherscan.io/tx/0x19cae9e2800dc8627f638b0ee1cbd6c42a7097794902c6858e39cfd11b780161) | [`0xccf3…ef1e`](https://creditcoin-testnet.blockscout.com/tx/0xccf385747c77e92e8a240f1cf3a755d5536f3818bffaace18b5a55b6724aef1e) |
| Settled 4 | [`0x1e77…ca66`](https://sepolia.etherscan.io/tx/0x1e7720cf2570e1a9fc3e6ffbf49d9e53cae92f8f7541c92623c5bc1b3c26ca66) | [`0xde4b…3ac8`](https://creditcoin-testnet.blockscout.com/tx/0xde4b9cee0c8b7af433d90dc64d818becb7de10c4dd92e1b67101d0c7c2c83ac8) |
| Late 1 | [`0x8400…df5c`](https://sepolia.etherscan.io/tx/0x8400a9dba6cbe28a39a40fca2ae81d15993d62b1c83ff94642d29b976238df5c) | [`0x990f…db36`](https://creditcoin-testnet.blockscout.com/tx/0x990f0604e499a9714d49ad6ea7a27984cfa888af09957c4326ff81720053db36) |
| Late 2 | [`0x7ee5…4b7e`](https://sepolia.etherscan.io/tx/0x7ee56ae314dde6e647bc2a8890f4a3c1aa7bc1971cb23d130085709f74744b7e) | [`0x932a…c5db`](https://creditcoin-testnet.blockscout.com/tx/0x932addb4fa262230acee3112599d1d97411f3fd8f013018531cc41e1f1bec5db) |
| Checkpoint 1 | [`0x73ad…7489`](https://sepolia.etherscan.io/tx/0x73ad73bb4bc990e84328951f79c1d0827b91263f87d9218c6672567b75227489) | [`0x7aea…0d93`](https://creditcoin-testnet.blockscout.com/tx/0x7aea93dd9cb3f47de845bb8c66b791fd1fb4226e68fa1e9102b0546995f50d93) |

Machine-readable source block numbers, query IDs, destination blocks, and full hashes are in [`deployments/attestcoin-proofs.json`](../deployments/attestcoin-proofs.json).

## AI decision and financial enforcement

Gemini evaluated the canonical six-fact feature set and returned:

- regime: `STRESS`;
- confidence: `8500` basis points;
- reasons: `CORRELATED_LATENESS` and `GROUP_CONCENTRATION`; and
- recommended policy band: `4000` basis points.

The reviewed artifact is saved in [`deployments/risk-assessment.json`](../deployments/risk-assessment.json). The risk agent submitted that exact artifact in [CC3 transaction `0x300b…7126`](https://creditcoin-testnet.blockscout.com/tx/0x300b1ad4e7f51da215b0630f370a73bef030c0e8c1e26ed80192e2cd8da77126). The controller independently verified its evidence root, epoch, confidence, model version, policy version, finite reserve band, agent identity, decision hash, and replay state.

The observable financial result is:

| State | Protected reserve | Lendable | 70 prUSD request |
| --- | ---: | ---: | --- |
| Before | 10 prUSD | 90 prUSD | Allowed |
| After | 40 prUSD | 60 prUSD | Blocked by `InsufficientLendable` |

The read-only before/after contract simulations are saved in [`deployments/capacity-before.json`](../deployments/capacity-before.json) and [`deployments/capacity-after.json`](../deployments/capacity-after.json).

## Deployment-rehearsal disclosure

During live pipeline validation, an earlier call to `risk:submit` independently recomputed the assessment and encountered the risk engine's safe deterministic fallback. It submitted the same `STRESS`/40% policy outcome in [CC3 transaction `0x021e…7390`](https://creditcoin-testnet.blockscout.com/tx/0x021e66f5d2346f63508a916c263f5a2acc3ef9a4d7ed037cffa3e45f978d7390). No unsafe reduction or transfer occurred.

That rehearsal revealed an auditability weakness: preview and submission could use two different model calls. The workflow was changed so preview writes a hash-validated, block-pinned artifact and submission reads that exact artifact without calling Gemini again. The later `0x300b…7126` transaction is the canonical judged decision.
