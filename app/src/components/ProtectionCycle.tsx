import {useEffect, useRef, useState} from "react";

import {formatNumber, simulateLoanCapacity, type CapacityComparison, type DashboardSnapshot} from "../data";
import {protectionCycleProgress, protectionCycleStepState, type ProtectionCycleStatus} from "../protection-cycle";
import {ArrowIcon, CheckIcon, ExternalIcon} from "../icons";

type NetworkState = "loading" | "live" | "preview" | "error";

const EVIDENCE_DOCUMENT = "https://github.com/Alike001/proofreserve/blob/main/docs/ai-sensitive-evidence.md";
const SOURCE_FACT = "https://sepolia.etherscan.io/tx/0xae5fbeece0ba514969128ad09c75231156f9430278689eb87558b10198325d9f";
const ATTESTCOIN_ACCEPTANCE = "https://creditcoin-testnet.blockscout.com/tx/0x6ba4d327bd7b0c209fb33a1103137e5ef9d871a402b922a8b45bda4cb0b28af7";
const ENFORCEMENT_TRANSACTION = "https://creditcoin-testnet.blockscout.com/tx/0xfc25a12816d9967db8c414832c0f0771e4fd7ae013d055bc586ef39c7fc8c83e";

interface ProtectionCycleProps {
  snapshot: DashboardSnapshot;
  network: NetworkState;
  onOperatePool: () => void;
}

interface CycleStep {
  label: string;
  network: string;
  title: string;
  detail: string;
  href: string;
}

export function ProtectionCycle({snapshot, network, onOperatePool}: ProtectionCycleProps) {
  const [status, setStatus] = useState<ProtectionCycleStatus>("idle");
  const [activeStep, setActiveStep] = useState(-1);
  const [comparison, setComparison] = useState<CapacityComparison | null>(null);
  const [message, setMessage] = useState("Ready to re-query the public contract states. No wallet or gas required.");
  const runId = useRef(0);

  useEffect(() => () => {
    runId.current += 1;
  }, []);

  const normalLendable = comparison?.normal.lendable ?? 90;
  const currentLendable = comparison?.current.lendable ?? snapshot.lendable;
  const normalOutcome = comparison?.normal.outcome ?? "ALLOWED";
  const currentOutcome = comparison?.current.outcome ?? "BLOCKED";
  const busy = status === "querying" || status === "playing";
  const disabled = busy || network !== "live";

  const steps: CycleStep[] = [
    {
      label: "01 · Before",
      network: "Creditcoin CC3",
      title: `70 prUSD ${normalOutcome.toLowerCase()}`,
      detail: `${formatNumber(normalLendable)} prUSD was lendable at the pinned NORMAL block.`,
      href: EVIDENCE_DOCUMENT
    },
    {
      label: "02 · Facts",
      network: "Ethereum Sepolia",
      title: "High-value repayments turn late",
      detail: `${snapshot.settledCount} settled facts worth 40; ${snapshot.lateCount} late facts worth 500.`,
      href: SOURCE_FACT
    },
    {
      label: "03 · Prove",
      network: "Attestcoin Protocol",
      title: "Cross-chain facts verified",
      detail: `${snapshot.factCount} facts and their checkpoint are accepted on Creditcoin.`,
      href: ATTESTCOIN_ACCEPTANCE
    },
    {
      label: "04 · Interpret",
      network: "Bounded Gemini",
      title: `WATCH becomes ${snapshot.regime}`,
      detail: `Value severity changes the recommendation with ${snapshot.confidencePercent}% confidence.`,
      href: EVIDENCE_DOCUMENT
    },
    {
      label: "05 · Enforce",
      network: "Creditcoin contract",
      title: `Reserve rises to ${formatNumber(snapshot.reservePercent)}%`,
      detail: "The controller validates the policy; AI cannot move pool funds.",
      href: ENFORCEMENT_TRANSACTION
    },
    {
      label: "06 · After",
      network: "Creditcoin CC3",
      title: `70 prUSD ${currentOutcome.toLowerCase()}`,
      detail: `Only ${formatNumber(currentLendable)} prUSD remains lendable under the enforced reserve.`,
      href: ENFORCEMENT_TRANSACTION
    }
  ];

  async function replayCycle() {
    const currentRun = runId.current + 1;
    runId.current = currentRun;
    setStatus("querying");
    setActiveStep(0);
    setComparison(null);
    setMessage("Querying the historic NORMAL block and the latest Creditcoin state…");

    try {
      const result = await simulateLoanCapacity(70);
      if (runId.current !== currentRun) return;
      setComparison(result);
      setStatus("playing");

      const stageMessages = [
        `Historic block ${result.normal.blockNumber.toLocaleString()}: the 70 prUSD request was allowed.`,
        "Loading the published Sepolia repayment receipts…",
        "Matching the Attestcoin acceptance and registered evidence root…",
        "Reading the reviewed Gemini assessment bound to that evidence…",
        "Matching the policy-bounded Creditcoin enforcement transaction…",
        `Latest block ${result.current.blockNumber.toLocaleString()}: the same request is blocked.`
      ];

      for (const [index, stageMessage] of stageMessages.entries()) {
        if (runId.current !== currentRun) return;
        setActiveStep(index);
        setMessage(stageMessage);
        await wait(index === stageMessages.length - 1 ? 350 : 620);
      }

      if (runId.current !== currentRun) return;
      setStatus("complete");
      setMessage("Verified replay complete: the request stayed at 70 prUSD; the proven risk changed the contract's answer.");
    } catch (error) {
      if (runId.current !== currentRun) return;
      setStatus("error");
      setActiveStep(-1);
      setMessage(error instanceof Error ? error.message : "The public contract replay could not be completed.");
    }
  }

  const statusLabel = network === "loading"
    ? "Connecting to Creditcoin…"
    : network === "error"
      ? "Creditcoin RPC unavailable"
      : network === "preview"
        ? "Live configuration unavailable"
        : status === "complete"
          ? "Replay verified"
          : busy
            ? "Verification in progress"
            : "Public testnet ready";

  return (
    <section className={`protection-cycle protection-cycle--${status}`} id="protection-cycle" aria-labelledby="cycle-title">
      <div className="protection-cycle__intro">
        <div>
          <span className="cycle-label">Interactive verified replay</span>
          <h1 id="cycle-title">Watch one loan change<br /><em>from allowed to blocked.</em></h1>
          <p>ProofReserve re-queries the real Creditcoin contract before and after verified repayment risk—then shows every fact, proof, AI decision and enforcement receipt.</p>
        </div>
        <div className="cycle-actions">
          <button className="primary-button" type="button" onClick={() => void replayCycle()} disabled={disabled}>
            {busy ? "Replaying public evidence…" : status === "complete" ? "Replay again" : "Replay the protection cycle"}<ArrowIcon />
          </button>
          <button className="cycle-operate" type="button" onClick={onOperatePool}>Operate the live pool <ArrowIcon /></button>
          <small>No wallet · No gas · No API key</small>
        </div>
      </div>

      <div className="cycle-verdict" aria-label="The same 70 prUSD loan was allowed before the verified risk and is blocked now">
        <div className="cycle-verdict__state cycle-verdict__state--before">
          <span>Before verified risk</span>
          <strong>70 <small>prUSD</small></strong>
          <b>{normalOutcome}</b>
          <p>{formatNumber(normalLendable)} prUSD lendable</p>
        </div>
        <div className="cycle-verdict__change" aria-hidden="true"><ArrowIcon /><span>same request</span></div>
        <div className="cycle-verdict__state cycle-verdict__state--after">
          <span>After verified risk</span>
          <strong>70 <small>prUSD</small></strong>
          <b>{currentOutcome}</b>
          <p>{formatNumber(currentLendable)} prUSD lendable</p>
        </div>
      </div>

      <div className="cycle-progress" aria-hidden="true"><i style={{width: `${protectionCycleProgress(activeStep, status)}%`}} /></div>
      <ol className="cycle-steps">
        {steps.map((step, index) => {
          const stepState = protectionCycleStepState(index, activeStep, status);
          return (
            <li className={`cycle-step cycle-step--${stepState}`} data-state={stepState} key={step.label}>
              <div className="cycle-step__top"><span>{stepState === "complete" ? <CheckIcon /> : String(index + 1).padStart(2, "0")}</span><small>{step.label}</small></div>
              <b>{step.network}</b>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
              <a href={step.href} target="_blank" rel="noreferrer" aria-label={`Inspect ${step.label} evidence`}>Inspect receipt <ExternalIcon /></a>
            </li>
          );
        })}
      </ol>

      <div className={`cycle-status cycle-status--${status}`} role="status" aria-live="polite">
        <span><i />{statusLabel}</span>
        <p>{message}</p>
      </div>
      <p className="cycle-disclosure">Replay mode reads public evidence and contract history; it does not create a new repayment event, model call or transaction. New decisions run through the documented operator workflow so private keys remain off the website.</p>
    </section>
  );
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
