#!/usr/bin/env node
/**
 * diagnose-hooks.mjs — Summarize `<tempdir>/dashclaw_hook_errors.log`.
 *
 * The DashClaw Claude Code hooks (pretool, posttool, stop) append one-line
 * breadcrumbs to a shared drift log whenever they hit an unexpected state:
 * HTTP errors, disk-I/O failures, orphan tokens, or (when
 * DASHCLAW_HOOK_DEBUG=1) every posttool invocation + exit reason.
 *
 * Reading the raw log is noisy. This CLI groups entries by hook + tag so
 * you can answer questions like:
 *
 *   - Is posttool firing at all? (zero `posttool invoked` lines → upstream bug)
 *   - How many text-only turns in the last N hours?
 *   - Which exit_early reason dominates the posttool miss rate?
 *
 * Usage:
 *   node scripts/diagnose-hooks.mjs              # summary from default tempdir log
 *   node scripts/diagnose-hooks.mjs --tail=20    # show 20 most recent lines too
 *   node scripts/diagnose-hooks.mjs --since=1h   # last hour only (1h, 24h, 7d, ...)
 *   node scripts/diagnose-hooks.mjs --file=/path/to/other.log
 *   node scripts/diagnose-hooks.mjs --clear      # truncate the log after reading
 */

import { readFileSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

function parseArgs(argv) {
  const opts = { tail: 0, since: null, file: null, clear: false };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--tail=')) opts.tail = parseInt(arg.slice(7), 10) || 0;
    else if (arg.startsWith('--since=')) opts.since = arg.slice(8);
    else if (arg.startsWith('--file=')) opts.file = arg.slice(7);
    else if (arg === '--clear') opts.clear = true;
    else if (arg === '-h' || arg === '--help') { printHelp(); process.exit(0); }
  }
  return opts;
}

function printHelp() {
  console.log(`Usage: node scripts/diagnose-hooks.mjs [options]

Options:
  --tail=N       Show the N most recent lines after the summary.
  --since=DUR    Only include entries within DUR of now (e.g. 1h, 24h, 7d, 30m).
  --file=PATH    Read a specific log file instead of the default tempdir one.
  --clear        Truncate the log after reading (clean slate for the next run).
  -h, --help     Show this message.
`);
}

function parseSince(spec) {
  const m = /^(\d+)([smhd])$/.exec(spec);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  const unit = m[2];
  const mul = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit];
  return Date.now() - n * mul;
}

/**
 * Drift-log lines have this shape:
 *   <ISO-8601 timestamp> <hook> <tag>: <message>
 * where hook is one of pretool/posttool/stop and tag is free-form
 * (invoked, exit_early, patched, patch_failed, orphan_tokens, PATCH <id>).
 */
function parseLine(line) {
  const tsEnd = line.indexOf(' ');
  if (tsEnd < 0) return null;
  const ts = line.slice(0, tsEnd);
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return null;

  const rest = line.slice(tsEnd + 1);
  const hookEnd = rest.indexOf(' ');
  if (hookEnd < 0) return null;
  const hook = rest.slice(0, hookEnd);

  const payload = rest.slice(hookEnd + 1);
  const colon = payload.indexOf(':');
  let tag, message;
  if (colon >= 0) {
    // posttool writes `tag: message`
    tag = payload.slice(0, colon).split(' ')[0];
    message = payload.slice(colon + 1).trim();
  } else {
    // stop + pretool write bare messages; first token becomes the tag bucket
    tag = payload.split(' ')[0] || 'unknown';
    message = payload.slice(tag.length).trim();
  }
  return { ts: t, hook, tag, message, raw: line };
}

function summarize(entries) {
  const byHook = {};
  const byHookTag = {};
  const exitEarlyReasons = {};
  const patchFailures = {};
  let firstTs = Infinity;
  let lastTs = 0;

  for (const e of entries) {
    firstTs = Math.min(firstTs, e.ts);
    lastTs = Math.max(lastTs, e.ts);
    byHook[e.hook] = (byHook[e.hook] || 0) + 1;
    const key = `${e.hook}:${e.tag}`;
    byHookTag[key] = (byHookTag[key] || 0) + 1;
    if (e.hook === 'posttool' && e.tag === 'exit_early') {
      // Coalesce reasons by first phrase (up to " (" or end-of-line) so
      // different tool_use_ids don't fragment the histogram.
      const reason = e.message.split(' (')[0].split(' tool_name=')[0].split(' for ')[0];
      exitEarlyReasons[reason] = (exitEarlyReasons[reason] || 0) + 1;
    }
    if (e.tag === 'patch_failed' || e.tag === 'PATCH') {
      const shortMsg = e.message.slice(0, 80);
      patchFailures[shortMsg] = (patchFailures[shortMsg] || 0) + 1;
    }
  }

  return { byHook, byHookTag, exitEarlyReasons, patchFailures, firstTs, lastTs };
}

function printHistogram(label, obj, { max = 5 } = {}) {
  const entries = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, max);
  if (entries.length === 0) return;
  console.log(`\n${label}`);
  const width = Math.max(...entries.map(([k]) => k.length));
  for (const [k, n] of entries) {
    console.log(`  ${k.padEnd(width)}  ${String(n).padStart(6)}`);
  }
}

function main() {
  const opts = parseArgs(process.argv);
  const logPath = opts.file || join(tmpdir(), 'dashclaw_hook_errors.log');

  if (!existsSync(logPath)) {
    console.log(`No hook drift log at: ${logPath}`);
    console.log('Either no errors have been logged yet, or DASHCLAW_HOOK_DEBUG=1');
    console.log("hasn't been set in .env to capture posttool breadcrumbs.");
    process.exit(0);
  }

  const sinceMs = opts.since ? parseSince(opts.since) : null;
  if (opts.since && sinceMs === null) {
    console.error(`Invalid --since value: ${opts.since} (expected Ns/Nm/Nh/Nd)`);
    process.exit(1);
  }

  const raw = readFileSync(logPath, 'utf8');
  const allEntries = raw
    .split('\n')
    .map(parseLine)
    .filter(Boolean);
  const entries = sinceMs ? allEntries.filter((e) => e.ts >= sinceMs) : allEntries;

  console.log(`Log:       ${logPath}`);
  const stat = statSync(logPath);
  console.log(`Size:      ${stat.size.toLocaleString()} bytes`);
  console.log(`Parsed:    ${allEntries.length} lines` + (sinceMs ? ` (${entries.length} in window)` : ''));

  if (entries.length === 0) {
    console.log('\n(no entries in window)');
    return;
  }

  const s = summarize(entries);
  console.log(`Window:    ${new Date(s.firstTs).toISOString()} to ${new Date(s.lastTs).toISOString()}`);

  printHistogram('By hook:', s.byHook);
  printHistogram('By hook:tag:', s.byHookTag, { max: 10 });
  if (Object.keys(s.exitEarlyReasons).length > 0) {
    printHistogram('Posttool exit_early reasons:', s.exitEarlyReasons, { max: 10 });
  }
  if (Object.keys(s.patchFailures).length > 0) {
    printHistogram('Patch failures:', s.patchFailures, { max: 10 });
  }

  if (opts.tail > 0) {
    console.log(`\nLast ${opts.tail} line(s):`);
    for (const e of entries.slice(-opts.tail)) {
      console.log('  ' + e.raw);
    }
  }

  if (opts.clear) {
    writeFileSync(logPath, '');
    console.log(`\nCleared: ${logPath}`);
  }
}

main();
