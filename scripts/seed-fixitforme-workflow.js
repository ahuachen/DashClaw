#!/usr/bin/env node

/**
 * Seed the FixItFor.me Solver workflow template in DashClaw.
 *
 * Usage:
 *   node scripts/seed-fixitforme-workflow.js
 *
 * Requires: DATABASE_URL or .env with Neon connection
 * Idempotent - safe to run multiple times.
 */

import { getSql } from '../app/lib/db.js';
import {
  getWorkflowTemplateBySlug,
  createWorkflowTemplate,
} from '../app/lib/repositories/workflow-templates.repository.js';

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

const ORG_ID = process.env.ORG_ID || 'org_default';

const SOLVER_STEPS = [
  {
    id: 'understand',
    type: 'prompt',
    name: 'Understand Problem',
    config: {
      system_prompt: 'You are a problem analyst. Categorize the user\'s problem, extract requirements, and determine complexity. Output JSON with: category (spreadsheet|website|automation|integration|custom), requirements (array of strings), complexity (simple|medium|complex), summary (one sentence).',
      prompt_template: 'Problem: ${variables.description}\n\nCategory hint: ${variables.category}\n\nUser\'s answers to clarifying questions:\n${variables.answers}',
      max_tokens: 1024,
      temperature: 0.3,
    },
  },
  {
    id: 'research',
    type: 'capability_invoke',
    name: 'Research Approach',
    config: {
      capability_id: '${variables.research_capability_id}',
      body: {
        query: 'How to build a ${variables.category} solution for: ${variables.description}',
        budget: 0.25,
      },
    },
  },
  {
    id: 'plan',
    type: 'prompt',
    name: 'Create Execution Plan',
    config: {
      system_prompt: 'You are a solution planner. Based on the problem analysis and research, create a concrete execution plan. Output JSON with: steps (array of {title, description}), deliverables (array of strings), estimated_time (string), approach (string).',
      prompt_template: 'Problem: ${variables.description}\n\nAnalysis: ${steps.understand.output.text}\n\nResearch findings: ${steps.research.output.answer}\n\nSources: ${steps.research.output.sources}',
      max_tokens: 1024,
      temperature: 0.3,
    },
  },
  {
    id: 'execute',
    type: 'prompt',
    name: 'Build Solution',
    config: {
      system_prompt: 'You are a solution builder. Based on the plan, generate the actual solution artifacts. For spreadsheets: output column definitions and formulas. For websites: output HTML/CSS. For automation: output workflow steps. For integrations: output API configuration. Output JSON with: artifacts (array of {type, name, content}), instructions (array of strings).',
      prompt_template: 'Problem: ${variables.description}\nCategory: ${variables.category}\n\nPlan: ${steps.plan.output.text}\n\nResearch: ${steps.research.output.answer}\n\nBuild the solution now.',
      max_tokens: 2048,
      temperature: 0.2,
    },
  },
  {
    id: 'package',
    type: 'prompt',
    name: 'Package for Delivery',
    config: {
      system_prompt: 'You are a delivery specialist. Package the solution for a non-technical user. No jargon, no AI terminology. Output JSON with: summary (friendly 2-3 sentence description), walkthrough (array of {title, description} steps the user follows), deliverable_descriptions (array of {name, description} explaining each artifact).',
      prompt_template: 'Original problem: ${variables.description}\n\nSolution artifacts: ${steps.execute.output.text}\n\nPackage this for a non-technical user who just wants their problem solved.',
      max_tokens: 1024,
      temperature: 0.4,
    },
  },
];

async function main() {
  const sql = getSql();

  console.log(`Seeding FixItFor.me Solver workflow for org: ${ORG_ID}`);
  console.log();

  // Check if workflow already exists using repository function
  const existing = await getWorkflowTemplateBySlug(sql, ORG_ID, 'fixitforme-solver');

  if (existing) {
    console.log(`  Workflow already exists (${existing.template_id}). Skipping.`);
    console.log(`  Template ID: ${existing.template_id}`);
  } else {
    const created = await createWorkflowTemplate(sql, ORG_ID, {
      name: 'FixItFor.me Solver',
      slug: 'fixitforme-solver',
      description: 'Five-stage problem solver: understand, research, plan, execute, package. Powers the fixitfor.me consumer product.',
      objective: 'Take a user-described problem and produce a working solution with walkthrough.',
      steps: SOLVER_STEPS,
      status: 'active',
    });
    console.log(`  Created workflow template: ${created.template_id}`);
    console.log(`  Template ID: ${created.template_id}`);
  }

  console.log();
  console.log('Done! Set this template ID as DASHCLAW_SOLVER_TEMPLATE_ID in fixitfor-me .env');

  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
