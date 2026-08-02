import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

async function sourceFiles(directory) {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await sourceFiles(relative));
    else if ([".ts", ".tsx"].includes(extname(entry.name))) files.push(relative);
  }
  return files;
}

async function combined(files) {
  return (await Promise.all(files.map(async (file) =>
    `\n/* ${file} */\n${await readFile(resolve(root, file), "utf8")}`,
  ))).join("");
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`${label} is missing: ${text}`);
}

function rejectText(source, pattern, label) {
  if (pattern.test(source)) throw new Error(`${label} contains forbidden ${String(pattern)}.`);
}

const provider = await readFile(resolve(root, "packages/ai/src/index.ts"), "utf8");
const credentials = await readFile(resolve(root, "apps/desktop/electron/ai-credentials.ts"), "utf8");
const credentialWindow = await readFile(resolve(root, "apps/desktop/electron/credential-window.ts"), "utf8");
const credentialPreload = await readFile(resolve(root, "apps/desktop/electron/credential-preload.ts"), "utf8");
const main = await readFile(resolve(root, "apps/desktop/electron/main.ts"), "utf8");
const renderer = await combined(await sourceFiles("apps/desktop/src"));
const preload = await readFile(resolve(root, "apps/desktop/electron/preload.ts"), "utf8");
const projectFormat = await combined(await sourceFiles("packages/project-format/src"));
const production = await combined([
  ...await sourceFiles("packages/ai/src"),
  ...await sourceFiles("apps/desktop/electron"),
  ...await sourceFiles("apps/desktop/src"),
]);
const aiPackage = JSON.parse(await readFile(resolve(root, "packages/ai/package.json"), "utf8"));
const pipeline = await readFile(resolve(root, "docs/AI_PIPELINE.md"), "utf8");

for (const marker of [
  "https://api.openai.com/v1/responses",
  'store: false',
  'reasoning: { effort: "low" }',
  "text: {",
  'type: "json_schema"',
  "max_output_tokens: AI_LIMITS.outputTokens",
  "authorization: credentialHeader(credential)",
]) requireText(provider, marker, "OpenAI provider boundary");

for (const marker of [
  "#safeStorage.encryptString",
  "#safeStorage.decryptString",
  "CredentialAcquisitionTimeoutError",
]) requireText(credentials, marker, "credential boundary");

for (const marker of [
  "modal: true",
  "parentWindow",
  "contextIsolation: true",
  "nodeIntegration: false",
  "sandbox: true",
  "devTools: false",
  "setAlwaysOnTop",
  "event.sender === credentialWindow.webContents",
  "signal.removeEventListener",
]) requireText(credentialWindow, marker, "application-owned credential window");

for (const marker of [
  "cancelAiConnection",
  "credentialConnectionTimeoutMs",
]) requireText(main + preload, marker, "bounded credential connection wiring");

requireText(main, 'process.env.LASERX_TEST_AI_MOCK === "1"', "mock-provider gate");
rejectText(renderer, /https:\/\/api\.openai\.com|\bfetch\s*\(|\bAuthorization\b|Bearer\s|safeStorage|encryptString|decryptString/u, "renderer source");
rejectText(preload, /https:\/\/api\.openai\.com|\bfetch\s*\(|\bAuthorization\b|Bearer\s|safeStorage|encryptString|decryptString/u, "preload source");
rejectText(credentialPreload, /https:\/\/api\.openai\.com|\bfetch\s*\(|\bAuthorization\b|Bearer\s|safeStorage|encryptString|decryptString/u, "credential preload source");
rejectText(credentials + credentialWindow + main, /powershell(?:\.exe)?|System\.Windows\.Forms|\bspawn\s*\(/iu, "credential production boundary");
rejectText(projectFormat, /aiConcept|providerId|requestId|referenceImage|prompt/u, "project schema source");
rejectText(production, /\bsk-[A-Za-z0-9_-]{16,}\b/u, "production source");

const dependencies = Object.keys(aiPackage.dependencies ?? {});
if (dependencies.length !== 1 || dependencies[0] !== "@laserx/domain") {
  throw new Error("@laserx/ai production dependencies must remain provider-SDK-free and domain-only.");
}

for (const term of [
  "Real-provider validation (manual, never CI)",
  "provenanceSaved: false",
  "safeStorage",
  "They never call OpenAI",
]) requireText(pipeline, term, "AI pipeline documentation");

console.log("AI boundary audit passed: isolated app-owned credential modal, main-only provider network, transient provenance, schema-v9 isolation, and documented mock/real-provider paths.");
