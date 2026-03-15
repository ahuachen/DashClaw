import { lcg, pick, int, isoFromNow, isoInFuture, stableId, DEMO_ORG, BASE_NOW, MS_MINUTE, MS_HOUR, MS_DAY } from './fixtures/shared-utils.js';
import { agents as journeyAgents, actions as journeyActions } from './fixtures/journey-agents.js';
import { agents as featureAgents, actions as featureActions } from './fixtures/feature-agents.js';
import { agents as personaAgents, actions as personaActions } from './fixtures/persona-agents.js';
import { agents as realisticAgents, actions as realisticActions } from './fixtures/realistic-agents.js';
import { agents as backgroundAgents, actions as backgroundActions } from './fixtures/background-agents.js';
import { assumptions as tutorialAssumptions } from './fixtures/tutorial-assumptions.js';
import { handoffs as tutorialHandoffs } from './fixtures/tutorial-handoffs.js';
import { policies as guardPolicies, guardDecisions as guardDecisionsData } from './fixtures/guard-fixtures.js';
import { complianceData } from './fixtures/compliance-fixtures.js';

let _cached = null;

function buildFixtures() {
  const rnd = lcg(0xD15C1A57);

  // ── Governance Core: Agents and Actions ──
  const agents = [
    ...journeyAgents,
    ...featureAgents,
    ...personaAgents,
    ...realisticAgents,
    ...backgroundAgents,
  ];

  const actions = [
    ...journeyActions,
    ...featureActions,
    ...personaActions,
    ...realisticActions,
    ...backgroundActions,
  ];

  // ── Governance Primitives: Loops and Assumptions ──
  const loops = Array.from({ length: 10 }).map((_, i) => {
    const action = pick(rnd, actions);
    const loopType = pick(rnd, ['approval', 'review', 'dependency']);
    const priority = pick(rnd, ['high', 'critical']);
    return {
      org_id: DEMO_ORG,
      loop_id: stableId('loop_demo', i + 1),
      action_id: action.action_id,
      loop_type: loopType,
      description: `${loopType}: ${pick(rnd, ['get approval', 'validate integrity', 'coordinate rollout', 'review security logs'])}`,
      status: 'open',
      priority,
      owner: null,
      created_at: isoFromNow(int(rnd, 10, 800) * 60 * 1000),
      resolved_at: null,
      resolution: null,
      agent_id: action.agent_id,
      agent_name: action.agent_name,
      declared_goal: action.declared_goal,
      action_type: action.action_type,
    };
  });

  const assumptions = tutorialAssumptions;

  // ── Governance Decisions ──
  const decisions = Array.from({ length: 18 }).map((_, i) => {
    const agent = pick(rnd, agents);
    const outcome = pick(rnd, ['success', 'failure', 'pending']);
    const minutesAgo = 30 + i * 17;
    return {
      id: stableId('dec_demo', i + 1),
      org_id: DEMO_ORG,
      agent_id: agent.agent_id,
      decision: pick(rnd, [
        'Require pairing approvals for verified agents.',
        'Throttle risky actions behind HITL.',
        'Prefer read-only scopes for integrations by default.',
        'Policy block: risk score exceeded threshold.',
        'Decision allowed: context verified by operator.',
      ]),
      context: pick(rnd, [
        'Production environment access requested.',
        'High risk score detected (85).',
        'Auditability is mandatory for this scope.',
        '',
      ]),
      reasoning: null,
      outcome,
      confidence: int(rnd, 45, 95),
      timestamp: isoFromNow(minutesAgo * 60 * 1000),
      tags: pick(rnd, ['security', 'governance', 'reliability', 'compliance']),
    };
  });

  // ── Governance Lessons ──
  const lessons = Array.from({ length: 10 }).map((_, i) => ({
    id: stableId('les_demo', i + 1),
    org_id: DEMO_ORG,
    lesson: pick(rnd, [
      'Pairing beats manual key upload for beginners.',
      'Bulk approvals are essential for 50+ agents.',
      'Explicit risk scoring prevents autonomy spikes.',
      'Decision evidence must be immutable.',
    ]),
    confidence: int(rnd, 65, 96),
    times_validated: int(rnd, 0, 12),
    source_decisions: null,
    timestamp: isoFromNow((12 + i * 29) * 60 * 1000),
  }));

  // ── PRUNED: Tier 4 Legacy Arrays ──
  const goals = [];
  const contacts = [];
  const interactions = [];
  const events = [];
  const ideas = [];
  const tokenHistory = [];
  const tokensCurrent = null;
  const tokensToday = { estimatedCost: 0 };
  const content = [];
  const messageThreads = [];
  const sharedDocs = [];
  const messages = [];
  const contextPoints = [];
  const contextThreads = [];
  const contextEntries = [];
  const snippets = [];
  const preferences = { preferences: [], recent_moods: [], top_approaches: [] };
  const workflows = [];
  const executions = [];
  const schedules = [];
  const webhooks = [];
  const webhookDeliveries = {};
  const activityLogs = [];

  // ── Governance Setup and Infrastructure ──
  const policies = guardPolicies;
  const guardDecisions = guardDecisionsData;
  const handoffs = tutorialHandoffs;

  const teamOrg = {
    id: DEMO_ORG,
    name: 'Demo Governance Workspace',
    plan: 'open_source',
    created_at: isoFromNow(60 * 24 * 60 * 60 * 1000),
  };

  const teamMembers = [
    { id: 'demo_user', org_id: DEMO_ORG, email: 'viewer@example.com', name: 'Demo Viewer', image: null, role: 'admin', created_at: isoFromNow(60 * 24 * 60 * 60 * 1000) },
  ];

  const teamInvites = [];

  const usage = {
    actions_count: 220,
    agents_count: agents.length,
    members_count: teamMembers.length,
    keys_count: 1,
  };

  const settings = [
    { org_id: DEMO_ORG, key: 'demo_mode', value: 'true', encrypted: 0 },
    { org_id: DEMO_ORG, key: 'governance_runtime', value: 'v2', encrypted: 0 },
  ];

  const memory = {
    health: { score: 92, status: 'healthy', issues: [] },
    entities: [
      { name: 'DashClaw v2', type: 'system', mentions: 45 },
      { name: 'Guard Policy', type: 'concept', mentions: 32 },
      { name: 'Evidence Ledger', type: 'concept', mentions: 28 },
    ],
    topics: ['governance', 'security', 'compliance', 'reliability'],
  };

  const recommendations = Array.from({ length: 6 }).map((_, i) => ({
    id: stableId('lrec', i + 1),
    org_id: DEMO_ORG,
    action_type: pick(rnd, ['deploy', 'security', 'monitor']),
    recommendation: pick(rnd, [
      'Increase risk score for prod deploys.',
      'Require approval for all security scans.',
      'Enable read-only enforcement for this agent.',
    ]),
    basis: 'Observed variance in manual risk scoring.',
    confidence: int(rnd, 70, 95),
    created_at: isoFromNow(int(rnd, 1, 10) * 24 * MS_HOUR),
  }));

  const metrics = [];
  const metricsSummary = {
    total_actions: 220,
    avg_risk: 42,
    blocks_count: 12,
    approvals_count: 8,
  };

  const securityStatus = {
    active_signals: 4,
    high_risk_actions: 12,
    unscoped_actions: 8,
    invalid_assumptions: 2,
  };

  const decisionMetrics = {
    total: 142,
    completed: 118,
    failed: 12,
    cancelled: 6,
    approval: 6,
    change_percent: 18,
  };

  const signals = [
    { severity: 'red', type: 'autonomy_spike', agent_id: 'deploy-bot', created_at: isoFromNow(MS_HOUR) },
    { severity: 'amber', type: 'stale_action', agent_id: 'security-scanner', created_at: isoFromNow(2 * MS_HOUR) },
  ];

  const routingHealth = { status: 'healthy' };
  const routingStats = { total_tasks: 0, completed: 0, pending: 0 };
  const routingAgents = [];
  const routingTasks = [];

  const complianceFrameworks = complianceData.frameworks;
  const complianceMap = complianceData.map;
  const complianceGaps = complianceData.gaps;
  const complianceEvidence = complianceData.evidence;

  const policyTestResults = { passed: 12, failed: 0 };
  const policyProofReport = { org_id: DEMO_ORG, status: 'valid', verified_at: isoFromNow(0) };

  const evalScorers = [];
  const evalScores = [];
  const evalRuns = [];
  const evalStats = { total_runs: 0, avg_score: 0 };

  const promptTemplates = [
    { id: 'pt_demo_001', org_id: DEMO_ORG, name: 'Agent Quality Auditor', slug: 'agent-quality-auditor', description: 'Evaluates agent decisions based on goal alignment and risk.', current_version: 3, total_runs: 124, created_at: isoFromNow(30 * MS_DAY) },
    { id: 'pt_demo_002', org_id: DEMO_ORG, name: 'Security Signal Analyzer', slug: 'security-signal-analyzer', description: 'Analyzes security signals for potential false positives.', current_version: 1, total_runs: 45, created_at: isoFromNow(15 * MS_DAY) },
  ];

  const promptVersions = {
    pt_demo_001: [
      { id: 'pv_demo_001_3', template_id: 'pt_demo_001', version: 3, content: 'Analyze decision quality...', created_at: isoFromNow(5 * MS_DAY) },
      { id: 'pv_demo_001_2', template_id: 'pt_demo_001', version: 2, content: 'Analyze decision...', created_at: isoFromNow(10 * MS_DAY) },
    ],
  };

  const promptRuns = [
    { id: 'prun_demo_001', template_id: 'pt_demo_001', version_id: 'pv_demo_001_3', agent_id: 'agent_01', score: 85, status: 'completed', created_at: isoFromNow(MS_HOUR) },
    { id: 'prun_demo_002', template_id: 'pt_demo_001', version_id: 'pv_demo_001_3', agent_id: 'agent_02', score: 92, status: 'completed', created_at: isoFromNow(2 * MS_HOUR) },
  ];

  const promptStats = {
    available: true,
    overall: {
      total_runs: 169,
      avg_tokens: 1240,
      today_count: 12,
    },
    total_templates: 2,
  };

  const feedbackEntries = [];
  const feedbackStats = { total_entries: 0, avg_sentiment: 0 };

  const driftAlerts = [];
  const driftStats = { active_alerts: 0 };
  const driftSnapshots = [];

  const learningVelocity = [];
  const learningCurves = [];
  const learningAnalyticsSummary = { total_lessons: 10, total_decisions: 18 };

  const scoringProfiles = [];

  const riskTemplates = [
    {
      id: 'rt_demo001', org_id: DEMO_ORG, name: 'Production Safety', action_type: null, status: 'active',
      base_risk: 20,
      rules: [
        { condition: "metadata.environment == 'production'", add: 20 },
        { condition: "metadata.modifies_data == true", add: 15 },
        { condition: "metadata.irreversible == true", add: 25 },
      ],
    },
  ];

  return {
    agents,
    actions,
    loops,
    assumptions,
    decisions,
    lessons,
    goals,
    contacts,
    interactions,
    events,
    ideas,
    tokenHistory,
    tokensCurrent,
    tokensToday,
    content,
    policies,
    guardDecisions,
    messages,
    messageThreads,
    sharedDocs,
    contextPoints,
    contextThreads,
    contextEntries,
    handoffs,
    snippets,
    preferences,
    workflows,
    executions,
    schedules,
    webhooks,
    webhookDeliveries,
    activityLogs,
    teamOrg,
    teamMembers,
    teamInvites,
    usage,
    settings,
    memory,
    signals,
    decisionMetrics,
    recommendations,
    metrics,
    metricsSummary,
    securityStatus,
    routingHealth,
    routingStats,
    routingAgents,
    routingTasks,
    complianceFrameworks,
    complianceMap,
    complianceGaps,
    complianceEvidence,
    policyTestResults,
    policyProofReport,
    evalScorers,
    evalScores,
    evalRuns,
    evalStats,
    promptTemplates,
    promptVersions,
    promptRuns,
    promptStats,
    feedbackEntries,
    feedbackStats,
    driftAlerts,
    driftStats,
    driftSnapshots,
    learningVelocity,
    learningCurves,
    learningAnalyticsSummary,
    scoringProfiles,
    riskTemplates,
  };
}

export function getDemoFixtures() {
  if (_cached) return _cached;
  _cached = buildFixtures();
  return _cached;
}
