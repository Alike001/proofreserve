import {useEffect, useState, type FormEvent} from "react";

import {ArrowIcon, CheckIcon, ExternalIcon, LockIcon} from "../icons";
import {
  DEFAULT_MANAGER_BORROWER,
  cancelPoolLoan,
  commitPoolLoan,
  connectPoolManager,
  injectedWallet,
  managerErrorMessage,
  managerExplorerUrl,
  preflightPoolCommitment,
  type ManagerState
} from "../manager";
import {formatNumber, shortHash} from "../data";

type ManagerPhase = "disconnected" | "connecting" | "ready" | "checking" | "approved" | "submitting" | "success" | "error";

export function ManagerDesk({onStateChange}: {onStateChange: (state: ManagerState) => void}) {
  const [borrower, setBorrower] = useState(DEFAULT_MANAGER_BORROWER);
  const [amount, setAmount] = useState("50");
  const [connection, setConnection] = useState<ManagerState | null>(null);
  const [phase, setPhase] = useState<ManagerPhase>("disconnected");
  const [message, setMessage] = useState("Connect the funded Creditcoin pool-owner wallet to begin.");
  const [transactionHash, setTransactionHash] = useState("");
  const [transactionKind, setTransactionKind] = useState<"committed" | "cancelled" | null>(null);

  useEffect(() => {
    const provider = injectedWallet();
    if (!provider?.on) return;
    const reset = () => {
      setConnection(null);
      setPhase("disconnected");
      setMessage("Wallet account or network changed. Reconnect to continue safely.");
      setTransactionHash("");
      setTransactionKind(null);
    };
    provider.on("accountsChanged", reset);
    provider.on("chainChanged", reset);
    return () => {
      provider.removeListener?.("accountsChanged", reset);
      provider.removeListener?.("chainChanged", reset);
    };
  }, []);

  const busy = phase === "connecting" || phase === "checking" || phase === "submitting";

  async function connect() {
    setPhase("connecting");
    setMessage("Connecting and checking the CC3 pool owner…");
    try {
      const next = await connectPoolManager(borrower);
      setConnection(next);
      onStateChange(next);
      setPhase("ready");
      setMessage(next.authorized
        ? "Owner verified. Run the contract preflight before signing a commitment."
        : `Viewer wallet connected. Switch to pool owner ${shortAddress(next.owner)} to write.`);
    } catch (error) {
      setPhase("error");
      setMessage(managerErrorMessage(error));
    }
  }

  function editBorrower(value: string) {
    setBorrower(value);
    setPhase(connection ? "ready" : "disconnected");
    setMessage(connection ? "Borrower changed. Run a new contract preflight." : message);
    setTransactionHash("");
    setTransactionKind(null);
  }

  function editAmount(value: string) {
    setAmount(value);
    setPhase(connection ? "ready" : "disconnected");
    setMessage(connection ? "Amount changed. Run a new contract preflight." : message);
    setTransactionHash("");
    setTransactionKind(null);
  }

  async function preflight(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPhase("checking");
    setMessage("Simulating commitLoan against the live Creditcoin contract…");
    try {
      const next = await preflightPoolCommitment(borrower, amount);
      setConnection(next);
      onStateChange(next);
      setPhase("approved");
      setMessage(`${amount} prUSD fits inside the current ${formatNumber(next.lendable)} prUSD lendable capacity.`);
    } catch (error) {
      setPhase("error");
      setMessage(managerErrorMessage(error));
    }
  }

  async function commit() {
    setPhase("submitting");
    setMessage("Confirm the commitment in your wallet, then wait for one CC3 confirmation.");
    try {
      const result = await commitPoolLoan(borrower, amount);
      setConnection(result.state);
      onStateChange(result.state);
      setTransactionHash(result.transactionHash);
      setTransactionKind("committed");
      setPhase("success");
      setMessage(`Commitment confirmed in CC3 block ${result.blockNumber.toLocaleString()}. No pool funds moved.`);
    } catch (error) {
      setPhase("error");
      setMessage(managerErrorMessage(error));
    }
  }

  async function cancel() {
    if (!connection || Number(connection.borrowerCommitment) <= 0) return;
    setPhase("submitting");
    setMessage("Confirm cancellation to restore the pool's lendable capacity.");
    try {
      const result = await cancelPoolLoan(connection.borrower, connection.borrowerCommitment);
      setConnection(result.state);
      onStateChange(result.state);
      setTransactionHash(result.transactionHash);
      setTransactionKind("cancelled");
      setPhase("success");
      setMessage(`Cancellation confirmed in CC3 block ${result.blockNumber.toLocaleString()}. Capacity was restored.`);
    } catch (error) {
      setPhase("error");
      setMessage(managerErrorMessage(error));
    }
  }

  const canPreflight = Boolean(connection?.authorized) && !busy;
  const canCommit = phase === "approved" && Boolean(connection?.authorized);
  const canCancel = Boolean(connection?.authorized && Number(connection.borrowerCommitment) > 0) && !busy;
  const hasCommitment = Boolean(connection && Number(connection.borrowerCommitment) > 0);

  return (
    <section className="manager-desk" id="manager">
      <header className="manager-desk__header">
        <div><h2>Pool manager desk</h2><p>Reserve capacity for an approved borrower without moving funds.</p></div>
        <span className={`manager-access manager-access--${connection?.authorized ? "owner" : "viewer"}`}><i />{connection?.authorized ? "Owner wallet verified" : connection ? "Viewer wallet" : "Wallet required"}</span>
      </header>
      <div className="manager-desk__body">
        <form className="manager-form" onSubmit={(event) => void preflight(event)}>
          <div className="manager-form__account">
            <span>Connected account</span>
            <strong>{connection ? shortAddress(connection.account) : "Not connected"}</strong>
            <button type="button" onClick={() => void connect()} disabled={busy}>{connection ? "Reconnect" : "Connect owner wallet"}</button>
          </div>
          <label htmlFor="manager-borrower">Borrower address</label>
          <input id="manager-borrower" value={borrower} onChange={(event) => editBorrower(event.target.value)} spellCheck="false" disabled={hasCommitment} />
          <div className="manager-form__amounts">
            <label htmlFor="manager-amount"><span>Commitment amount</span><div><input id="manager-amount" value={amount} inputMode="decimal" onChange={(event) => editAmount(event.target.value)} disabled={hasCommitment} /><b>prUSD</b></div></label>
            <span><small>Live lendable</small><strong>{connection ? formatNumber(connection.lendable) : "—"} prUSD</strong></span>
            <span><small>This borrower</small><strong>{connection ? formatNumber(Number(connection.borrowerCommitment)) : "—"} committed</strong></span>
          </div>
          <button className="manager-preflight" type="submit" disabled={!canPreflight}>{phase === "checking" ? "Checking contract…" : "Run contract preflight"}<ArrowIcon /></button>
        </form>

        <div className="manager-execution">
          <div className="manager-steps">
            <ManagerStep number="1" label="Wallet authority" complete={Boolean(connection?.authorized)} />
            <ManagerStep number="2" label="Contract preflight" complete={phase === "approved" || phase === "success"} />
            <ManagerStep number="3" label="CC3 confirmation" complete={phase === "success"} />
          </div>
          <div className={`manager-message manager-message--${phase}`} role="status"><span>{phase === "approved" || phase === "success" ? <CheckIcon /> : <LockIcon />}</span><div><strong>{phase === "approved" ? "Ready to commit" : phase === "success" ? (transactionKind === "cancelled" ? "Capacity restored" : "Loan capacity reserved") : phase === "error" ? "Action needs attention" : "Protected manager action"}</strong><p>{message}</p></div></div>
          <div className="manager-actions">
            <button className="manager-commit" type="button" onClick={() => void commit()} disabled={!canCommit}>{phase === "submitting" ? "Waiting for CC3…" : "Commit loan on CC3"}<ArrowIcon /></button>
            <button className="manager-cancel" type="button" onClick={() => void cancel()} disabled={!canCancel}>Cancel current commitment</button>
          </div>
          {transactionHash && <a className="manager-transaction" href={managerExplorerUrl(transactionHash)} target="_blank" rel="noreferrer"><span>{transactionKind === "cancelled" ? "Cancellation" : "Commitment"} transaction</span><code>{shortHash(transactionHash)}</code><ExternalIcon /></a>}
          <p className="manager-warning">Testnet only. A commitment reduces lendable capacity but cannot transfer pool funds; cancel it after testing.</p>
        </div>
      </div>
    </section>
  );
}

function ManagerStep({number, label, complete}: {number: string; label: string; complete: boolean}) {
  return <span className={`manager-step ${complete ? "manager-step--complete" : ""}`}><i>{complete ? <CheckIcon /> : number}</i><b>{label}</b></span>;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
