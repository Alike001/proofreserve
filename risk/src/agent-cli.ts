import {readFile} from "node:fs/promises";

import {writeManifest} from "../../deployment/src/common.js";
import {validateRiskAssessment} from "./assess.js";
import {loadRiskAgentConfig} from "./agent-config.js";
import {OnchainRiskAgent, PreparedOnchainAssessment} from "./onchain.js";

const [command, rawEpoch] = process.argv.slice(2);
if (command !== "preview" && command !== "submit") {
  throw new Error("usage: pnpm risk:preview [epoch] | pnpm risk:submit [epoch]");
}

const epoch = rawEpoch === undefined ? undefined : Number(rawEpoch);
if (epoch !== undefined && (!Number.isSafeInteger(epoch) || epoch <= 0)) {
  throw new Error("epoch must be a positive integer");
}
const rawObservedBlock = process.env.RISK_OBSERVED_BLOCK?.trim();
const observedBlock = rawObservedBlock === undefined ? undefined : Number(rawObservedBlock);
if (observedBlock !== undefined && (!Number.isSafeInteger(observedBlock) || observedBlock <= 0)) {
  throw new Error("RISK_OBSERVED_BLOCK must be a positive integer");
}

const agent = new OnchainRiskAgent(loadRiskAgentConfig(command === "submit"));
const artifactPath = process.env.RISK_ASSESSMENT_ARTIFACT?.trim() || "deployments/risk-assessment.json";

if (command === "preview") {
  const prepared = await agent.prepare(epoch, observedBlock);
  await writeManifest(artifactPath, prepared);
  console.log(JSON.stringify({...prepared, artifactPath}, null, 2));
} else {
  const prepared = await readPreparedArtifact(artifactPath);
  if (epoch !== undefined && prepared.features.epoch !== epoch) {
    throw new Error(`prepared artifact is for epoch ${prepared.features.epoch}, not requested epoch ${epoch}`);
  }
  if (
    prepared.assessment.inferenceMode !== "GEMINI" &&
    process.env.ALLOW_DETERMINISTIC_SUBMISSION?.trim().toLowerCase() !== "true"
  ) {
    throw new Error(
      "prepared assessment did not use Gemini; run risk:preview again or explicitly set ALLOW_DETERMINISTIC_SUBMISSION=true"
    );
  }
  const submission = await agent.submit(prepared);
  const submissionManifest =
    process.env.RISK_SUBMISSION_MANIFEST?.trim() || "deployments/risk-submission.json";
  const result = {...prepared, submission};
  await writeManifest(submissionManifest, result);
  console.log(JSON.stringify({...result, artifactPath, submissionManifest}, null, 2));
}

async function readPreparedArtifact(path: string): Promise<PreparedOnchainAssessment> {
  let value: unknown;
  try {
    value = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`cannot read prepared assessment artifact ${path}; run pnpm risk:preview first`, {cause: error});
  }
  if (value === null || typeof value !== "object") throw new Error("prepared assessment artifact is invalid");
  const prepared = value as PreparedOnchainAssessment;
  validateRiskAssessment(prepared.features, prepared.assessment);
  if (!Number.isSafeInteger(prepared.observedBlock) || prepared.observedBlock <= 0) {
    throw new Error("prepared assessment artifact has an invalid observed block");
  }
  return prepared;
}
