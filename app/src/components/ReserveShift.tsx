import type {DashboardSnapshot} from "../data";
import {formatNumber} from "../data";
import {ArrowIcon} from "../icons";

export function ReserveShift({snapshot}: {snapshot: DashboardSnapshot}) {
  return (
    <section className="reserve-shift" aria-label="Reserve capacity change">
      <ReserveState
        label="Before (Normal)"
        mobileLabel="Before"
        reserve={snapshot.previousReservePercent}
        lendable={snapshot.previousLendable}
        tone="before"
      />
      <div className="reserve-shift__arrow" aria-hidden="true">
        <ArrowIcon />
      </div>
      <ReserveState
        label="After (Stress Mode)"
        mobileLabel="After"
        reserve={snapshot.reservePercent}
        lendable={snapshot.lendable}
        tone="after"
      />
    </section>
  );
}

interface ReserveStateProps {
  label: string;
  mobileLabel: string;
  reserve: number;
  lendable: number;
  tone: "before" | "after";
}

function ReserveState({label, mobileLabel, reserve, lendable, tone}: ReserveStateProps) {
  return (
    <div className={`reserve-state reserve-state--${tone}`}>
      <p className="reserve-state__label">
        <span className="desktop-only">{label}</span>
        <span className="mobile-only">{mobileLabel}</span>
      </p>
      <div className="reserve-state__metric">
        <strong>{formatNumber(reserve)}%</strong>
        <span>protected reserve</span>
      </div>
      <div className="reserve-bar" aria-label={`${formatNumber(reserve)} percent protected reserve`}>
        <span className="reserve-bar__protected" style={{width: `${reserve}%`}} />
        <span className="reserve-bar__lendable" />
      </div>
      <p className="reserve-state__lendable">
        {formatNumber(lendable)} prUSD <span>lendable</span>
      </p>
    </div>
  );
}
