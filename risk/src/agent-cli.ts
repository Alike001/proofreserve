import {loadRiskAgentConfig} from "./agent-config.js";
import {OnchainRiskAgent} from "./onchain.js";

const [command, rawEpoch] = process.argv.slice(2);
if (command !== "preview" && command !== "submit") {
  throw new Error("usage: pnpm risk:preview [epoch] | pnpm risk:submit [epoch]");
}

const epoch = rawEpoch === undefined ? undefined : Number(rawEpoch);
if (epoch !== undefined && (!Number.isSafeInteger(epoch) || epoch <= 0)) {
  throw new Error("epoch must be a positive integer");
}

const agent = new OnchainRiskAgent(loadRiskAgentConfig(command === "submit"));
const prepared = await agent.prepare(epoch);

if (command === "preview") {
  console.log(JSON.stringify(prepared, null, 2));
} else {
  const submission = await agent.submit(prepared);
  console.log(JSON.stringify({...prepared, submission}, null, 2));
}
