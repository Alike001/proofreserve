import {readFile} from "node:fs/promises";

import {assessPortfolio} from "./assess.js";
import {PortfolioFeatures} from "./domain.js";
import {OllamaClient} from "./ollama.js";

const featurePath = process.argv[2];
if (!featurePath) throw new Error("usage: pnpm risk:assess <features.json>");

const features = JSON.parse(await readFile(featurePath, "utf8")) as PortfolioFeatures;
const model = process.env.OLLAMA_MODEL?.trim() || "qwen2.5:1.5b-instruct-q4_K_M";
const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434";
const assessment = await assessPortfolio(features, new OllamaClient(model, baseUrl));
console.log(JSON.stringify(assessment, null, 2));
