#!/usr/bin/env node

/**
 * Seed: Scoring Profiles + Risk Templates
 *
 * Creates starter scoring profiles and risk templates so the /scoring page
 * has real data to display. Also scores sample actions to populate Score Explorer.
 *
 * Safe to re-run -- checks for existing data before inserting.
 *
 * Usage:
 *   node scripts/seed-scoring.mjs
 *   node scripts/seed-scoring.mjs --org-id org_default
 */

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

import './_load-env.mjs';
import { createSqlFromEnv } from './_db.mjs';
import {
  createProfile,
  addDimension,
  listProfiles,
  createRiskTemplate,
  listRiskTemplates,
  scoreAction,
} from '../app/lib/scoringProfiles.js';

// --- Config -----------------------------------------------

const args = process.argv.slice(2);
const orgIdIdx = args.indexOf('--org-id');
const ORG_ID = orgIdIdx !== -1 ? args[orgIdIdx + 1] : 'org_default';

// --- Helpers ----------------------------------------------

function log(msg) { console.log(`  ${msg}`); }
function ok(msg)  { console.log(`  ✓ ${msg}`); }
function skip(msg){ console.log(`  ~ ${msg} (already exists)`); }

// --- Risk Templates ---------------------------------------

const RISK_TEMPLATES = [
  {
    name: 'Production Safety',
    description: 'Increases risk for production-targeting, data-modifying, or irreversible actions.',
    action_type: null,
    base_risk: 15,
    rules: [
      { condition: "metadata.environment == 'production'", add: 30 },
      { condition: "metadata.modifies_data == true", add: 20 },
      { condition: "metadata.irreversible == true", add: 25 },
      { condition: "metadata.affects_users == true", add: 15 },
    ],
  },
  {
    name: 'External API Safety',
    description: 'Risk rules for outbound API calls — escalates for unauthenticated or external targets.',
    action_type: 'api_call',
    base_risk: 10,
    rules: [
      { condition: "metadata.auth == 'none'", add: 40 },
      { condition: "metadata.is_external == true", add: 20 },
      { condition: "metadata.retries > 3", add: 15 },
    ],
  },
];

// --- Scoring Profiles -------------------------------------

const SCORING_PROFILES = [
  {
    name: 'General Action Quality',
    description: 'Balanced multi-dimensional quality score for any agent action. Good starting point.',
    action_type: null,
    composite_method: 'weighted_average',
    dimensions: [
      {
        name: 'Risk Control',
        data_source: 'risk_score',
        weight: 0.35,
        scale: [
          { label: 'excellent', operator: 'lte', value: 20, score: 100 },
          { label: 'good',      operator: 'lte', value: 40, score: 75 },
          { label: 'acceptable',operator: 'lte', value: 65, score: 45 },
          { label: 'poor',      operator: 'gt',  value: 65, score: 10 },
        ],
      },
      {
        name: 'Confidence',
        data_source: 'confidence',
        weight: 0.30,
        scale: [
          { label: 'excellent', operator: 'gte', value: 0.85, score: 100 },
          { label: 'good',      operator: 'gte', value: 0.70, score: 75 },
          { label: 'acceptable',operator: 'gte', value: 0.50, score: 45 },
          { label: 'poor',      operator: 'lt',  value: 0.50, score: 10 },
        ],
      },
      {
        name: 'Speed',
        data_source: 'duration_ms',
        weight: 0.20,
        scale: [
          { label: 'excellent', operator: 'lte', value: 2000,  score: 100 },
          { label: 'good',      operator: 'lte', value: 8000,  score: 75 },
          { label: 'acceptable',operator: 'lte', value: 30000, score: 45 },
          { label: 'poor',      operator: 'gt',  value: 30000, score: 10 },
        ],
      },
      {
        name: 'Cost Efficiency',
        data_source: 'cost_estimate',
        weight: 0.15,
        scale: [
          { label: 'excellent', operator: 'lte', value: 0.005, score: 100 },
          { label: 'good',      operator: 'lte', value: 0.02,  score: 75 },
          { label: 'acceptable',operator: 'lte', value: 0.10,  score: 45 },
          { label: 'poor',      operator: 'gt',  value: 0.10,  score: 10 },
        ],
      },
    ],
  },
  {
    name: 'Strict Safety Profile',
    description: 'Uses minimum composite method — a single poor dimension tanks the score. For critical actions.',
    action_type: null,
    composite_method: 'minimum',
    dimensions: [
      {
        name: 'Risk Gate',
        data_source: 'risk_score',
        weight: 1.0,
        scale: [
          { label: 'excellent', operator: 'lte', value: 25, score: 100 },
          { label: 'good',      operator: 'lte', value: 50, score: 70 },
          { label: 'poor',      operator: 'gt',  value: 50, score: 0 },
        ],
      },
      {
        name: 'Confidence Gate',
        data_source: 'confidence',
        weight: 1.0,
        scale: [
          { label: 'excellent', operator: 'gte', value: 0.80, score: 100 },
          { label: 'good',      operator: 'gte', value: 0.60, score: 70 },
          { label: 'poor',      operator: 'lt',  value: 0.60, score: 0 },
        ],
      },
    ],
  },
];

// --- Sample Actions for Score Explorer --------------------

const SAMPLE_ACTIONS = [
  { action_type: 'api_call',  risk_score: 18, confidence: 0.92, duration_ms: 1200,  cost_estimate: 0.003 },
  { action_type: 'api_call',  risk_score: 45, confidence: 0.71, duration_ms: 4500,  cost_estimate: 0.015 },
  { action_type: 'deploy',    risk_score: 72, confidence: 0.65, duration_ms: 28000, cost_estimate: 0.04  },
  { action_type: 'research',  risk_score: 12, confidence: 0.95, duration_ms: 850,   cost_estimate: 0.008 },
  { action_type: 'file_write',risk_score: 35, confidence: 0.88, duration_ms: 600,   cost_estimate: 0.001 },
];

// --- Main -------------------------------------------------

async function main() {
  console.log('\n[seed-scoring] Seeding scoring profiles and risk templates...');
  console.log(`  org: ${ORG_ID}\n`);

  const sql = createSqlFromEnv();

  // --- Risk Templates ---
  console.log('Risk Templates:');
  const existingTemplates = await listRiskTemplates(sql, ORG_ID, {});
  const existingTemplateNames = new Set(existingTemplates.map(t => t.name));

  for (const tmpl of RISK_TEMPLATES) {
    if (existingTemplateNames.has(tmpl.name)) {
      skip(tmpl.name);
      continue;
    }
    await createRiskTemplate(sql, ORG_ID, tmpl);
    ok(tmpl.name);
  }

  // --- Scoring Profiles ---
  console.log('\nScoring Profiles:');
  const existingProfiles = await listProfiles(sql, ORG_ID, {});
  const existingProfileNames = new Set(existingProfiles.map(p => p.name));

  const createdProfiles = [];

  for (const prof of SCORING_PROFILES) {
    if (existingProfileNames.has(prof.name)) {
      skip(prof.name);
      const existing = existingProfiles.find(p => p.name === prof.name);
      if (existing) createdProfiles.push(existing);
      continue;
    }

    const { dimensions, ...profileData } = prof;
    const profile = await createProfile(sql, ORG_ID, profileData);
    log(`Creating "${prof.name}"...`);

    for (let i = 0; i < dimensions.length; i++) {
      await addDimension(sql, ORG_ID, profile.id, { ...dimensions[i], sort_order: i });
    }

    createdProfiles.push(profile);
    ok(`${prof.name} (${dimensions.length} dimensions)`);
  }

  // --- Sample Scores ---
  console.log('\nSample Scores (Score Explorer):');
  const generalProfile = createdProfiles[0];
  if (!generalProfile) {
    log('No profile available to score against — skipping sample scores.');
  } else {
    const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM profile_scores WHERE org_id = ${ORG_ID} AND profile_id = ${generalProfile.id}`;

    if (count >= SAMPLE_ACTIONS.length) {
      skip(`${count} scores already exist for "${generalProfile.name}"`);
    } else {
      let scored = 0;
      for (const action of SAMPLE_ACTIONS) {
        try {
          await scoreAction(sql, ORG_ID, generalProfile.id, action);
          scored++;
        } catch (err) {
          log(`  warn: ${err.message}`);
        }
      }
      ok(`Scored ${scored} sample actions against "${generalProfile.name}"`);
    }
  }

  console.log('\n[seed-scoring] Done.\n');
  console.log('  Next steps:');
  console.log('  1. Visit /scoring to see your profiles and risk templates');
  console.log('  2. Go to Score Explorer to see sample scores');
  console.log('  3. Once you have 10+ real actions, run Calibrate to tune thresholds');
  console.log('  4. Use dc.scoreWithProfile(profileId, action) in your agent code\n');

  await sql.end?.();
}

main();
