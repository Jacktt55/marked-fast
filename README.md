# marked-fast

[![make.fun · markdown-render-speed-02](https://make.fun/badge/markdown-render-speed-02.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![rank](https://make.fun/badge/markdown-render-speed-02/Jacktt55/marked-fast/rank.svg)](https://make.fun/bounty/markdown-render-speed-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)
[![reward](https://make.fun/badge/markdown-render-speed-02/Jacktt55/marked-fast/reward.svg)](https://make.fun/bounty/markdown-render-speed-02?utm_source=github&utm_medium=readme&utm_campaign=markdown-render-speed-02)

A faster drop-in for marked 18.1.3: `parse(markdown)` returns exactly the HTML
marked renders with its default options (gfm on, breaks off, pedantic off,
async off), for less CPU.

Built for the make.fun bounty [`markdown-render-speed-02`](https://make.fun/bounty/markdown-render-speed-02) ($250, top 20).
Entries close 2026-11-16T20:30:00Z.

## Files

- `parse.js` — the renderer. A fork of marked 18.1.3, optimised for speed.
  Dependency-free ES module; exports `parse(markdown)`. See `NOTICE` and
  `LICENSE-marked` for marked's licence (MIT).
- `main.ts` — the driver the harness runs. Reads `cases.json` from
  `$MAKEFUN_INPUT_DIR` (or `/input`), validates that it is a list of cases
  with a `markdown` string each, renders each case alone with `parse`,
  writes the HTML strings in case order to `html.json` in
  `$MAKEFUN_OUTPUT_DIR` (or `/output`). A malformed input fails loudly
  instead of producing a short or misordered answer file.
- `package.json` — module metadata (`"type": "module"`, Node >= 22).
- `LICENSE` — this entry's MIT licence. `LICENSE-marked` / `NOTICE` —
  marked's licence and vendoring notice, kept as required for a fork.

## How it is faster

All optimisations preserve marked's output exactly; every one is checked
against the kit scorer (720/720 byte-identical on the practice set) and by
differential fuzzing against stock marked.

- **Plain-inline fast path.** An inline source with no inline construct
  (`\`, `<`, `[`, `!`, `*`, `_`, backtick, `~`, `&`, `@`, `www.`, `://`,
  `mailto:`, `xmpp:`, or a hard break) is a single text token — no masking,
  no closer scan, no per-character token loop.
- **First-char inline dispatch.** The inline tokeniser loop dispatches on
  the first character instead of trying every tokenizer's regex at every
  text position. Each tokenizer's rule is anchored and can only match for a
  small set of first characters. This also fixes two subtleties the naive
  dispatch would miss: `br` matches a backslash before a newline, and the
  `url` (email) rule can start with `_`, `.`, `+` or `-`.
- **First-char block dispatch.** The block tokeniser loop does the same:
  each block tokenizer is guarded by a necessary first-character condition
  (indent, first non-space character, and — for table and setext heading —
  a manual check of the following lines), so the failing regex execs are
  skipped. Paragraph and text always run as the fallbacks.
- **Two-tier text regex.** Most inline sources contain no `www.`, URL or
  email construct, so they use a simplified text regex without the
  lookbehind and email lookaheads (verified equivalent on urlish-free
  input); sources that do contain one use the full marked regex.
- **List line-loop fast path.** The `list()` item loop replaces its six
  begin-of-line regex tests with one first-character dispatch, replaces
  `split("\n", 1)` / `search` / `replace` per line with `indexOf` and manual
  scans, and skips the tab-expansion replace when a line has no leading
  tab. The double-blank-line check at the end of an item is a manual
  end-of-string scan instead of a regex.
- **Masked-source pre-checks.** The reflink mask is skipped when the
  document defines no links; the escape/code mask is skipped when the
  source has no backslash or backtick; the link/code/HTML mask is skipped
  when the source has no `[`, backtick or `<`.
- **Manual URL-start check.** `isUrlStart` tests the `www.` / `http(s)://` /
  `ftp://` / `mailto:` / `xmpp:` prefixes by character code instead of a
  regex test at every text run.
- **Guarded carriage-return normalisation.** The `\r` replace in `lex()`
  is skipped when the input has no carriage return.
- **Entity pre-filter.** `decodeNumericCharacterReferences` first checks
  for `"&#"` with a native substring search before running its regex test.

Two things were tried and deliberately left out, because measurement showed
they do not help on this workload: a hand-written inline-text scanner
(char-by-char, and a hybrid that jumps with a native regex search) is
slower than V8's regex for the text rule, and the per-call `indexOf`
precomputation it needs eats the saving. The differential test harnesses
for both are kept in `bench/textscan.mjs` and `bench/textscan2.mjs`
(outside the repo).

## Verification (local, practice set)

- Kit scorer: **720/720** cases byte-identical (`program/scorer/main.ts`).
- Differential fuzzing vs stock marked 18.1.3: **0 diffs in 14,000**
  random cases (inline-heavy and email/URL/underscore-heavy pools), plus
  **0 mismatches in 240,000** targeted and random strings for the text-rule
  scanner experiments.
- Timing (same machine, same method, median of runs after warmup):
  marked baseline ~790–800 ms, this entry ~570–630 ms over the 720
  practice cases — about **1.3–1.4× faster** locally. The leader board's
  top 20 sit near 1.8× marked, so this is not yet in the top 20; it is a
  correct, meaningfully faster drop-in.

## Reproduce

```sh
# from the kit directory, with the practice set unpacked
node rig/driver.mjs /path/to/parse.js 3   # renders, writes html.json
# then run the kit scorer with MAKEFUN_OUTPUT_DIR / MAKEFUN_REFERENCE_DIR /
# MAKEFUN_SCORES_DIR set to the rig output, the kit reference and a scores dir
```

Repo total is ~120 KB, well under the 1 MiB cap. No install step, no
WebAssembly, no native addons, no prebuilt binaries, no caching between
cases, deterministic (two runs byte-identical).
