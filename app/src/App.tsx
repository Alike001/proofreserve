import {useEffect, useState, type CSSProperties, type FormEvent, type ReactNode} from "react";

import {
  formatNumber,
  hasLiveConfiguration,
  loadDashboardSnapshot,
  previewSnapshot,
  shortHash,
  simulateLoanCapacity,
  type CapacityComparison,
  type DashboardSnapshot
} from "./data";
import {ArrowIcon, CheckIcon, EvidenceIcon, ExternalIcon, LockIcon, RiskIcon} from "./icons";

type NetworkState = "loading" | "live" | "preview" | "error";
type CapacityState = "idle" | "testing" | "complete" | "error";

interface InjectedWallet {
  request(args: {method: string; params?: unknown[]}): Promise<unknown>;
}

export function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot>(previewSnapshot);
  const [network, setNetwork] = useState<NetworkState>(hasLiveConfiguration() ? "loading" : "preview");
  const [route, setRoute] = useState(() => normalizeRoute(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setRoute(normalizeRoute(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!hasLiveConfiguration()) return;
    void loadDashboardSnapshot()
      .then((next) => {
        validateSnapshot(next);
        setSnapshot(next);
        setNetwork(next.mode);
      })
      .catch(() => setNetwork("error"));
  }, []);

  function openRoute(next: "/" | "/app") {
    if (window.location.pathname !== next) window.history.pushState({}, "", next);
    setRoute(next);
    window.scrollTo({top: 0, behavior: "smooth"});
  }

  return route === "/app" ? (
    <PoolApplication snapshot={snapshot} network={network} onHome={() => openRoute("/")} />
  ) : (
    <LandingPage snapshot={snapshot} network={network} onOpenApp={() => openRoute("/app")} />
  );
}

function normalizeRoute(pathname: string): "/" | "/app" {
  return pathname.replace(/\/$/, "") === "/app" ? "/app" : "/";
}

function validateSnapshot(snapshot: DashboardSnapshot) {
  if (snapshot.factCount !== snapshot.settledCount + snapshot.lateCount + snapshot.lossCount) {
    throw new Error("Fact totals do not reconcile.");
  }
  if (snapshot.reservePercent < 0 || snapshot.reservePercent > 100 || snapshot.lendable < 0) {
    throw new Error("Reserve capacity is outside valid bounds.");
  }
}

function LandingPage({snapshot, network, onOpenApp}: {snapshot: DashboardSnapshot; network: NetworkState; onOpenApp: () => void}) {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <LandingHeader onOpenApp={onOpenApp} />
      <main id="main-content">
        <LiquidityGateHero snapshot={snapshot} network={network} onOpenApp={onOpenApp} />
        <ProofFlow snapshot={snapshot} onOpenApp={onOpenApp} />
        <ProductSection snapshot={snapshot} network={network} onOpenApp={onOpenApp} />
        <AuthoritySection />
        <FinalCallout onOpenApp={onOpenApp} />
      </main>
      <SiteFooter />
    </div>
  );
}

function LandingHeader({onOpenApp}: {onOpenApp: () => void}) {
  const links = [
    ["Product", "product"],
    ["How it protects", "how-it-protects"],
    ["Live evidence", "live-evidence"],
    ["Developers", "developers"]
  ];

  return (
    <header className="landing-header">
      <div className="landing-header__inner">
        <Brand />
        <nav className="landing-nav" aria-label="Primary navigation">
          {links.map(([label, target]) => <a href={`#${target}`} key={target}>{label}</a>)}
        </nav>
        <span className="built-on">Built on Creditcoin</span>
        <button className="primary-button header-cta" type="button" onClick={onOpenApp}>Open app <ArrowIcon /></button>
      </div>
    </header>
  );
}

function Brand({button = false, onClick}: {button?: boolean; onClick?: () => void}) {
  const content = <><span className="brand-mark" aria-hidden="true"><i /><i /></span><span>ProofReserve</span></>;
  return button ? <button className="brand" type="button" onClick={onClick}>{content}</button> : <a className="brand" href="#product">{content}</a>;
}

function LiquidityGateHero({snapshot, network, onOpenApp}: {snapshot: DashboardSnapshot; network: NetworkState; onOpenApp: () => void}) {
  return (
    <section className="gate-hero" id="product">
      <div className="gate-grid" aria-hidden="true" />
      <div className="landing-shell gate-hero__inner">
        <div className="gate-copy">
          <h1>A lending pool<br />that knows when<br /><em>to stop lending.</em></h1>
          <p>ProofReserve watches verified repayments on other chains. When related borrowers fall behind, it protects more of the pool on Creditcoin—before losses spread.</p>
          <div className="gate-actions">
            <button className="primary-button" type="button" onClick={onOpenApp}>Open the protected pool <ArrowIcon /></button>
            <a className="underlined-link" href="#live-evidence">See why 70 prUSD was blocked <ArrowIcon /></a>
          </div>
          <div className="trust-line">
            <span><i className={`trust-dot trust-dot--${network}`} />Live on Creditcoin CC3 Testnet</span>
            <span><i className="trust-dot trust-dot--attest" />Cross-chain facts verified by Attestcoin</span>
          </div>
        </div>
        <LiquidityGate snapshot={snapshot} />
      </div>
    </section>
  );
}

function LiquidityGate({snapshot}: {snapshot: DashboardSnapshot}) {
  return (
    <div className="liquidity-gate" aria-label="A 100 prUSD pool changes from 10 protected and 90 lendable to 40 protected and 60 lendable after verified late repayments, blocking a 70 prUSD request">
      <div className="gate-orbit" />
      <div className="gate-topline"><strong>100 prUSD pool</strong><span>Same pool. Smarter protection.</span></div>
      <AllocationRail label="NORMAL" protectedAmount={snapshot.previousReservePercent} lendable={snapshot.previousLendable} />
      <div className="verified-facts">
        <span className="chain-node chain-node--ethereum">◆</span>
        <span className="chain-node chain-node--attest"><EvidenceIcon /></span>
        <div><strong>{snapshot.lateCount} verified late repayments</strong><small>from Ethereum via Attestcoin</small></div>
      </div>
      <div className="gate-connector" aria-hidden="true"><i /></div>
      <AllocationRail label={snapshot.regime} protectedAmount={snapshot.reservePercent} lendable={snapshot.lendable} stressed />
      <div className="blocked-request">
        <div><strong>{snapshot.blockedRequest} <small>prUSD request</small></strong><span><i /></span></div>
        <b>×</b>
        <p><strong>BLOCKED BY CONTRACT</strong><small>Insufficient lendable liquidity</small></p>
      </div>
    </div>
  );
}

function AllocationRail({label, protectedAmount, lendable, stressed = false}: {label: string; protectedAmount: number; lendable: number; stressed?: boolean}) {
  return (
    <div className={`allocation allocation--${stressed ? "stress" : "normal"}`}>
      <span className="state-label">{label}</span>
      <div className="allocation__labels">
        <strong>{formatNumber(protectedAmount)} <small>protected</small></strong>
        <strong>{formatNumber(lendable)} <small>lendable</small></strong>
      </div>
      <div className="allocation__bar" style={{"--protected": `${protectedAmount}%`} as CSSProperties}>
        <span className="allocation__protected" /><span className="allocation__lendable" /><i />
      </div>
    </div>
  );
}

function ProofFlow({snapshot, onOpenApp}: {snapshot: DashboardSnapshot; onOpenApp: () => void}) {
  return (
    <section className="proof-flow" id="how-it-protects">
      <div className="landing-shell">
        <h2>One fact. One proof. One financial response.</h2>
        <p className="section-lead">A verified cause-and-effect path replaces the private risk feed a pool would normally have to trust.</p>
        <div className="flow-rail">
          <FlowStage number="1" title="Repayment fact" accent="blue">
            <p>Two related borrowers miss their repayment deadlines on Ethereum Sepolia.</p>
            <div className="fact-rows"><FactRow label="Borrower 01" status="LATE" /><FactRow label="Borrower 02" status="LATE" /></div>
          </FlowStage>
          <FlowStage number="2" title="Attestcoin proof" accent="violet">
            <p>Attestcoin verifies the source transactions and delivers the facts to Creditcoin.</p>
            <div className="chain-path"><span>Ethereum</span><b>→</b><span>Attestcoin</span><b>→</b><span>CC3</span></div>
            <span className="verified-status"><CheckIcon /> Proof verified</span>
          </FlowStage>
          <FlowStage number="3" title="Contract response" accent="mint">
            <p>The ReserveController moves the pool from NORMAL to {snapshot.regime}.</p>
            <div className="mini-shift"><span>10 → {formatNumber(snapshot.reservePercent)}% protected</span><strong>{snapshot.blockedRequest} prUSD BLOCKED</strong></div>
          </FlowStage>
        </div>
        <button className="underlined-link proof-flow__link" type="button" onClick={onOpenApp}>Inspect the live evidence <ArrowIcon /></button>
      </div>
    </section>
  );
}

function FlowStage({number, title, accent, children}: {number: string; title: string; accent: string; children: ReactNode}) {
  return <article className={`flow-stage flow-stage--${accent}`}><header><span>{number}</span><h3>{title}</h3></header>{children}</article>;
}

function FactRow({label, status}: {label: string; status: string}) {
  return <div className="fact-row"><span>{label}</span><strong>{status}</strong></div>;
}

function ProductSection({snapshot, network, onOpenApp}: {snapshot: DashboardSnapshot; network: NetworkState; onOpenApp: () => void}) {
  return (
    <section className="product-section" id="live-evidence">
      <div className="landing-shell">
        <div className="product-heading">
          <div><h2>A real pool, not a scripted demo.</h2><p>The interface reads deployed CC3 contracts and tests the same loan request against two real contract states.</p></div>
          <button className="primary-button" type="button" onClick={onOpenApp}>Open the protected pool <ArrowIcon /></button>
        </div>
        <div className="product-preview">
          <div className="product-preview__bar"><Brand /><span className={`live-read live-read--${network}`}><i />{network === "live" ? "Reading CC3" : network === "loading" ? "Connecting to CC3" : network === "error" ? "RPC unavailable" : "Preview data"}</span></div>
          <div className="product-preview__body">
            <div className="preview-capacity"><span>100 prUSD managed</span><AllocationRail label={snapshot.regime} protectedAmount={snapshot.reservePercent} lendable={snapshot.lendable} stressed /></div>
            <div className="preview-request"><span>Loan request</span><strong>{snapshot.blockedRequest}<small>prUSD</small></strong><b>BLOCKED</b><p>Only {formatNumber(snapshot.lendable)} prUSD is available to lend.</p></div>
            <div className="preview-evidence"><span>Why it changed</span><strong>{snapshot.lateCount} late facts</strong><i /> <strong>Attestcoin verified</strong><i /> <strong>{snapshot.reservePercent}% enforced</strong></div>
          </div>
        </div>
        <div className="product-proof-points">
          <span><strong>Read-only simulations</strong><small>No wallet or gas needed to test capacity</small></span>
          <span><strong>Public testnet contracts</strong><small>Evidence and enforcement remain inspectable</small></span>
          <span><strong>Open-source system</strong><small>Contracts, worker, risk engine, and UI</small></span>
        </div>
      </div>
    </section>
  );
}

function AuthoritySection() {
  const rules = ["Only registered evidence roots and epochs", "Only four contract-approved risk regimes", "Minimum model confidence enforced", "Immediate reserve increases; delayed decreases", "AI signer cannot transfer pool funds"];
  return (
    <section className="authority-section" id="developers">
      <div className="landing-shell authority-grid">
        <div><h2>AI advises.<br /><em>Contracts decide.</em></h2><p>Gemini recognizes portfolio patterns, but it cannot move funds or invent a reserve level. Creditcoin contracts validate every boundary before anything changes.</p></div>
        <div className="policy-ledger"><header><span>Reserve policy / v1</span><b><i /> ENFORCED</b></header>{rules.map((rule) => <div key={rule}><CheckIcon /><span>{rule}</span></div>)}</div>
      </div>
    </section>
  );
}

function FinalCallout({onOpenApp}: {onOpenApp: () => void}) {
  return <section className="final-callout"><div className="landing-shell"><h2>See the contract say no.</h2><p>Try 50, 70, and 95 prUSD against the live Creditcoin pool.</p><button className="primary-button" type="button" onClick={onOpenApp}>Open ProofReserve <ArrowIcon /></button></div></section>;
}

function SiteFooter() {
  return <footer className="site-footer"><div className="landing-shell"><Brand /><span>Hackathon-stage testnet software. Not audited for production funds.</span><nav><a href="https://github.com/Alike001/proofreserve" target="_blank" rel="noreferrer">GitHub</a><a href="https://github.com/Alike001/proofreserve/blob/main/docs/testnet-evidence.md" target="_blank" rel="noreferrer">Evidence</a><a href="https://creditcoin.org" target="_blank" rel="noreferrer">Creditcoin</a><a href="https://attestcoin.org" target="_blank" rel="noreferrer">Attestcoin</a></nav></div></footer>;
}

function PoolApplication({snapshot, network, onHome}: {snapshot: DashboardSnapshot; network: NetworkState; onHome: () => void}) {
  const [amount, setAmount] = useState("70");
  const [capacityState, setCapacityState] = useState<CapacityState>("idle");
  const [comparison, setComparison] = useState<CapacityComparison | null>(null);
  const [capacityMessage, setCapacityMessage] = useState("");
  const [wallet, setWallet] = useState("");
  const explorerBaseUrl = import.meta.env.VITE_CC3_EXPLORER_TX_URL?.trim() || "";
  const transactionUrl = explorerBaseUrl && snapshot.reserveTransactionHash ? `${explorerBaseUrl}${snapshot.reserveTransactionHash}` : "";

  async function checkCapacity(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setCapacityState("testing");
    setCapacityMessage("");
    try {
      const result = await simulateLoanCapacity(Number(amount));
      setComparison(result);
      setCapacityState("complete");
    } catch (error) {
      setComparison(null);
      setCapacityState("error");
      setCapacityMessage(error instanceof Error ? error.message : "The contract simulation failed.");
    }
  }

  function chooseAmount(value: number) {
    setAmount(String(value));
    setComparison(null);
    setCapacityState("idle");
    setCapacityMessage("");
  }

  async function connectWallet() {
    const provider = (window as Window & {ethereum?: InjectedWallet}).ethereum;
    if (!provider) {
      setWallet("Install a wallet");
      return;
    }
    try {
      const accounts = await provider.request({method: "eth_requestAccounts"});
      const first = Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : "";
      setWallet(first ? `${first.slice(0, 6)}…${first.slice(-4)}` : "Connected");
    } catch {
      setWallet("Connection declined");
    }
  }

  const currentOutcome = comparison?.current.outcome ?? (Number(amount) <= snapshot.lendable ? "ALLOWED" : "BLOCKED");
  const currentReason = comparison?.current.reason ?? (currentOutcome === "BLOCKED" ? `Only ${formatNumber(snapshot.lendable)} prUSD is available to lend.` : "This request fits inside current lendable capacity.");

  return (
    <div className="pool-app">
      <a className="skip-link" href="#pool-main">Skip to pool</a>
      <aside className="app-sidebar">
        <Brand button onClick={onHome} />
        <nav aria-label="Product navigation">
          <a className="is-active" href="#overview"><PoolNavIcon kind="overview" />Overview</a>
          <a href="#loan-desk"><PoolNavIcon kind="loan" />Loan desk</a>
          <a href="#evidence"><PoolNavIcon kind="evidence" />Evidence</a>
          <a href="#decision"><PoolNavIcon kind="decision" />Decision</a>
          <a href="#activity"><PoolNavIcon kind="activity" />Activity</a>
          <a href="https://github.com/Alike001/proofreserve/blob/main/docs/product-spec.md" target="_blank" rel="noreferrer"><PoolNavIcon kind="integration" />Integration</a>
        </nav>
        <div className="app-sidebar__bottom"><a href="https://github.com/Alike001/proofreserve#readme" target="_blank" rel="noreferrer">Documentation <ExternalIcon /></a><a href="https://github.com/Alike001/proofreserve" target="_blank" rel="noreferrer">GitHub <ExternalIcon /></a></div>
      </aside>
      <header className="app-topbar">
        <button className="mobile-home" type="button" onClick={onHome}><BrandMarkOnly />ProofReserve</button>
        <span className={`app-network app-network--${network}`}><i />Creditcoin CC3</span>
        <button className="wallet-button" type="button" onClick={() => void connectWallet()}>{wallet || "Connect wallet"}</button>
      </header>
      <main className="pool-main" id="pool-main">
        <section className="pool-overview" id="overview">
          <div className="pool-title"><div><h1>Protected pool</h1><p>Live reserve enforcement from verified cross-chain repayment facts.</p></div><div className="pool-status"><span>{snapshot.regime}</span><strong>{formatNumber(snapshot.reservePercent)}% <small>protected</small></strong><small>Updated on Creditcoin CC3</small></div></div>
          <div className="managed-capacity"><span>100 prUSD managed</span><AllocationRail label={snapshot.regime} protectedAmount={snapshot.reservePercent} lendable={snapshot.lendable} stressed /></div>
        </section>

        <div className="pool-workspace">
          <form className="request-panel" id="loan-desk" onSubmit={(event) => void checkCapacity(event)}>
            <h2>Request liquidity</h2><p>Check whether this amount can be borrowed from the pool.</p>
            <label htmlFor="loan-amount">Amount</label>
            <div className="app-amount"><input id="loan-amount" type="number" min="0.000001" max="1000000" step="any" value={amount} onChange={(event) => {setAmount(event.target.value); setComparison(null); setCapacityState("idle");}} /><span>prUSD</span></div>
            <div className="app-presets">{[50, 70, 95].map((value) => <button className={amount === String(value) ? "is-selected" : ""} type="button" onClick={() => chooseAmount(value)} key={value}>{value}</button>)}</div>
            <button className="primary-button request-submit" type="submit" disabled={capacityState === "testing" || network === "error" || network === "preview"}>{capacityState === "testing" ? "Checking CC3…" : "Check contract capacity"}<ArrowIcon /></button>
            <div className={`contract-result contract-result--${currentOutcome.toLowerCase()}`}><RiskIcon /><div><strong>{currentOutcome} {capacityState === "complete" ? "BY CONTRACT" : "AT CURRENT CAPACITY"}</strong><p>{currentReason}</p></div></div>
            {capacityMessage && <p className="form-message" role="alert">{capacityMessage}</p>}
            <a className="underlined-link compare-link" href="#state-comparison">Compare with NORMAL state <ArrowIcon /></a>
          </form>

          <div className="pool-detail">
            <section className="state-comparison" id="state-comparison">
              <h2>Pool state comparison</h2>
              <ComparisonRail label="NORMAL" block={comparison?.normal.blockNumber} reserve={comparison?.normal.reservePercent ?? 10} lendable={comparison?.normal.lendable ?? 90} outcome={comparison?.normal.outcome ?? (Number(amount) <= 90 ? "ALLOWED" : "BLOCKED")} amount={Number(amount) || 0} />
              <ComparisonRail label={`CURRENT: ${snapshot.regime}`} block={comparison?.current.blockNumber} reserve={comparison?.current.reservePercent ?? snapshot.reservePercent} lendable={comparison?.current.lendable ?? snapshot.lendable} outcome={currentOutcome} amount={Number(amount) || 0} current />
            </section>
            <section className="evidence-path" id="evidence">
              <h2>Why the reserve changed</h2>
              <div className="evidence-stages">
                <EvidenceStep icon={<EvidenceIcon />} title={`${snapshot.lateCount} late repayments`} meta="Ethereum Sepolia" href="https://github.com/Alike001/proofreserve/blob/main/docs/testnet-evidence.md" />
                <EvidenceStep icon={<CheckIcon />} title="Attestcoin proof" meta="Verified on CC3" href="https://github.com/Alike001/proofreserve/blob/main/docs/testnet-evidence.md" />
                <EvidenceStep icon={<RiskIcon />} title={`Gemini: ${snapshot.regime}`} meta={`${snapshot.confidencePercent}% confidence`} href="https://github.com/Alike001/proofreserve/blob/main/docs/build-slice-03.md" />
                <EvidenceStep icon={<LockIcon />} title={`${snapshot.reservePercent}% enforced`} meta="ReserveController" href={transactionUrl || "https://github.com/Alike001/proofreserve/blob/main/docs/ai-sensitive-evidence.md"} />
              </div>
              <div className="authority-note" id="decision"><span><RiskIcon /><b>AI recommends</b><small>Gemini selects only a policy-approved risk regime.</small></span><span><LockIcon /><b>Smart contract has final authority</b><small>The ReserveController validates and enforces the result.</small></span></div>
            </section>
          </div>
        </div>

        <section className="enforcement-record" id="activity"><h2>Recent enforcement record</h2><div><span className="record-icon">↑</span><strong>Reserve increased</strong><span>CC3 Testnet</span><span>Epoch {snapshot.epoch}</span><code>{shortHash(snapshot.reserveTransactionHash || snapshot.decisionHash)}</code>{transactionUrl ? <a href={transactionUrl} target="_blank" rel="noreferrer">View transaction <ExternalIcon /></a> : <a href="https://github.com/Alike001/proofreserve/blob/main/docs/ai-sensitive-evidence.md" target="_blank" rel="noreferrer">View evidence <ExternalIcon /></a>}</div></section>
      </main>
    </div>
  );
}

function ComparisonRail({label, block, reserve, lendable, outcome, amount, current = false}: {label: string; block?: number; reserve: number; lendable: number; outcome: "ALLOWED" | "BLOCKED"; amount: number; current?: boolean}) {
  return <div className={`comparison-rail ${current ? "comparison-rail--current" : ""}`}><div className="comparison-rail__header"><span className="state-label">{label}</span>{block && <small>Block #{block.toLocaleString()}</small>}<strong>{formatNumber(amount)} prUSD request: <b>{outcome}</b></strong></div><div className="compact-allocation"><span style={{width: `${reserve}%`}} /><i /><b>{formatNumber(reserve)} protected</b><em>{formatNumber(lendable)} lendable</em></div></div>;
}

function EvidenceStep({icon, title, meta, href}: {icon: ReactNode; title: string; meta: string; href: string}) {
  return <a href={href} target="_blank" rel="noreferrer"><span>{icon}</span><strong>{title}</strong><small>{meta}</small><ExternalIcon /></a>;
}

function PoolNavIcon({kind}: {kind: string}) {
  if (kind === "evidence") return <EvidenceIcon />;
  if (kind === "decision") return <LockIcon />;
  if (kind === "integration") return <ExternalIcon />;
  if (kind === "activity") return <span className="nav-clock">◷</span>;
  if (kind === "loan") return <span className="nav-doc">▤</span>;
  return <span className="nav-home">⌂</span>;
}

function BrandMarkOnly() {
  return <span className="brand-mark" aria-hidden="true"><i /><i /></span>;
}
