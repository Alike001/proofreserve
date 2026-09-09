import type {AuditRecord} from "../data";
import {shortHash} from "../data";
import {ExternalIcon} from "../icons";

interface AuditLedgerProps {
  records: AuditRecord[];
  explorerBaseUrl: string;
}

export function AuditLedger({records, explorerBaseUrl}: AuditLedgerProps) {
  return (
    <section className="ledger" aria-labelledby="ledger-title">
      <LedgerHeader count={records.length} />
      <DesktopTable records={records} explorerBaseUrl={explorerBaseUrl} />
      <MobileList records={records} />
    </section>
  );
}

function LedgerHeader({count}: {count: number}) {
  return (
    <header className="ledger__header">
      <div>
        <h2 id="ledger-title">Audit ledger</h2>
        <p>On-chain evidence, bounded assessment, and reserve enforcement.</p>
      </div>
      <span>{count} records</span>
    </header>
  );
}

function DesktopTable({records, explorerBaseUrl}: AuditLedgerProps) {
  return (
    <div className="ledger__table-wrap">
      <table>
        <thead><tr><th>#</th><th>Event</th><th>Details</th><th>Source</th><th>Proof reference</th><th>State</th></tr></thead>
        <tbody>{records.map((record) => <DesktopRow key={record.id} record={record} explorerBaseUrl={explorerBaseUrl} />)}</tbody>
      </table>
    </div>
  );
}

function DesktopRow({record, explorerBaseUrl}: {record: AuditRecord; explorerBaseUrl: string}) {
  const url = explorerBaseUrl && record.hash.startsWith("0x") ? `${explorerBaseUrl}${record.hash}` : "";
  return (
    <tr>
      <td>{record.id}</td>
      <td className="ledger__event">{record.event}</td>
      <td>{record.detail}</td>
      <td>{record.chain}</td>
      <td>
        {url ? <a className="hash" href={url} target="_blank" rel="noreferrer">{shortHash(record.hash)} <ExternalIcon /></a> : <span className="hash">{shortHash(record.hash)}</span>}
      </td>
      <td><span className={"state state--" + record.tone}><i />Verified</span></td>
    </tr>
  );
}

function MobileList({records}: {records: AuditRecord[]}) {
  return (
    <div className="ledger__mobile">
      <div className="ledger__mobile-title"><h2>Recent activity</h2><span>View all</span></div>
      <div className="activity-list">
        {records.map((record) => (
          <div className="activity" key={record.id}>
            <i className={`activity__dot activity__dot--${record.tone}`} />
            <time>{record.time}</time>
            <div className="activity__copy"><strong>{record.event}</strong><span>{record.detail}</span></div>
            <span className="activity__category">{record.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
