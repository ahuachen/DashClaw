#!/usr/bin/env node

/**
 * Upload the DashClaw governance skill to Anthropic's Managed Agents API.
 * Creates or updates the custom skill and prints the skill_id.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-xxx node scripts/upload-skill.mjs
 *
 * The skill_id is used in agent creation:
 *   skills: [{ type: "custom", skill_id: "<returned_id>", version: "latest" }]
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dirname, '..', 'public', 'downloads', 'dashclaw-governance');
const API_BASE = 'https://api.anthropic.com/v1';
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('Error: ANTHROPIC_API_KEY environment variable is required.');
  console.error('Usage: ANTHROPIC_API_KEY=sk-xxx node scripts/upload-skill.mjs');
  process.exit(1);
}

// Read skill files
const skillMd = readFileSync(resolve(SKILL_DIR, 'SKILL.md'), 'utf-8');
const patternsRef = readFileSync(resolve(SKILL_DIR, 'references', 'governance-patterns.md'), 'utf-8');

// Parse name from frontmatter
const nameMatch = skillMd.match(/^name:\s*(.+)$/m);
const skillName = nameMatch ? nameMatch[1].trim() : 'dashclaw-governance';

// Parse description from frontmatter
const descMatch = skillMd.match(/description:\s*>\s*\n([\s\S]*?)(?=^---|\n\w)/m);
const skillDescription = descMatch
  ? descMatch[1].replace(/\n\s*/g, ' ').trim()
  : 'DashClaw governance skill for Managed Agents';

console.log(`Uploading skill: ${skillName}`);
console.log(`Description: ${skillDescription.slice(0, 80)}...`);

// Create the skill
const res = await fetch(`${API_BASE}/skills`, {
  method: 'POST',
  headers: {
    'x-api-key': API_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-beta': 'managed-agents-2026-04-01',
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    name: skillName,
    description: skillDescription,
    content: [
      {
        type: 'file',
        filename: 'SKILL.md',
        content: skillMd,
      },
      {
        type: 'file',
        filename: 'references/governance-patterns.md',
        content: patternsRef,
      },
    ],
  }),
});

if (!res.ok) {
  const err = await res.text();
  console.error(`API error (${res.status}):`, err);
  process.exit(1);
}

const skill = await res.json();

console.log('\nSkill created successfully!');
console.log(`  Skill ID:  ${skill.id}`);
console.log(`  Version:   ${skill.version}`);
console.log(`  Name:      ${skill.name}`);
console.log('\nUse in agent creation:');
console.log(`  skills: [{ type: "custom", skill_id: "${skill.id}", version: "latest" }]`);
console.log('\nOr set in your .env:');
console.log(`  DASHCLAW_SKILL_ID=${skill.id}`);
