import {useEffect, useState} from "react";

import {AuditLedger} from "./components/AuditLedger";
import {Header, type NetworkStatus} from "./components/Header";
import {ReserveShift} from "./components/ReserveShift";
import {Workflow} from "./components/Workflow";
import {
  hasLiveConfiguration,
  loadDashboardSnapshot,
  previewSnapshot,
  type DashboardSnapshot
} from "./data";
import {ArrowIcon, CheckIcon, EvidenceIcon, ExternalIcon, LockIcon, RiskIcon} from "./icons";

type VerificationState = "idle" | "checking" | "verified" | "error";

export function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(previewSnapshot);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(hasLiveConfiguration() ? "loading" : "preview");
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
      setNetworkStatus(next.mode);
      if (announce) {
        setVerification("verified");
        setMessage(next.mode === "live" ? `Verified against CC3 at epoch ${next.epoch}.` : "Preview relationships verified locally.");
      }
    } catch (error) {
      setNetworkStatus("error");
      setVerification("error");
      setMessage(error instanceof Error ? error.message : "Unable to verify the current snapshot.");
    }
  }

  function navigate(section: string) {
    document.getElementById(section)?.scrollIntoView({behavior: "smooth", block: "start"});
  }

  const transactionUrl = explorerBaseUrl && snapshot.reserveTransactionHash
    ? `${explorerBaseUrl}${snapshot.reserveTransactionHash}`
    : "";

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <Header status={networkStatus} onNavigate={navigate} />
      <main id="main-content">
        <MarketingHero snapshot={snapshot} networkStatus={networkStatus} onNavigate={navigate} />
        <ProtocolRail />
        <ProblemSection />
        <HowItWorks />
        <SafetyBoundary />
        <LiveProof
          snapshot={snapshot}
          networkStatus={networkStatus}
          verification={verification}
          message={message}
          transactionUrl={transactionUrl}
          explorerBaseUrl={explorerBaseUrl}
          onVerify={() => void refreshSnapshot(true)}
        />
        <ProductDirection />
      </main>
      <SiteFooter />
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

interface HeroProps {
  snapshot: DashboardSnapshot;
  networkStatus: NetworkStatus;
  onNavigate: (section: string) => void;
}

function MarketingHero({snapshot, networkStatus, onNavigate}: HeroProps) {
  return (
    <section className="marketing-hero page-shell" id="product">
      <div className="marketing-hero__copy">
        <div className="eyebrow"><span /> Built on Creditcoin · powered by Attestcoin</div>
        <h1>Lending pools that react <em>before</em> losses spread.</h1>
        <p className="marketing-hero__lead">
          ProofReserve turns verified repayment activity from other chains into policy-controlled liquidity protection on Creditcoin.
        </p>
        <div className="hero-actions">
          <button className="button button--primary" type="button" onClick={() => onNavigate("live-proof")}>
            Explore the live proof <ArrowIcon />
          </button>
          <a className="text-link" href="https://github.com/Alike001/proofreserve/blob/main/docs/testnet-evidence.md" target="_blank" rel="noreferrer">
            Read the evidence <ExternalIcon />
          </a>
        </div>
        <div className="hero-proof-line" aria-label="Live product proof points">
          <span><strong>7</strong> Attestcoin proofs</span>
          <span><strong>40%</strong> reserve enforced</span>
          <span><strong>CC3</strong> public testnet</span>
        </div>
      </div>
      <div className="hero-product" aria-label="Live reserve response example">
        <div className="hero-product__topline">
          <div>
            <span className="micro-label">Live protocol response</span>
            <strong>Portfolio protection</strong>
          </div>
          <ConnectionLabel status={networkStatus} />
        </div>
        <ReserveShift snapshot={snapshot} />
        <div className="hero-product__result">
          <span className="result-dot" />
          <div><strong>{snapshot.blockedRequest} prUSD loan prevented</strong><span>Reserve policy now keeps {snapshot.reservePercent}% liquid.</span></div>
        </div>
      </div>
    </section>
  );
}

function ConnectionLabel({status}: {status: NetworkStatus}) {
  return (
    <span className={`connection-label connection-label--${status}`}>
      <i /> {status === "live" ? "On-chain" : status === "loading" ? "Loading CC3" : status === "error" ? "RPC unavailable" : "Preview"}
    </span>
  );
}

function ProtocolRail() {
  return (
    <section className="protocol-rail" aria-label="Protocol stack">
      <div className="page-shell protocol-rail__inner">
        <span className="protocol-rail__intro">One verifiable path</span>
        <span>Ethereum Sepolia</span><b>→</b><span>Attestcoin</span><b>→</b><span>Gemini</span><b>→</b><span>Creditcoin</span>
      </div>
    </section>
  );
}

function ProblemSection() {
  return (
    <section className="section page-shell problem" id="problem">
      <div className="section-heading">
        <span className="section-index">01 / The blind spot</span>
        <h2>Credit risk does not stay neatly on one chain.</h2>
      </div>
      <div className="problem__body">
        <p className="problem__statement">A lending pool can be healthy locally while the same borrowers are already falling behind elsewhere.</p>
        <div className="problem__detail">
          <p>Today, that warning often arrives through a private database or an isolated threshold. The pool must trust whoever operates the feed—and still misses relationships between borrowers.</p>
          <p>ProofReserve gives the pool evidence it can verify, reasoning it can constrain, and a response it can enforce.</p>
        </div>
      </div>
      <div className="signal-map" aria-label="Correlated borrower risk example">
        <div className="signal-map__source">
          <span>Borrower group / logistics</span>
          <strong>Two related borrowers turn late</strong>
        </div>
        <div className="signal-map__lines" aria-hidden="true"><i /><i /></div>
        <div className="borrower borrower--late"><span>Borrower 01</span><strong>LATE</strong></div>
        <div className="borrower borrower--late"><span>Borrower 02</span><strong>LATE</strong></div>
        <div className="borrower borrower--healthy"><span>Borrower 03</span><strong>SETTLED</strong></div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {number: "01", title: "Prove the facts", body: "Attestcoin verifies that repayment transactions really happened on the source chain.", meta: "Inclusion + continuity", icon: <EvidenceIcon />},
    {number: "02", title: "Read the pattern", body: "Gemini reasons across borrower, group, value, and deterioration signals inside a strict output schema.", meta: "Four finite regimes", icon: <RiskIcon />},
    {number: "03", title: "Enforce the limit", body: "Creditcoin contracts validate the decision and change how much liquidity the pool can lend.", meta: "Contracts hold authority", icon: <LockIcon />}
  ];
  return (
    <section className="section section--soft" id="how-it-works">
      <div className="page-shell process">
        <div className="section-heading section-heading--split">
          <div><span className="section-index">02 / How it works</span><h2>Facts first. Judgment second. Enforcement last.</h2></div>
          <p>The order matters. Each layer does one job, and no layer gets more power than it needs.</p>
        </div>
        <div className="process-list">
          {steps.map((step) => (
            <article className="process-step" key={step.number}>
              <span className="process-step__number">{step.number}</span>
              <span className="process-step__icon">{step.icon}</span>
              <div><h3>{step.title}</h3><p>{step.body}</p></div>
              <span className="process-step__meta">{step.meta}</span>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function SafetyBoundary() {
  return (
    <section className="section page-shell safety" id="safety">
      <div className="safety__statement">
        <span className="section-index">03 / Designed for financial control</span>
        <h2>AI advises.<br/><em>Contracts decide.</em></h2>
        <p>Gemini can recognize a portfolio pattern that a single threshold misses. It cannot touch funds or invent new financial rules.</p>
      </div>
      <div className="policy-panel">
        <div className="policy-panel__header"><span>Reserve policy / v1</span><span className="policy-panel__status"><i /> Enforced</span></div>
        <PolicyCheck text="Only registered evidence roots and epochs" />
        <PolicyCheck text="Only NORMAL, WATCH, STRESS, or CRISIS" />
        <PolicyCheck text="Minimum 60% model confidence" />
        <PolicyCheck text="Immediate increases; delayed decreases" />
        <PolicyCheck text="No token transfers by the AI signer" />
      </div>
    </section>
  );
}

function PolicyCheck({text}: {text: string}) {
  return <div className="policy-check"><CheckIcon /><span>{text}</span></div>;
}

interface LiveProofProps {
  snapshot: DashboardSnapshot;
  networkStatus: NetworkStatus;
  verification: VerificationState;
  message: string;
  transactionUrl: string;
  explorerBaseUrl: string;
  onVerify: () => void;
}

function LiveProof({snapshot, networkStatus, verification, message, transactionUrl, explorerBaseUrl, onVerify}: LiveProofProps) {
  return (
    <section className="section section--proof" id="live-proof">
      <div className="page-shell">
        <div className="section-heading section-heading--split proof-heading">
          <div><span className="section-index">04 / Public testnet evidence</span><h2>Do not take our word for it.</h2></div>
          <div><p>This dashboard reads the deployed Creditcoin contracts. Verify the current decision, then inspect its public transaction.</p><ConnectionLabel status={networkStatus} /></div>
        </div>
        <div className="dashboard-frame">
          <div className="dashboard-frame__bar">
            <div><i /><i /><i /></div>
            <span>proofreserve / live risk console</span>
            <span>epoch {snapshot.epoch}</span>
          </div>
          <div className="dashboard">
            <div className="console-summary">
              <div><span className="micro-label">Current response</span><h3>{snapshot.regime} protection active</h3></div>
              <div className="console-summary__metric"><strong>{snapshot.reservePercent}%</strong><span>protected</span></div>
              <div className="console-summary__metric"><strong>{snapshot.lendable}</strong><span>prUSD lendable</span></div>
            </div>
            <Workflow snapshot={snapshot} />
            <AuditLedger records={snapshot.records} explorerBaseUrl={explorerBaseUrl} />
            <Actions state={verification} message={message} transactionUrl={transactionUrl} onVerify={onVerify} />
          </div>
        </div>
      </div>
    </section>
  );
}

interface ActionsProps {
  state: VerificationState;
  message: string;
  transactionUrl: string;
  onVerify: () => void;
}

function Actions({state, message, transactionUrl, onVerify}: ActionsProps) {
  const label = state === "checking" ? "Verifying on CC3…" : state === "verified" ? "Decision verified" : "Verify latest decision";
  return (
    <footer className="actions">
      <p className={`actions__message actions__message--${state}`} role="status">{message}</p>
      <button className="button button--primary" type="button" onClick={onVerify} disabled={state === "checking"}>
        {label}<ArrowIcon />
      </button>
      {transactionUrl ? (
        <a className="button-link" href={transactionUrl} target="_blank" rel="noreferrer">View CC3 transaction <ExternalIcon /></a>
      ) : (
        <span className="button-link button-link--disabled" title="Available after public deployment">Transaction pending</span>
      )}
    </footer>
  );
}

function ProductDirection() {
  return (
    <section className="section page-shell direction">
      <div>
        <span className="section-index">Built as infrastructure, shown as a product</span>
        <h2>One protected pool today.<br/>A risk layer for many pools tomorrow.</h2>
      </div>
      <div className="direction__copy">
        <p>The hackathon deployment proves the complete loop with one pool. The product path adds self-service pool setup, configurable evidence sources, and policy templates for lenders building on Creditcoin.</p>
        <a className="text-link" href="https://github.com/Alike001/proofreserve" target="_blank" rel="noreferrer">Explore the open-source system <ExternalIcon /></a>
      </div>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="page-shell site-footer__inner">
        <div><strong>ProofReserve</strong><span>Protected lending pools powered by verified cross-chain risk.</span></div>
        <div className="site-footer__links">
          <a href="https://github.com/Alike001/proofreserve" target="_blank" rel="noreferrer">GitHub</a>
          <a href="https://github.com/Alike001/proofreserve/blob/main/docs/testnet-evidence.md" target="_blank" rel="noreferrer">Evidence</a>
          <a href="https://creditcoin.org" target="_blank" rel="noreferrer">Creditcoin</a>
          <a href="https://attestcoin.org" target="_blank" rel="noreferrer">Attestcoin</a>
        </div>
        <p>Hackathon-stage testnet software. Not audited for production funds.</p>
      </div>
    </footer>
  );
}
