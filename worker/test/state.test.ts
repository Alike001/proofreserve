import assert from "node:assert/strict";
import {mkdtemp, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";

import {StateStore} from "../src/state.js";

const TX_HASH = `0x${"11".repeat(32)}`;

test("enqueue is durable and idempotent across store instances", async () => {
  const directory = await mkdtemp(join(tmpdir(), "proofreserve-worker-"));
  const path = join(directory, "state.json");

  try {
    const firstStore = new StateStore(path);
    const first = await firstStore.enqueue(TX_HASH);
    const duplicate = await firstStore.enqueue(TX_HASH.toUpperCase().replace("0X", "0x"));

    assert.equal(first.status, "QUEUED");
    assert.deepEqual(duplicate, first);

    const restartedStore = new StateStore(path);
    assert.equal((await restartedStore.listPending()).length, 1);

    await restartedStore.update(TX_HASH, {status: "SUBMITTED", creditcoinTxHash: TX_HASH});
    assert.equal((await new StateStore(path).listPending()).length, 1);

    await restartedStore.update(TX_HASH, {status: "FINALIZED"});
    assert.equal((await new StateStore(path).listPending()).length, 0);
  } finally {
    await rm(directory, {recursive: true});
  }
});
