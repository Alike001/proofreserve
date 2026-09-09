import type {DataMode} from "../data";
import {ChevronIcon, ShieldIcon} from "../icons";

interface HeaderProps {
  activeSection: string;
  mode: DataMode;
  onNavigate: (section: string) => void;
}

export function Header({activeSection, mode, onNavigate}: HeaderProps) {
  const items = ["Overview", "Evidence", "Decisions"];
  return (
    <header className="topbar">
      <div className="topbar__inner">
        <button className="brand" type="button" onClick={() => onNavigate("Overview")} aria-label="ProofReserve overview">
          <ShieldIcon className="brand__mark" />
          <span>ProofReserve</span>
        </button>
        <nav className="nav" aria-label="Primary navigation">
          {items.map((item) => (
            <button
              type="button"
              className={activeSection === item ? "nav__item nav__item--active" : "nav__item"}
              onClick={() => onNavigate(item)}
              key={item}
            >
              {item}
            </button>
          ))}
        </nav>
        <div className="network" title={mode === "live" ? "Reading public CC3 contracts" : "Configure VITE_ public addresses for live data"}>
          <span className={mode === "live" ? "network__dot" : "network__dot network__dot--preview"} />
          <span className="network__desktop">{mode === "live" ? "CC3 Testnet" : "Preview state"}</span>
          <span className="network__mobile">{mode === "live" ? "CC3" : "Preview"}</span>
          <ChevronIcon className="network__chevron" />
        </div>
      </div>
    </header>
  );
}
