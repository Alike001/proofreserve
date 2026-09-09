import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export type WorkStatus =
  | "QUEUED"
  | "WAITING_ATTESTATION"
  | "PROOF_READY"
  | "SUBMITTED"
  | "FINALIZED"
  | "FAILED";

export interface WorkItem {
  sourceTxHash: string;
  status: WorkStatus;
  attempts: number;
  updatedAt: string;
  action?: number | undefined;
  sourceBlock?: number | undefined;
  creditcoinTxHash?: string | undefined;
  queryId?: string | undefined;
  error?: string | undefined;
}

interface WorkerState {
  version: 1;
  items: Record<string, WorkItem>;
}

const EMPTY_STATE: WorkerState = {version: 1, items: {}};

export class StateStore {
  constructor(private readonly path: string) {}

  async load(): Promise<WorkerState> {
    try {
      const parsed = JSON.parse(await readFile(this.path, "utf8")) as WorkerState;
      if (parsed.version !== 1 || typeof parsed.items !== "object") {
        throw new Error("unsupported worker state format");
      }
      return parsed;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return structuredClone(EMPTY_STATE);
      throw error;
    }
  }

  async enqueue(sourceTxHash: string): Promise<WorkItem> {
    const state = await this.load();
    const key = sourceTxHash.toLowerCase();
    const existing = state.items[key];
    if (existing) return existing;

    const item: WorkItem = {
      sourceTxHash,
      status: "QUEUED",
      attempts: 0,
      updatedAt: new Date().toISOString()
    };
    state.items[key] = item;
    await this.save(state);
    return item;
  }

  async listPending(): Promise<WorkItem[]> {
    const state = await this.load();
    return Object.values(state.items).filter((item) => item.status !== "FINALIZED");
  }

  async update(sourceTxHash: string, patch: Partial<WorkItem>): Promise<WorkItem> {
    const state = await this.load();
    const key = sourceTxHash.toLowerCase();
    const current = state.items[key];
    if (!current) throw new Error(`work item not found: ${sourceTxHash}`);

    const next: WorkItem = {...current, ...patch, updatedAt: new Date().toISOString()};
    state.items[key] = next;
    await this.save(state);
    return next;
  }

  private async save(state: WorkerState): Promise<void> {
    await mkdir(dirname(this.path), {recursive: true});
    const temporaryPath = `${this.path}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {mode: 0o600});
    await rename(temporaryPath, this.path);
  }
}
