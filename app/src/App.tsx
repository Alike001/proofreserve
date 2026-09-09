import {useEffect, useState} from "react";

import {AuditLedger} from "./components/AuditLedger";
import {Header} from "./components/Header";
import {ReserveShift} from "./components/ReserveShift";
import {Workflow} from "./components/Workflow";
import {
  hasLiveConfiguration,
  loadDashboardSnapshot,
  previewSnapshot,
  type DashboardSnapshot
} from "./data";
import {ArrowIcon, ExternalIcon} from "./icons";

type VerificationState = "idle" | "checking" | "verified" | "error";

export function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(previewSnapshot);
  const [activeSection, setActiveSection] = useState("Overview");
  const [verification, setVerification] = useState<VerificationState>("idle");
  const [message, setMessage] = useState("");
  const explorerBaseUrl = import.meta.env.VITE_CC3_EXPLORER_TX_URL?.trim() || "";

  useEffect(() => {
    if (hasLiveConfiguration()) void refreshSnapshot(false);
  }, []);

  async function refreshSnapshot(announce: boolean) {
    if (announce) setVerification("checking");
    try {
      const next = await loadDashboardSnapshot();
      validateSnapshot(next);
      setSnapshot(next);
      if (announce) {
        setVerification("verified");
        setMessage(next.mode === "live" ? `Verified against CC3 at epoch ${next.epoch}.` : "Preview relationships verified locally.");
      }
    } catch (error) {
      setVerification("error");
      setMessage(error instanceof Error ? error.message : "Unable to verify the current snapshot.");
    }
  }

  function navigate(section: string) {
    setActiveSection(section);
    document.getElementById(section.toLowerCase())?.scrollIntoView({behavior: "smooth", block: "start"});
  }

  const transactionUrl = explorerBaseUrl && snapshot.reserveTransactionHash
    ? `${explorerBaseUrl}${snapshot.reserveTransactionHash}`
    : "";

  return (
    <div className="app-shell">
      <Header activeSection={activeSection} mode={snapshot.mode} onNavigate={navigate} />
      <main className="dashboard" id="overview">
        <Hero snapshot={snapshot} />
        <Workflow snapshot={snapshot} />
        <div id="decisions">
          <AuditLedger records={snapshot.records} explorerBaseUrl={explorerBaseUrl} />
        </div>
        <Actions
          state={verification}
          message={message}
          transactionUrl={transactionUrl}
          onVerify={() => void refreshSnapshot(true)}
        />
      </main>
    </div>
  );
}

function validateSnapshot(snapshot: DashboardSnapshot) {
  if (snapshot.factCount !== snapshot.settledCount + snapshot.lateCount + snapshot.lossCount) {
    throw new Error("Fact totals do not reconcile.");
  }
  if (snapshot.reservePercent < 0 || snapshot.reservePercent > 100 || snapshot.lendable < 0) {
    throw new Error("Reserve capacity is outside valid bounds.");
  }
}

function Hero({snapshot}: {snapshot: DashboardSnapshot}) {
  return (
    <section className="hero">
      <div className="hero__copy">
        <h1>Protect a lending pool before defaults spread.</h1>
        <p>On-chain repayment facts from Attestcoin, interpreted by Gemini, with automatic reserve enforcement on Creditcoin.</p>
        <Status snapshot={snapshot} />
      </div>
      <ReserveShift snapshot={snapshot} />
    </section>
  );
}

function Status({snapshot}: {snapshot: DashboardSnapshot}) {
  const active = snapshot.regime === "STRESS" || snapshot.regime === "CRISIS";
  return (
    <div className={active ? "protection-status protection-status--active" : "protection-status"}>
      <span className="protection-status__dot" />
      <strong>{active ? "Stress protection active" : "Normal protection active"}</strong>
      <span className="protection-status__detail">Monitoring cross-chain risk</span>
    </div>
  );
}

interface ActionsProps {
  state: VerificationState;
  message: string;
  transactionUrl: string;
  onVerify: () => void;
}

function Actions({state, message, transactionUrl, onVerify}: ActionsProps) {
  const label = state === "checking" ? "Verifying…" : state === "verified" ? "Decision verified" : "Verify latest decision";
  return (
    <footer className="actions">
      <p className={`actions__message actions__message--${state}`} role="status">{message}</p>
      <button className="button button--primary" type="button" onClick={onVerify} disabled={state === "checking"}>
        {label}<ArrowIcon />
      </button>
      {transactionUrl ? (
        <a className="button-link" href={transactionUrl} target="_blank" rel="noreferrer">View transaction <ExternalIcon /></a>
      ) : (
        <span className="button-link button-link--disabled" title="Available after public deployment">View transaction <ExternalIcon /></span>
      )}
    </footer>
  );
}
