# Third-Party Notices

ProofReserve's application code is original hackathon work. It depends on, but does not vendor or claim authorship of, the following packages:

- `@gluwa/usc-sdk` 0.18.0 — Attestcoin proof construction and attestation waiting;
- `@gluwa/asc-contracts` 0.2.1 — native verifier interface and EVM receipt decoder;
- `@openzeppelin/contracts` 5.4.0 — ownership, reentrancy protection, ERC-20 interfaces, and safe token transfers;
- `ethers` 6.17.0 — EVM JSON-RPC and contract interaction;
- `tsx` 4.22.4 and TypeScript 6.0.2 — worker development tooling.

The official [`gluwa/attestcoin-protocol-examples`](https://github.com/gluwa/attestcoin-protocol-examples) repository was studied to confirm the supported proof flow and security checks. ProofReserve uses its published package interfaces and independently written product contracts rather than copying an example application.

Transitive notices and exact resolved versions are retained in `pnpm-lock.yaml` and installed package metadata.
