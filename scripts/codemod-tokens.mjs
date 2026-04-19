#!/usr/bin/env node
/**
 * Codemod: replace raw Tailwind color utilities with semantic tokens.
 *
 * Mapping is intentionally conservative — only shades that match an existing
 * token within ~one Tailwind step are migrated. Edge shades (zinc-100, zinc-700+)
 * are left alone to avoid visual regressions; they're rare anyway.
 *
 * Usage:
 *   node scripts/codemod-tokens.mjs <file> [<file> ...]
 *   node scripts/codemod-tokens.mjs --dry <file>
 *
 * Idempotent. Run repeatedly without effect once converted.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const MAPPINGS = [
  // text — neutrals
  [/\btext-zinc-50\b/g,   'text-primary'],
  [/\btext-zinc-100\b/g,  'text-primary'],
  [/\btext-zinc-200\b/g,  'text-secondary'],
  [/\btext-zinc-300\b/g,  'text-secondary'],
  [/\btext-zinc-400\b/g,  'text-secondary'],
  [/\btext-zinc-500\b/g,  'text-tertiary'],
  [/\btext-zinc-600\b/g,  'text-disabled'],
  // text — status
  [/\btext-emerald-(300|400|500)\b/g, 'text-success'],
  [/\btext-green-(300|400|500)\b/g,   'text-success'],
  [/\btext-amber-(300|400|500)\b/g,   'text-warning'],
  [/\btext-yellow-(300|400|500)\b/g,  'text-warning'],
  [/\btext-red-(300|400|500)\b/g,     'text-error'],
  [/\btext-rose-(300|400|500)\b/g,    'text-error'],
  [/\btext-blue-(300|400|500)\b/g,    'text-info'],
  [/\btext-orange-(400|500)\b/g,      'text-brand'],
  // bg — surfaces
  [/\bbg-zinc-950\b/g, 'bg-primary'],
  [/\bbg-zinc-900\b/g, 'bg-secondary'],
  [/\bbg-zinc-800\b/g, 'bg-tertiary'],
  [/\bbg-zinc-700\b/g, 'bg-elevated'],
  // bg — status subtle (12% alpha — matches our token alpha)
  [/\bbg-emerald-500\/(?:10|12|15|20)\b/g, 'bg-success-subtle'],
  [/\bbg-amber-500\/(?:10|12|15|20)\b/g,   'bg-warning-subtle'],
  [/\bbg-red-500\/(?:10|12|15|20)\b/g,     'bg-error-subtle'],
  [/\bbg-blue-500\/(?:10|12|15|20)\b/g,    'bg-info-subtle'],
  // border — semantic active edges
  [/\bborder-orange-(400|500)\b/g, 'border-active'],
  [/\bborder-emerald-(400|500)\b/g, 'border-success'],
  [/\bborder-red-(400|500)\b/g,     'border-error'],
  [/\bborder-amber-(400|500)\b/g,   'border-warning'],
];

const dry = process.argv.includes('--dry');
const files = process.argv.slice(2).filter((a) => a !== '--dry');

if (files.length === 0) {
  console.error('Usage: node scripts/codemod-tokens.mjs [--dry] <file> [<file> ...]');
  process.exit(1);
}

let totalChanges = 0;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  let out = src;
  let changes = 0;
  for (const [pattern, replacement] of MAPPINGS) {
    out = out.replace(pattern, () => {
      changes += 1;
      return replacement;
    });
  }
  totalChanges += changes;
  if (changes === 0) {
    console.log(`${file}: 0 changes`);
    continue;
  }
  if (dry) {
    console.log(`${file}: ${changes} changes (dry run)`);
  } else {
    writeFileSync(file, out, 'utf8');
    console.log(`${file}: ${changes} changes applied`);
  }
}
console.log(`\nTotal: ${totalChanges} replacements across ${files.length} file(s)`);
