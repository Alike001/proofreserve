import type {DashboardSnapshot} from "../data";
import {formatNumber} from "../data";
import {EvidenceIcon, LockIcon, RiskIcon} from "../icons";

export function Workflow({snapshot}: {snapshot: DashboardSnapshot}) {
  return (
    <section className="workflow" id="evidence" aria-label="Evidence to enforcement workflow">
      <article className="stage stage--evidence">
        <StageHeader number={1} title="Attestcoin evidence" note="from Sepolia" icon={<EvidenceIcon />} />
        <p className="stage__description">Repayment facts verified on-chain for the same borrower group.</p>
        <div className="evidence-metrics">
          <Metric value={snapshot.factCount} label="verified facts" />
          <Metric value={snapshot.settledCount} label="settled" tone="safe" />
          <Metric value={snapshot.lateCount} label="late" tone="risk" />
        </div>
      </article>

      <span className="workflow__connector workflow__connector--one" aria-hidden="true" />

      <article className="stage stage--assessment">
        <StageHeader number={2} title="Gemini assessment" icon={<RiskIcon />} />
        <p className="stage__description">Analyzing portfolio patterns across verified repayment data.</p>
        <div className="assessment-result">
          <RiskIcon className="assessment-result__icon" />
          <div>
            <strong>{snapshot.regime}</strong>
            <p>{snapshot.reason}</p>
          </div>
          <div className="assessment-result__confidence">
            <strong>{formatNumber(snapshot.confidencePercent)}%</strong>
            <span>confidence</span>
          </div>
        </div>
      </article>

      <span className="workflow__connector workflow__connector--two" aria-hidden="true" />

      <article className="stage stage--enforcement" id="decisions">
        <StageHeader number={3} title="Creditcoin enforcement" icon={<LockIcon />} />
        <p className="stage__description">Smart contract updates reserve and blocks new risky lending.</p>
        <div className="enforcement-metrics">
          <Metric value={`${formatNumber(snapshot.reservePercent)}%`} label="reserve locked" />
          <Metric value={`${snapshot.blockedRequest} prUSD`} label="loan request blocked" tone="risk" />
        </div>
      </article>
    </section>
  );
}

interface StageHeaderProps {
  number: number;
  title: string;
  note?: string;
  icon: React.ReactNode;
}

function StageHeader({number, title, note, icon}: StageHeaderProps) {
  return (
    <header className="stage__header">
      <span className="stage__number">{number}</span>
      <span className="stage__mobile-icon">{icon}</span>
      <h2>{title}</h2>
      {note ? <span className="stage__note">{note}</span> : null}
    </header>
  );
}

function Metric({value, label, tone}: {value: string | number; label: string; tone?: "safe" | "risk"}) {
  return (
    <div className={tone ? `metric metric--${tone}` : "metric"}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
