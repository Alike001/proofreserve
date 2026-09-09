import {isHexString} from "ethers";

import {loadConfig} from "./config.js";
import {FactProcessor} from "./processor.js";
import {StateStore} from "./state.js";

function statePath(): string {
  return process.env.WORKER_STATE_PATH?.trim() || ".proofreserve/worker-state.json";
}

async function enqueue(hash: string | undefined): Promise<void> {
  if (!hash || !isHexString(hash, 32)) {
    throw new Error("enqueue requires a 32-byte source transaction hash");
  }
  const item = await new StateStore(statePath()).enqueue(hash);
  console.log(JSON.stringify(item, null, 2));
}

async function run(): Promise<void> {
  const config = loadConfig();
  const store = new StateStore(config.statePath);
  const processor = new FactProcessor(config, store);
  const pending = await store.listPending();

  if (pending.length === 0) {
    console.log("No queued facts.");
    return;
  }

  let failures = 0;
  for (const item of pending) {
    try {
      console.log(`Processing ${item.sourceTxHash} from state ${item.status}`);
      await processor.process(item);
      console.log(`Finalized ${item.sourceTxHash}`);
    } catch (error) {
      failures += 1;
      console.error(`Failed ${item.sourceTxHash}:`, error);
    }
  }

  if (failures > 0) process.exitCode = 1;
}

const [command, argument] = process.argv.slice(2);

if (command === "enqueue") {
  await enqueue(argument);
} else if (command === "run") {
  await run();
} else {
  throw new Error("usage: pnpm worker:enqueue <source-tx-hash> | pnpm worker:run");
}
