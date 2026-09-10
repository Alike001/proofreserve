import type {DataMode} from "../data";
import {ExternalIcon, ShieldIcon} from "../icons";

export type NetworkStatus = DataMode | "loading" | "error";

interface HeaderProps {
  status: NetworkStatus;
  onNavigate: (section: string) => void;
}

const items = [
  {label: "Product", target: "product"},
  {label: "How it works", target: "how-it-works"},
  {label: "Safety", target: "safety"},
  {label: "Live proof", target: "live-proof"}
];

export function Header({status, onNavigate}: HeaderProps) {
  const statusLabel = status === "live" ? "CC3 live" : status === "loading" ? "Connecting" : status === "error" ? "Connection issue" : "Preview";

  return (
    <header className="topbar">
      <div className="topbar__inner">
        <button className="brand" type="button" onClick={() => onNavigate("product")} aria-label="ProofReserve home">
          <ShieldIcon className="brand__mark" />
          <span>ProofReserve</span>
        </button>
        <nav className="nav" aria-label="Primary navigation">
          {items.map((item) => (
            <button type="button" className="nav__item" onClick={() => onNavigate(item.target)} key={item.target}>
              {item.label}
            </button>
          ))}
        </nav>
        <div className={`network network--${status}`} title="Public Creditcoin CC3 Testnet connection">
          <span className="network__dot" />
          <span>{statusLabel}</span>
        </div>
        <a className="header-link" href="https://github.com/Alike001/proofreserve" target="_blank" rel="noreferrer">
          GitHub <ExternalIcon />
        </a>
      </div>
    </header>
  );
}
