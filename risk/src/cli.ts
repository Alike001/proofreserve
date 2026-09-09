import {readFile} from "node:fs/promises";

import {assessPortfolio} from "./assess.js";
import {PortfolioFeatures} from "./domain.js";
import {GeminiClient} from "./gemini.js";

const featurePath = process.argv[2];
if (!featurePath) throw new Error("usage: pnpm risk:assess <features.json>");

const features = JSON.parse(await readFile(featurePath, "utf8")) as PortfolioFeatures;
const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.8-flash";
const apiKey = process.env.GEMINI_API_KEY?.trim();
const assessment = await assessPortfolio(features, new GeminiClient(apiKey, model));
console.log(JSON.stringify(assessment, null, 2));
