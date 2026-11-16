// main.ts — driver for the markdown-render-speed-02 entry.
//
// The harness runs `node /bot/main.ts` on Node 22. It reads the scored set
// from cases.json (one object per case, in order, each with a `markdown`
// string), renders each case alone with parse() from parse.js, and writes
// the HTML strings — in case order, as a JSON array — to html.json.
//
// Paths come from the environment so the same driver works inside the
// harness container (/input, /output) and outside it (MAKEFUN_INPUT_DIR,
// MAKEFUN_OUTPUT_DIR). No other environment, file, or clock is read, and
// no state is kept between cases: each parse() call is independent, so the
// output is deterministic.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "./parse.js";

// One scored case: an id for the record and the markdown to render.
type Case = { id: string; markdown: string };

// Read and validate the case list. A malformed file fails loudly instead
// of producing a short or misordered answer file.
function readCases(inputDir: string): Case[] {
  const raw = readFileSync(join(inputDir, "cases.json"), "utf8");
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("cases.json is not an array");
  }
  const cases: Case[] = new Array(parsed.length);
  for (let i = 0; i < parsed.length; i++) {
    const item: unknown = parsed[i];
    if (typeof item !== "object" || item === null || typeof (item as Case).markdown !== "string") {
      throw new Error(`case ${i} has no markdown string`);
    }
    cases[i] = item as Case;
  }
  return cases;
}

// Render every case alone, in order, and write the answers.
function main(): void {
  const inputDir = process.env.MAKEFUN_INPUT_DIR ?? "/input";
  const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

  const cases = readCases(inputDir);

  const out: string[] = new Array(cases.length);
  for (let i = 0; i < cases.length; i++) {
    out[i] = parse(cases[i].markdown);
  }

  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "html.json"), JSON.stringify(out));
}

main();
