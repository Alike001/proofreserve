# AI-sensitive decision evidence

ProofReserve's second public evidence epoch demonstrates a financial decision that its disclosed deterministic baseline does not make by itself.

## The plain-language scenario

The portfolio has four successful repayments worth 10 units each and two late repayments worth 250 units each. The late borrowers belong to separate groups, so a simple correlation rule does not fire. At the pinned Creditcoin observation block, 60% of the pool was committed.

A count-based view sees four successes and two late payments and returns `WATCH`. Gemini compares the severity of the amounts as well as the counts: 500 units are late while only 40 units are settled. It recommends `STRESS`, and the Creditcoin contract independently accepts only the corresponding policy-approved 40% reserve band.

## Reproducible decision

| Item | Public result |
| --- | --- |
| Source epoch | 2 on Ethereum Sepolia |
| Attestcoin facts | 6 repayment facts and 1 checkpoint |
| Evidence root | `0xe5efddc65815b4fd172ecbd616b15f40ead7dc93e61c21b33c13d14a5db41948` |
| Pinned Creditcoin block | `5463254` |
| Deterministic baseline | `WATCH` / 20% reserve |
| Gemini result | `STRESS` / 40% reserve / 82% confidence |
| Inference mode | `GEMINI` |
| Decision hash | `0x52217ce7527782799270050baf978ba31588bd2252b04eb4e1b505d2731ee411` |
| Creditcoin enforcement | [`0xfc25…c83e`](https://creditcoin-testnet.blockscout.com/tx/0xfc25a12816d9967db8c414832c0f0771e4fd7ae013d055bc586ef39c7fc8c83e) |

The temporary utilization commitment was created in [CC3 transaction `0xe293…d8ec`](https://creditcoin-testnet.blockscout.com/tx/0xe293b51786b46ca04fee98a0f40e58d5e25a306824a99fec8ef3fa8667eed8ec) and cancelled in [`0x06dd…be9c`](https://creditcoin-testnet.blockscout.com/tx/0x06dd8880ffb3809a2a63cb9c45d2b3831c51242fcb65b16654307d405e82be9c). The assessment remains bound to block `5463254`, while the public pool has been restored to zero commitments and 60 prUSD lendable.

Run `pnpm verify:live` from the repository root to audit this complete path using public RPC reads. It does not need a wallet, signer secret, or Gemini API key.

## Attestcoin proof trail

| Fact | Sepolia transaction | Creditcoin acceptance |
| --- | --- | --- |
| Settled 1 | [`0xb40c…3027`](https://sepolia.etherscan.io/tx/0xb40c772fa0196aa02eb830ee8401ccf16f33a24d3602aa57f5d821bbfc503027) | [`0x61c5…2b28`](https://creditcoin-testnet.blockscout.com/tx/0x61c5acb027f7383ce66085a0b20d3afa4011d485f6eefb7ba6c49391d1d92b28) |
| Settled 2 | [`0xa016…5676`](https://sepolia.etherscan.io/tx/0xa01695a929888af7788aef02bd5e44bad4847caf099bb4f6010657ccb52f5676) | [`0x1101…1453`](https://creditcoin-testnet.blockscout.com/tx/0x11019e704a2ee7bd124e22d63117e8d1c218aa1e51c4aaead747d91596c91453) |
| Settled 3 | [`0x1784…5979`](https://sepolia.etherscan.io/tx/0x1784c6d7f0d8aee805b3b04a67d71f30a7fa5a970db3a46035c25803b08b5979) | [`0x0ce2…052d`](https://creditcoin-testnet.blockscout.com/tx/0x0ce2ef6a48cf7ba6e4300a0ec56e8b7a6bee8d0e481078ad2ff9ce8085f4052d) |
| Settled 4 | [`0xef69…11db`](https://sepolia.etherscan.io/tx/0xef69df097cff94fa6ac5556766665e0a3cfd7048444694ad45081683d4b311db) | [`0x7911…e03c`](https://creditcoin-testnet.blockscout.com/tx/0x7911776ca9a72893bf8649605fda870e4005274126fd392b94e5232472b2e03c) |
| Late 1 | [`0xf722…5740`](https://sepolia.etherscan.io/tx/0xf722c36ba0d3e08cfb663d36f31bc84d585d41b4b6808dada2f01c8d404a5740) | [`0xc070…cc95`](https://creditcoin-testnet.blockscout.com/tx/0xc07094cd0492ba41443911c2ad57276f65a21ea1b46921dca94de28409ffcc95) |
| Late 2 | [`0xae5f…d9f`](https://sepolia.etherscan.io/tx/0xae5fbeece0ba514969128ad09c75231156f9430278689eb87558b10198325d9f) | [`0x6ba4…8af7`](https://creditcoin-testnet.blockscout.com/tx/0x6ba4d327bd7b0c209fb33a1103137e5ef9d871a402b922a8b45bda4cb0b28af7) |
| Checkpoint | [`0x1444…37e9`](https://sepolia.etherscan.io/tx/0x144459103732bf1039211051259180bfcfc9c23099c4fd7d74f8a1d4ab3037e9) | [`0x2ab3…44d6`](https://creditcoin-testnet.blockscout.com/tx/0x2ab3e807d2c9d4139587169f3722087b7aaa58b5566643b9e0ae5ebb9ef844d6) |

## Saved artifacts

- Scenario inputs: [`deployments/scenario-epoch-2-ai.json`](../deployments/scenario-epoch-2-ai.json)
- Attestcoin source/acceptance pairs: [`deployments/attestcoin-proofs-epoch-2.json`](../deployments/attestcoin-proofs-epoch-2.json)
- Pinned reviewed assessment: [`deployments/risk-assessment-epoch-2.json`](../deployments/risk-assessment-epoch-2.json)
- Creditcoin submission receipt: [`deployments/risk-submission-epoch-2.json`](../deployments/risk-submission-epoch-2.json)
- Temporary utilization and cleanup: [`deployments/ai-utilization.json`](../deployments/ai-utilization.json)

No private API key or signer secret is contained in these artifacts.
