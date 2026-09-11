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
import {ManagerDesk} from "./components/ManagerDesk";

type NetworkState = "loading" | "live" | "preview" | "error";
type CapacityState = "idle" | "testing" | "complete" | "error";

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
    ["How it works", "how-it-protects"],
    ["Live proof", "live-evidence"],
    ["For pool managers", "developers"]
  ];

  return (
    <header className="landing-header">
      <div className="landing-header__inner">
        <Brand />
        <nav className="landing-nav" aria-label="Primary navigation">
          {links.map(([label, target]) => <a href={`#${target}`} key={target}>{label}</a>)}
        </nav>
        <button className="primary-button header-cta" type="button" onClick={onOpenApp}>Open live app <ArrowIcon /></button>
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
          <h1>Lending pools<br />that react before<br /><em>losses spread.</em></h1>
          <p>ProofReserve turns verified repayments from other chains into enforceable lending limits on Creditcoin.</p>
          <p className="gate-thesis">Attestcoin proves the facts. AI reads the pattern. The contract controls the money.</p>
          <div className="gate-actions">
            <button className="primary-button" type="button" onClick={onOpenApp}>Try the live decision <ArrowIcon /></button>
            <a className="underlined-link" href="https://creditcoin-testnet.blockscout.com/tx/0xfc25a12816d9967db8c414832c0f0771e4fd7ae013d055bc586ef39c7fc8c83e" target="_blank" rel="noreferrer">View on-chain proof <ExternalIcon /></a>
          </div>
          <div className="trust-line">
            <span><i className={`trust-dot trust-dot--${network}`} />Live on Creditcoin CC3 Testnet</span>
          </div>
        </div>
        <LiquidityGate snapshot={snapshot} />
      </div>
    </section>
  );
}

function LiquidityGate({snapshot}: {snapshot: DashboardSnapshot}) {
  return (
    <div className="liquidity-gate" aria-label="Two late repayments on Ethereum are verified by Attestcoin, interpreted by AI, and cause a Creditcoin contract to protect 40 prUSD and block a 70 prUSD loan">
      <div className="gate-signal-flow">
        <div className="signal-step">
          <span className="signal-icon signal-icon--ethereum">◆</span>
          <div><small>Ethereum Sepolia</small><strong>{snapshot.lateCount} late repayments</strong></div>
        </div>
        <ArrowIcon />
        <div className="signal-step">
          <span className="signal-icon"><EvidenceIcon /></span>
          <div><small>Attestcoin</small><strong>Facts verified</strong></div>
        </div>
        <ArrowIcon />
        <div className="signal-step signal-step--risk">
          <span className="signal-icon"><RiskIcon /></span>
          <div><small>AI recommends</small><strong>{snapshot.reservePercent}% reserve</strong></div>
        </div>
      </div>
      <div className="gate-pool">
        <header><span><b aria-hidden="true">C</b>Creditcoin pool</span><strong>100 prUSD managed</strong></header>
        <AllocationRail label={snapshot.regime} protectedAmount={snapshot.reservePercent} lendable={snapshot.lendable} stressed />
      </div>
      <div className="gate-blocked">
        <div><span>{snapshot.blockedRequest} prUSD request</span><i /></div>
        <b aria-hidden="true">×</b>
        <p><strong>BLOCKED BY CONTRACT</strong><small>The request exceeds the {formatNumber(snapshot.lendable)} prUSD lending limit.</small></p>
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
        <div className="proof-flow__heading">
          <div>
            <span className="flow-kicker">What just happened?</span>
            <h2>One risk pattern.<br /><em>One safer lending limit.</em></h2>
          </div>
          <p>The facts, proof, AI recommendation, and contract action stay separate and inspectable. No single service gets to invent the evidence and move the money.</p>
        </div>

        <div className="decision-story">
          <article className="decision-impact" aria-label={`${snapshot.blockedRequest} prUSD was allowed before the reserve change and is blocked now`}>
            <header>
              <span>Same loan request</span>
              <strong>{snapshot.blockedRequest}<small>prUSD</small></strong>
            </header>
            <div className="capacity-case capacity-case--before">
              <div><span>Before · NORMAL</span><strong>ALLOWED</strong></div>
              <p>90 prUSD available to lend</p>
              <div className="capacity-bar"><i /></div>
            </div>
            <div className="capacity-case capacity-case--after">
              <div><span>Now · {snapshot.regime}</span><strong>BLOCKED</strong></div>
              <p>{formatNumber(snapshot.lendable)} prUSD available to lend</p>
              <div className="capacity-bar"><i /></div>
            </div>
            <footer>The request did not change. The verified risk did.</footer>
          </article>

          <ol className="decision-ledger" aria-label="How ProofReserve reaches an enforceable decision">
            <li>
              <span className="decision-ledger__number">01</span>
              <div><small>Ethereum Sepolia</small><h3>Repayment facts happen</h3><p>Four small payments settle. Two much larger repayments turn late.</p></div>
              <strong>40 paid · 500 late</strong>
            </li>
            <li>
              <span className="decision-ledger__number">02</span>
              <div><small>Attestcoin Protocol</small><h3>The receipts are proven</h3><p>Cryptographic proofs deliver the exact source transactions to Creditcoin.</p></div>
              <strong>7 proofs verified</strong>
            </li>
            <li>
              <span className="decision-ledger__number">03</span>
              <div><small>Bounded Gemini assessment</small><h3>AI reads the combined pattern</h3><p>The simple baseline says WATCH. Gemini recognizes the value severity and recommends STRESS.</p></div>
              <strong>WATCH → {snapshot.regime} · {snapshot.confidencePercent}%</strong>
            </li>
            <li>
              <span className="decision-ledger__number">04</span>
              <div><small>Creditcoin smart contract</small><h3>The financial limit is enforced</h3><p>The contract validates the recommendation, protects more liquidity, and rejects an unsafe request.</p></div>
              <strong>10 → {formatNumber(snapshot.reservePercent)}% protected</strong>
            </li>
          </ol>
        </div>
        <button className="underlined-link proof-flow__link" type="button" onClick={onOpenApp}>Inspect the live evidence <ArrowIcon /></button>
      </div>
    </section>
  );
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
  const [managerLendable, setManagerLendable] = useState<number | null>(null);
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

  const liveLendable = managerLendable ?? snapshot.lendable;
  const requestedAmount = Number(amount) || 0;
  const currentOutcome = comparison?.current.outcome ?? (requestedAmount <= liveLendable ? "ALLOWED" : "BLOCKED");
  const currentReason = currentOutcome === "BLOCKED"
    ? `The request is ${formatNumber(Math.max(0, requestedAmount - liveLendable))} prUSD above the pool's current lending limit.`
    : `The request fits inside the pool's ${formatNumber(liveLendable)} prUSD lending limit.`;

  return (
    <div className="pool-app">
      <a className="skip-link" href="#pool-main">Skip to pool</a>
      <header className="app-topbar">
        <Brand button onClick={onHome} />
        <nav aria-label="Product navigation">
          <a className="is-active" href="#overview">Pool</a>
          <a href="#evidence">Evidence</a>
          <a href="#decision">Decision</a>
          <a href="#activity">Activity</a>
        </nav>
        <span className={`app-network app-network--${network}`}><i />Live on Creditcoin CC3</span>
        <button className="wallet-button" type="button" onClick={() => document.getElementById("manager")?.scrollIntoView({behavior: "smooth"})}>Manage pool <ArrowIcon /></button>
      </header>
      <main className="pool-main" id="pool-main">
        <div className="decision-workspace" id="overview">
          <section className="decision-panel decision-panel--request">
            <header className="decision-heading">
              <div><h1>Can this pool<br /><em>fund the loan?</em></h1><p>Test a request against the reserve enforced by the Creditcoin contract.</p></div>
              <span>{snapshot.regime}</span>
            </header>
            <div className="managed-capacity"><span>100 prUSD managed</span><AllocationRail label={snapshot.regime} protectedAmount={snapshot.reservePercent} lendable={liveLendable} stressed /></div>
            <form className="request-panel" id="loan-desk" onSubmit={(event) => void checkCapacity(event)}>
            <label htmlFor="loan-amount">Loan request</label>
            <div className="app-amount"><input id="loan-amount" type="number" min="0.000001" max="1000000" step="any" value={amount} onChange={(event) => {setAmount(event.target.value); setComparison(null); setCapacityState("idle");}} /><span>prUSD</span></div>
            <div className="app-presets">{[50, 70, 95].map((value) => <button className={amount === String(value) ? "is-selected" : ""} type="button" onClick={() => chooseAmount(value)} key={value}>{value}</button>)}</div>
            <button className="primary-button request-submit" type="submit" disabled={capacityState === "testing" || network === "error" || network === "preview"}>{capacityState === "testing" ? "Checking Creditcoin…" : "Check live capacity"}<ArrowIcon /></button>
            <div className={`contract-result contract-result--${currentOutcome.toLowerCase()}`}><RiskIcon /><div><strong>{currentOutcome} BY CONTRACT</strong><p>{currentReason}</p></div></div>
            {capacityMessage && <p className="form-message" role="alert">{capacityMessage}</p>}
          </form>
          </section>

          <div className="pool-detail decision-panel decision-panel--proof">
            <section className="state-comparison" id="state-comparison">
              <h2>Pool capacity comparison</h2>
              <ComparisonRail label="Before risk signal" block={comparison?.normal.blockNumber} reserve={comparison?.normal.reservePercent ?? 10} lendable={comparison?.normal.lendable ?? 90} outcome={comparison?.normal.outcome ?? (requestedAmount <= 90 ? "ALLOWED" : "BLOCKED")} amount={requestedAmount} />
              <ComparisonRail label="Current" block={comparison?.current.blockNumber} reserve={comparison?.current.reservePercent ?? snapshot.reservePercent} lendable={comparison?.current.lendable ?? liveLendable} outcome={currentOutcome} amount={requestedAmount} current />
              <p className="capacity-explainer"><span aria-hidden="true">i</span>The pool's lending limit decreased from 90 to {formatNumber(liveLendable)} prUSD after new cross-chain evidence was verified.</p>
            </section>
            <section className="evidence-path" id="evidence">
              <header className="evidence-heading"><div><h2>Why the limit changed</h2><p>Verified facts from Ethereum changed a real lending limit on Creditcoin.</p></div><a href="https://github.com/Alike001/proofreserve/blob/main/docs/ai-sensitive-evidence.md" target="_blank" rel="noreferrer">Inspect proof <ExternalIcon /></a></header>
              <div className="evidence-stages">
                <EvidenceStep icon={<EvidenceIcon />} title={`${snapshot.lateCount} late repayments`} meta="Ethereum Sepolia" href="https://github.com/Alike001/proofreserve/blob/main/docs/testnet-evidence.md" />
                <EvidenceStep icon={<CheckIcon />} title="Attestcoin proof" meta="Verified on CC3" href="https://github.com/Alike001/proofreserve/blob/main/docs/testnet-evidence.md" />
                <EvidenceStep icon={<RiskIcon />} title={`Gemini: ${snapshot.regime}`} meta={`${snapshot.confidencePercent}% confidence`} href="https://github.com/Alike001/proofreserve/blob/main/docs/build-slice-03.md" />
                <EvidenceStep icon={<LockIcon />} title={`${snapshot.reservePercent}% enforced`} meta="ReserveController" href={transactionUrl || "https://github.com/Alike001/proofreserve/blob/main/docs/ai-sensitive-evidence.md"} />
              </div>
            </section>
            <div className="authority-note" id="decision"><span><RiskIcon /><b>AI recommends</b><small>Gemini selects only a policy-approved risk regime.</small></span><span><LockIcon /><b>Smart contract has final authority</b><small>The ReserveController validates and enforces the result.</small></span></div>
          </div>
        </div>

        {snapshot.aiComparison && <section className="decision-detail"><WhyAiMattered snapshot={snapshot} /></section>}

        <ManagerDesk onStateChange={(state) => {setManagerLendable(state.lendable); setComparison(null); setCapacityState("idle");}} />
        <section className="enforcement-record" id="activity"><h2>Recent enforcement record</h2><div><span className="record-icon">↑</span><strong>Reserve increased</strong><span>CC3 Testnet</span><span>Epoch {snapshot.epoch}</span><code>{shortHash(snapshot.reserveTransactionHash || snapshot.decisionHash)}</code>{transactionUrl ? <a href={transactionUrl} target="_blank" rel="noreferrer">View transaction <ExternalIcon /></a> : <a href="https://github.com/Alike001/proofreserve/blob/main/docs/ai-sensitive-evidence.md" target="_blank" rel="noreferrer">View evidence <ExternalIcon /></a>}</div></section>
      </main>
    </div>
  );
}

function WhyAiMattered({snapshot}: {snapshot: DashboardSnapshot}) {
  const comparison = snapshot.aiComparison;
  if (!comparison) return null;

  return (
    <div className="ai-difference">
      <header>
        <div><span>Why AI mattered</span><strong>Counts looked manageable. Value told a different story.</strong></div>
        <a href="https://github.com/Alike001/proofreserve/blob/main/docs/ai-sensitive-evidence.md" target="_blank" rel="noreferrer">Reproduce this decision <ExternalIcon /></a>
      </header>
      <div className="ai-difference__flow">
        <article>
          <small>Simple count rules</small>
          <strong>{comparison.baselineRegime}</strong>
          <p>{snapshot.settledCount} settled · {snapshot.lateCount} late</p>
          <b>{comparison.baselineReservePercent}% reserve</b>
        </article>
        <i aria-hidden="true"><ArrowIcon /></i>
        <article className="ai-difference__model">
          <small>Gemini sees value severity</small>
          <strong>{comparison.modelRegime}</strong>
          <p>{formatNumber(comparison.settledValue)} settled value · {formatNumber(comparison.lateValue)} late value</p>
          <b>{snapshot.reservePercent}% reserve · {snapshot.confidencePercent}% confidence</b>
        </article>
        <i aria-hidden="true"><ArrowIcon /></i>
        <article className="ai-difference__contract">
          <small>Creditcoin enforces</small>
          <strong>{snapshot.blockedRequest} prUSD BLOCKED</strong>
          <p>100 managed · {formatNumber(snapshot.reservePercent)} protected · {formatNumber(snapshot.lendable)} lendable</p>
          <b>Contract has final authority</b>
        </article>
      </div>
    </div>
  );
}

function ComparisonRail({label, block, reserve, lendable, outcome, amount, current = false}: {label: string; block?: number; reserve: number; lendable: number; outcome: "ALLOWED" | "BLOCKED"; amount: number; current?: boolean}) {
  return <div className={`comparison-rail ${current ? "comparison-rail--current" : ""}`}><div className="comparison-rail__header"><span className="state-label">{label}</span>{block && <small>Block #{block.toLocaleString()}</small>}<strong>{formatNumber(amount)} prUSD request: <b>{outcome}</b></strong></div><div className="compact-allocation"><span style={{width: `${reserve}%`}} /><i /><b>{formatNumber(reserve)} protected</b><em>{formatNumber(lendable)} lendable</em></div></div>;
}

function EvidenceStep({icon, title, meta, href}: {icon: ReactNode; title: string; meta: string; href: string}) {
  return <a href={href} target="_blank" rel="noreferrer"><span>{icon}</span><strong>{title}</strong><small>{meta}</small><ExternalIcon /></a>;
}
