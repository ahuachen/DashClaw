#!/usr/bin/env node

/**
 * Seed Demo: Market Intelligence Briefing
 *
 * Creates a full-stack demo exercising every major DashClaw feature:
 * knowledge collection, 5 capabilities, 3 policies, model strategy,
 * and a 5-step workflow template.
 *
 * Usage:
 *   node scripts/seed-demo-capabilities.mjs
 *
 * Requires DashClaw running at DASHCLAW_URL (default http://localhost:3000)
 * with DASHCLAW_API_KEY set.
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Load .env file (same pattern as other DashClaw scripts)
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, '..', '.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* no .env file — use env vars */ }

// Resolve URL: CLI arg > env var > NEXTAUTH_URL > localhost
const BASE_URL = (
  process.env.DASHCLAW_URL ||
  process.env.NEXTAUTH_URL ||
  'http://localhost:3000'
).replace(/\/$/, '');
const API_KEY = process.env.DASHCLAW_API_KEY || '';

const headers = {
  'Content-Type': 'application/json',
  'x-api-key': API_KEY,
};

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    // If already exists (name conflict), return null to signal skip
    if (res.status === 409 || (data.error && data.error.includes('already exists'))) {
      return null;
    }
    throw new Error(`POST ${path} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function get(path) {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers });
  if (!res.ok) return null;
  return res.json();
}

// ── Check health ────────────────────────────────────────────────────────────

async function checkHealth() {
  try {
    const health = await get('/api/health');
    if (!health || health.status === 'unhealthy') {
      console.error('DashClaw is not healthy. Start it with: npm run dev');
      process.exit(1);
    }
  } catch {
    console.error(`Cannot reach DashClaw at ${BASE_URL}. Start it with: npm run dev`);
    process.exit(1);
  }
}

// ── Knowledge Documents ─────────────────────────────────────────────────────

const PRODUCT_ROADMAP = `# Nexus AI — Product Roadmap

## Company Overview
Nexus AI builds an AI agent orchestration platform focused on enterprise governance.
Our core differentiator is governance-first design: every agent action is auditable,
policy-enforced, and human-reviewable.

## Q2 2026 Priorities
1. **Multi-Agent Workflows** — Orchestrate chains of specialized agents with handoff protocols
2. **Enterprise SSO** — SAML/OIDC for team onboarding
3. **Cost Optimization** — Per-agent budgets, model routing based on task complexity
4. **Compliance Export** — SOC 2 evidence bundles, audit trail export to CSV/PDF

## Competitive Advantage
- Governance-first: policies evaluated before every action, not after
- HITL built in: approval flows for high-risk operations
- Framework-agnostic: works with any agent framework (LangChain, CrewAI, AutoGen, etc.)
- Zero-dependency SDKs in Node.js and Python
`;

const COMPETITIVE_LANDSCAPE = `# Nexus AI — Competitive Landscape

## Competitor A: AgentForge
- **Strengths**: Best-in-class model hosting, 200+ pre-built agent templates
- **Weaknesses**: No governance layer, no approval flows, audit logging is opt-in
- **Threat Level**: Medium — appeals to hobbyists, not enterprise

## Competitor B: FlowOps
- **Strengths**: Visual workflow builder, good CI/CD integration
- **Weaknesses**: No policy engine, no human-in-the-loop, limited to their runtime
- **Threat Level**: High — targeting same enterprise segment

## Competitor C: SafeAgent
- **Strengths**: Strong compliance focus, SOC 2 certified
- **Weaknesses**: No real-time governance (post-hoc auditing only), expensive
- **Threat Level**: Medium — complementary more than competitive

## Key Differentiators for Nexus AI
1. Real-time governance (guard before action, not audit after)
2. Open source core with commercial extensions
3. Works with any framework — not a walled garden
4. Cost: $0 to start, scales with usage
`;

const TARGET_MARKETS = `# Nexus AI — Target Markets

## Tier 1: Enterprise Fintech
- **Why**: Regulatory requirements mandate audit trails for automated decisions
- **Use Case**: Trading agents, fraud detection bots, KYC automation
- **Risk Appetite**: Very low — every action must be explainable
- **Key Requirement**: Immutable decision ledger, policy versioning

## Tier 2: Healthcare AI
- **Why**: HIPAA requires access controls and audit logging for patient data
- **Use Case**: Clinical decision support agents, insurance pre-auth bots
- **Risk Appetite**: Extremely low — patient safety is non-negotiable
- **Key Requirement**: Role-based access, data classification, approval chains

## Tier 3: Government Contractors
- **Why**: FedRAMP and NIST 800-53 mandate strict access controls
- **Use Case**: Document processing agents, compliance verification bots
- **Risk Appetite**: Near zero — oversight is the product
- **Key Requirement**: Air-gapped deployment option, full audit export

## Tier 4: Tech Companies (Growth)
- **Why**: AI adoption outpacing governance — incidents drive demand
- **Use Case**: DevOps agents, customer support bots, code review agents
- **Risk Appetite**: Moderate — willing to trade speed for safety
- **Key Requirement**: Easy setup, developer-friendly SDK, fast time-to-value
`;

// ── Seed Functions ──────────────────────────────────────────────────────────

async function seedKnowledge() {
  console.log('\n📚 Creating knowledge collection...');

  // Check if already exists
  const existing = await get('/api/knowledge/collections');
  const found = existing?.collections?.find(c => c.name === 'Company Strategy');
  if (found) {
    console.log('  Already exists, skipping.');
    return found.collection_id || found.id;
  }

  const result = await post('/api/knowledge/collections', {
    name: 'Company Strategy',
    description: 'Nexus AI strategic documents — product roadmap, competitive landscape, target markets.',
    source_type: 'notes',
    tags: ['strategy', 'demo'],
  });
  const collId = result?.collection?.collection_id || result?.collection?.id;
  console.log(`  Collection: ${collId}`);

  // Add documents
  const docs = [
    { title: 'Product Roadmap', content: PRODUCT_ROADMAP },
    { title: 'Competitive Landscape', content: COMPETITIVE_LANDSCAPE },
    { title: 'Target Markets', content: TARGET_MARKETS },
  ];

  for (const doc of docs) {
    await post(`/api/knowledge/collections/${collId}/items`, {
      title: doc.title,
      source_uri: `inline://${doc.title.toLowerCase().replace(/\s+/g, '-')}`,
      mime_type: 'text/markdown',
      metadata: { content: doc.content },
    });
    console.log(`  + ${doc.title}`);
  }

  // Try to sync embeddings (will fail gracefully if no embedding provider)
  try {
    await post(`/api/knowledge/collections/${collId}/sync`, {});
    console.log('  Embeddings synced.');
  } catch {
    console.log('  Embeddings skipped (no provider configured — semantic search unavailable).');
  }

  return collId;
}

async function seedCapabilities() {
  console.log('\n🔌 Creating capabilities...');

  const capabilities = [
    {
      name: 'Hacker News Top Stories',
      description: 'Fetch the current top story IDs from Hacker News. Returns an array of story IDs sorted by rank.',
      category: 'external_api',
      source_type: 'http_api',
      risk_level: 'low',
      tags: ['research', 'news', 'demo'],
      invocation_schema: {
        endpoint: 'https://hacker-news.firebaseio.com/v0/topstories.json',
        method: 'GET',
        timeout_ms: 10000,
        auth: { type: 'none' },
      },
    },
    {
      name: 'HN Story Detail',
      description: 'Fetch full details for a Hacker News story by ID. Returns title, URL, score, author, and comments.',
      category: 'external_api',
      source_type: 'http_api',
      risk_level: 'low',
      tags: ['research', 'news', 'demo'],
      invocation_schema: {
        endpoint: 'https://hacker-news.firebaseio.com/v0/item/1.json',
        method: 'GET',
        timeout_ms: 10000,
        auth: { type: 'none' },
      },
    },
    {
      name: 'IP Geolocation',
      description: 'Look up geographic location data for an IP address. Returns country, region, city, lat/lon, ISP, and org.',
      category: 'external_api',
      source_type: 'http_api',
      risk_level: 'medium',
      tags: ['enrichment', 'data', 'demo'],
      invocation_schema: {
        endpoint: 'http://ip-api.com/json/8.8.8.8',
        method: 'GET',
        timeout_ms: 10000,
        auth: { type: 'none' },
      },
    },
    {
      name: 'Team Notification',
      description: 'Send a notification payload to the team webhook. Simulates posting to Slack, Teams, or Discord.',
      category: 'webhook',
      source_type: 'http_api',
      risk_level: 'medium',
      tags: ['notification', 'webhook', 'demo'],
      invocation_schema: {
        endpoint: 'https://httpbin.org/post',
        method: 'POST',
        timeout_ms: 15000,
        auth: { type: 'none' },
      },
    },
    {
      name: 'Publish Briefing',
      description: 'Publish a text document to a public paste service. WARNING: This makes content publicly accessible on the internet.',
      category: 'external_api',
      source_type: 'http_api',
      risk_level: 'high',
      requires_approval: true,
      tags: ['publish', 'external', 'demo'],
      invocation_schema: {
        endpoint: 'https://dpaste.org/api/',
        method: 'POST',
        timeout_ms: 15000,
        auth: { type: 'none' },
      },
    },
  ];

  const capIds = {};

  for (const cap of capabilities) {
    // Check if already exists
    const existing = await get(`/api/capabilities?search=${encodeURIComponent(cap.name)}`);
    const found = existing?.capabilities?.find(c => c.name === cap.name);
    if (found) {
      console.log(`  Already exists: ${cap.name}`);
      capIds[cap.name] = found.capability_id || found.id;
      continue;
    }

    const result = await post('/api/capabilities', cap);
    if (result?.capability) {
      const cid = result.capability.capability_id || result.capability.id;
      capIds[cap.name] = cid;
      console.log(`  + ${cap.name} (${cap.risk_level}) → ${cid}`);
    }
  }

  return capIds;
}

async function seedPolicies() {
  console.log('\n🛡️  Creating policies...');

  const policies = [
    {
      name: 'Auto-Allow Research',
      policy_type: 'risk_threshold',
      rules: JSON.stringify({ threshold: 30, action: 'allow' }),
      active: 1,
    },
    {
      name: 'Warn on External Data Access',
      policy_type: 'risk_threshold',
      rules: JSON.stringify({ threshold: 55, action: 'warn' }),
      active: 1,
    },
    {
      name: 'Require Approval for Publishing',
      policy_type: 'risk_threshold',
      rules: JSON.stringify({ threshold: 75, action: 'require_approval' }),
      active: 1,
    },
  ];

  for (const policy of policies) {
    // Check if already exists
    const existing = await get('/api/policies');
    const found = existing?.policies?.find(p => p.name === policy.name);
    if (found) {
      console.log(`  Already exists: ${policy.name}`);
      continue;
    }

    await post('/api/policies', policy);
    console.log(`  + ${policy.name} (${policy.policy_type}: ${JSON.parse(policy.rules).action} at ${JSON.parse(policy.rules).threshold})`);
  }
}

async function seedModelStrategy() {
  console.log('\n🤖 Creating model strategy...');

  const existing = await get('/api/model-strategies');
  const found = existing?.strategies?.find(s => s.name === 'Briefing Analysis');
  if (found) {
    console.log('  Already exists, skipping.');
    return found.strategy_id || found.id;
  }

  const result = await post('/api/model-strategies', {
    name: 'Briefing Analysis',
    description: 'Cost-balanced strategy for market intelligence analysis. Uses Claude Sonnet for speed and cost efficiency.',
    config: {
      primary: { provider: 'anthropic', model: 'claude-sonnet-4-6' },
      costSensitivity: 'balanced',
      maxRetries: 1,
    },
  });

  const stratId = result?.strategy?.strategy_id || result?.strategy?.id;
  console.log(`  + Briefing Analysis → ${stratId}`);
  return stratId;
}

async function seedWorkflow(knowledgeCollId, capIds, modelStrategyId) {
  console.log('\n⚡ Creating workflow template...');

  const existing = await get('/api/workflows/templates');
  const found = existing?.templates?.find(t => t.name === 'Daily Market Briefing');
  if (found) {
    console.log('  Already exists, skipping.');
    return found.template_id || found.id;
  }

  const hnTopStoriesId = capIds['Hacker News Top Stories'];
  const teamNotifyId = capIds['Team Notification'];
  const publishId = capIds['Publish Briefing'];

  const result = await post('/api/workflows/templates', {
    name: 'Daily Market Briefing',
    description: 'Full-stack governance demo: search strategy docs, fetch tech news, analyze relevance, notify team, publish briefing.',
    objective: 'Produce a daily market intelligence briefing by combining internal strategy context with external news, analyzing relevance, and distributing to the team.',
    model_strategy_id: modelStrategyId || undefined,
    linked_knowledge_collection_ids: knowledgeCollId ? [knowledgeCollId] : [],
    linked_capability_ids: [hnTopStoriesId, teamNotifyId, publishId].filter(Boolean),
    status: 'active',
    steps: [
      {
        id: 'search_strategy',
        name: 'Search Strategy Docs',
        type: 'knowledge_search',
        config: {
          collection_id: knowledgeCollId || '',
          query: 'What are our current strategic priorities, key competitive threats, and target market segments?',
          top_k: 5,
        },
      },
      {
        id: 'fetch_news',
        name: 'Fetch HN Top Stories',
        type: 'capability_invoke',
        config: {
          capability_id: hnTopStoriesId || '',
          declared_goal: 'Fetch current top Hacker News stories for market intelligence',
        },
      },
      {
        id: 'analyze',
        name: 'Analyze Relevance',
        type: 'prompt',
        config: {
          prompt: `You are a market intelligence analyst for Nexus AI.

Given our strategic context:
\${steps.search_strategy.output}

And today's top Hacker News stories:
\${steps.fetch_news.output}

Identify the 3 most relevant stories to our business and explain:
1. What the story is about
2. Why it matters to Nexus AI specifically
3. Whether it represents an opportunity or threat
4. Recommended action (if any)

Format as a concise briefing suitable for a leadership team.`,
        },
      },
      {
        id: 'notify_team',
        name: 'Notify Team',
        type: 'capability_invoke',
        config: {
          capability_id: teamNotifyId || '',
          declared_goal: 'Send market intelligence summary to team notification channel',
          payload: {
            channel: '#market-intel',
            text: 'Daily Market Briefing: ${steps.analyze.output}',
          },
        },
      },
      {
        id: 'publish_briefing',
        name: 'Publish Briefing',
        type: 'capability_invoke',
        continue_on_failure: true,
        config: {
          capability_id: publishId || '',
          declared_goal: 'Publish full market intelligence briefing to external paste service for stakeholder access',
          payload: {
            content: '${steps.analyze.output}',
            format: 'text',
            expiry_days: 7,
          },
        },
      },
    ],
  });

  const tmplId = result?.template?.template_id || result?.template?.id;
  console.log(`  + Daily Market Briefing → ${tmplId}`);
  return tmplId;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  DashClaw Demo: Market Intelligence Briefing            ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nTarget: ${BASE_URL}`);

  await checkHealth();

  const knowledgeCollId = await seedKnowledge();
  const capIds = await seedCapabilities();
  await seedPolicies();
  const modelStrategyId = await seedModelStrategy();
  const workflowId = await seedWorkflow(knowledgeCollId, capIds, modelStrategyId);

  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  Demo seeded successfully!                              ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  Knowledge:  1 collection, 3 documents                  ║`);
  console.log(`║  Capabilities: 5 (2 low, 2 medium, 1 high risk)        ║`);
  console.log(`║  Policies:   3 (allow < 30, warn < 55, approve > 75)   ║`);
  console.log(`║  Strategy:   Briefing Analysis (Claude Sonnet)          ║`);
  console.log(`║  Workflow:   Daily Market Briefing (5 steps)            ║`);
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log('║  Next steps:                                           ║');
  console.log(`║  1. Open ${BASE_URL}/mission-control`.padEnd(59) + '║');
  console.log(`║  2. Go to Workflows, find "Daily Market Briefing"`.padEnd(59) + '║');
  console.log(`║  3. Click "Run" and watch Mission Control`.padEnd(59) + '║');
  console.log(`║  4. Approve or deny the publish step in Approvals`.padEnd(59) + '║');
  console.log('╚══════════════════════════════════════════════════════════╝');
}

main();
