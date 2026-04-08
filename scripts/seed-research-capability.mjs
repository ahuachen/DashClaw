#!/usr/bin/env node

/**
 * Seed the Research Agent capability and required org settings in DashClaw.
 *
 * Usage:
 *   node scripts/seed-research-capability.mjs
 *   node scripts/seed-research-capability.mjs --org-id org_default
 *
 * Environment:
 *   DATABASE_URL       - Postgres connection string (or uses default from .env)
 *   RESEARCH_API_URL   - URL of the research-api (e.g., http://localhost:3849)
 *   RESEARCH_API_KEY   - API key for the research-api (e.g., ra_live_abc123)
 *
 * Idempotent - safe to run multiple times. Skips if capability already exists.
 */

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

import './_load-env.mjs';
import { createSqlFromEnv } from './_db.mjs';
import {
  getCapabilityBySlug,
  createCapability,
} from '../app/lib/repositories/capabilities.repository.js';

// --- Config -----------------------------------------------

const args = process.argv.slice(2);
const orgIdIdx = args.indexOf('--org-id');
const ORG_ID = orgIdIdx !== -1 ? args[orgIdIdx + 1] : (process.env.ORG_ID || 'org_default');
const RESEARCH_API_URL = process.env.RESEARCH_API_URL || 'http://localhost:3849';
const RESEARCH_API_KEY = process.env.RESEARCH_API_KEY || '';

const RESEARCH_CAPABILITY = {
  name: 'Research Agent',
  slug: 'research-agent',
  description:
    'Budget-aware research agent that intelligently routes queries between free and paid search sources. Returns synthesized answers with sources and confidence scores.',
  category: 'research',
  source_type: 'http_api',
  auth_type: 'bearer',
  risk_level: 'low',
  requires_approval: false,
  tags: ['research', 'search', 'synthesis', 'web'],
  pricing: { model: 'per_call', estimated_cost_usd: 0.005 },
  health_status: 'unknown',
  invocation_schema: {
    endpoint: `${RESEARCH_API_URL}/v1/research`,
    method: 'POST',
    auth: {
      type: 'bearer',
      token_setting: 'RESEARCH_API_KEY',
    },
    timeout_ms: 60000,
    request_mapping: {
      query: '$.query',
      options: {
        budget: '$.budget',
        mode: '$.mode',
        current: '$.current',
      },
    },
    response_mapping: {
      answer: '$.answer',
      sources: '$.sources',
      confidence: '$.confidence',
      method: '$.method',
      elapsed_ms: '$.elapsedMs',
    },
  },
};

// --- Main -------------------------------------------------

async function main() {
  const sql = createSqlFromEnv();

  console.log(`\n[seed-research] Seeding Research Agent capability...`);
  console.log(`  org: ${ORG_ID}`);
  console.log(`  api: ${RESEARCH_API_URL}\n`);

  // 1. Check if capability already exists
  const existing = await getCapabilityBySlug(sql, ORG_ID, 'research-agent');
  if (existing) {
    console.log(`  Research Agent already exists (${existing.capability_id}). Skipping.`);
  } else {
    const created = await createCapability(sql, ORG_ID, RESEARCH_CAPABILITY);
    console.log(`  Created Research Agent capability: ${created.capability_id}`);
  }
  console.log();

  // 2. Upsert org settings for research API
  console.log('  Setting org settings...');

  const settingsToSet = [
    { key: 'RESEARCH_API_URL', value: RESEARCH_API_URL, description: 'Research Agent API base URL' },
    { key: 'RESEARCH_API_KEY', value: RESEARCH_API_KEY, description: 'Research Agent API bearer token' },
  ];

  for (const { key, value, description } of settingsToSet) {
    if (!value) {
      console.log(`    Skipping ${key} (not set in environment)`);
      continue;
    }

    try {
      await sql`
        INSERT INTO settings (org_id, key, value, description, updated_at)
        VALUES (${ORG_ID}, ${key}, ${value}, ${description}, NOW())
        ON CONFLICT (org_id, key)
        DO UPDATE SET value = ${value}, description = ${description}, updated_at = NOW()
      `;
      console.log(`    Set ${key} = ${key === 'RESEARCH_API_KEY' ? '***' : value}`);
    } catch (err) {
      console.log(`    Warning: Could not set ${key}: ${err.message}`);
    }
  }

  console.log();
  console.log('  Done! Research Agent is now registered as a DashClaw capability.');
  console.log();
  console.log('  Test it with:');
  console.log('    curl -X POST http://localhost:3000/api/capabilities/{id}/invoke \\');
  console.log('      -H "Content-Type: application/json" \\');
  console.log('      -H "x-api-key: YOUR_DASHCLAW_KEY" \\');
  console.log('      -d \'{"query": "What is x402?"}\'\n');

  await sql.end?.();
}

main();
