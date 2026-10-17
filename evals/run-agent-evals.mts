/**
 * Runs the agent against the sample household and grades each answer.
 *   ANTHROPIC_API_KEY=… npm run eval:agent            # all cases
 *   ANTHROPIC_API_KEY=… npm run eval:agent -- invest  # cases whose id contains "invest"
 *   npm run eval:agent -- --dry                        # no API calls: checks every tool runs on sample data
 * Checks: required tools were called, expected words appear, and a model-graded rubric (pass/fail + reason).
 */
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { build } from "../lib/data";
import { sampleInputs } from "../lib/sample";
import { runAgent, runTool, TOOLS, AGENT_MODEL, type AgentEvent } from "../lib/agent";

type Case = { id: string; q: string; tools: string[]; include_any: string[]; rubric: string };
const cases: Case[] = JSON.parse(readFileSync(new URL("./agent-cases.json", import.meta.url), "utf8"));
const args = process.argv.slice(2);
const dash = build(sampleInputs(), true, { plaid: true, db: true, encryption: true });

if (args.includes("--dry")) {
  for (const t of TOOLS) {
    const out = runTool(t.name, t.name === "get_transactions" ? { limit: 3 } : {}, dash);
    console.log(`✓ ${t.name}: ${JSON.stringify(out).slice(0, 110)}…`);
  }
  process.exit(0);
}
if (!process.env.ANTHROPIC_API_KEY) { console.error("Set ANTHROPIC_API_KEY (or use --dry)."); process.exit(1); }

const client = new Anthropic();
async function grade(c: Case, answer: string) {
  const r = await client.messages.create({
    model: AGENT_MODEL, max_tokens: 200,
    messages: [{ role: "user", content: `Grade a personal-finance assistant's answer.\nQuestion: ${c.q}\nRubric: ${c.rubric}\nAnswer:\n"""${answer}"""\nReply with exactly "PASS: <short reason>" or "FAIL: <short reason>".` }],
  });
  return r.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
}

const filter = args.find((a) => !a.startsWith("--"));
let pass = 0, total = 0;
for (const c of cases.filter((x) => !filter || x.id.includes(filter))) {
  total++;
  const steps: string[] = []; let answer = ""; let error = "";
  await runAgent([{ role: "user", content: c.q }], dash, (e: AgentEvent) => {
    if (e.type === "step") steps.push(e.tool);
    if (e.type === "answer") answer = e.text;
    if (e.type === "error") error = e.message;
  });
  const toolsOk = c.tools.every((alt) => alt.split("|").some((t) => steps.includes(t)));
  const wordsOk = c.include_any.length === 0 || c.include_any.some((w) => answer.toLowerCase().includes(w.toLowerCase()));
  const verdict = error ? `FAIL: ${error}` : await grade(c, answer);
  const ok = !error && toolsOk && wordsOk && verdict.startsWith("PASS");
  if (ok) pass++;
  console.log(`${ok ? "✓" : "✗"} ${c.id}  tools[${steps.join(",")}]${toolsOk ? "" : " (missing required)"}${wordsOk ? "" : " (expected words missing)"}  ${verdict}`);
  if (!ok) console.log(`   answer: ${answer.slice(0, 400).replace(/\n/g, " ")}`);
}
console.log(`\n${pass}/${total} passed`);
process.exit(pass === total ? 0 : 1);
