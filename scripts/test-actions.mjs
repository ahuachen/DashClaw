#!/usr/bin/env node

/**
 * ActionRecord Control Plane - Integration Test Script
 *
 * Tests all API endpoints and the SDK end-to-end.
 * Requires the dev server running: npm run dev
 *
 * Usage:
 *   node scripts/test-actions.mjs
 *   node scripts/test-actions.mjs http://localhost:3000
 *   DASHCLAW_API_KEY=xxx node scripts/test-actions.mjs https://your-app.vercel.app
 */

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const API_KEY = process.env.DASHCLAW_API_KEY || '';

let passed = 0;
let failed = 0;
const results = [];

function log(icon, msg) {
  console.log(`  ${icon} ${msg}`);
}

function assert(condition, label) {
  if (condition) {
    passed++;
    results.push({ label, ok: true });
    log('✅', label);
  } else {
    failed++;
    results.push({ label, ok: false });
    log('❌', label);
  }
}

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (API_KEY) headers['x-api-key'] = API_KEY;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { error: `Non-JSON response (${res.status})`, body: text.slice(0, 200) };
  }
  return { status: res.status, data };
}

// ──────────────────────────────────────────────
// Phase 1: Core API
// ──────────────────────────────────────────────

async function testCoreAPI() {
  console.log('\n━━━ Phase 1: Core API ━━━');

  // POST - Create action
  const { status: s1, data: d1 } = await request('POST', '/api/actions', {
    agent_id: 'test-agent-1',
    agent_name: 'Test Agent',
    action_type: 'build',
    declared_goal: 'Integration test action',
    reasoning: 'Testing the ActionRecord API end-to-end',
    systems_touched: ['local', 'test-db'],
    risk_score: 25,
    confidence: 90,
    reversible: true
  });
  assert(s1 === 201, `POST /api/actions returns 201 (got ${s1})`);
  assert(d1.action_id && d1.action_id.startsWith('act_'), `action_id is auto-generated: ${d1.action_id}`);
  const actionId = d1.action_id;

  // POST - Create second action (for stats)
  const { status: s1b } = await request('POST', '/api/actions', {
    agent_id: 'test-agent-1',
    agent_name: 'Test Agent',
    action_type: 'deploy',
    declared_goal: 'Second test action for stats',
    risk_score: 75,
    confidence: 60,
    reversible: false
  });
  assert(s1b === 201 || s1b === 202, `POST second action returns 201 or 202 (got ${s1b})`);

  // GET - List actions
  const { status: s2, data: d2 } = await request('GET', '/api/actions?limit=10');
  assert(s2 === 200, `GET /api/actions returns 200 (got ${s2})`);
  assert(Array.isArray(d2.actions), 'Response has actions array');
  assert(d2.actions.length >= 2, `At least 2 actions returned (got ${d2.actions.length})`);
  assert(d2.stats && d2.stats.total !== undefined, 'Response includes stats');

  // GET - Filter by agent_id
  const { status: s3, data: d3 } = await request('GET', '/api/actions?agent_id=test-agent-1');
  assert(s3 === 200, 'GET with agent_id filter returns 200');
  assert(d3.actions.every(a => a.agent_id === 'test-agent-1'), 'All results match agent_id filter');

  // GET - Filter by risk_min
  const { status: s4, data: d4 } = await request('GET', '/api/actions?risk_min=70');
  assert(s4 === 200, 'GET with risk_min filter returns 200');
  assert(d4.actions.every(a => parseInt(a.risk_score, 10) >= 70), 'All results have risk_score >= 70');

  // GET - Single action
  const { status: s5, data: d5 } = await request('GET', `/api/actions/${actionId}`);
  assert(s5 === 200, `GET /api/actions/${actionId} returns 200`);
  assert(d5.action.action_id === actionId, 'Returned correct action');
  assert(Array.isArray(d5.open_loops), 'Includes open_loops array');
  assert(Array.isArray(d5.assumptions), 'Includes assumptions array');

  // GET - 404 for missing action
  const { status: s6 } = await request('GET', '/api/actions/act_nonexistent');
  assert(s6 === 404, 'GET missing action returns 404');

  // PATCH - Update outcome
  const { status: s7, data: d7 } = await request('PATCH', `/api/actions/${actionId}`, {
    status: 'completed',
    output_summary: 'Test completed successfully',
    side_effects: ['created test records'],
    artifacts_created: ['test-report.json'],
    duration_ms: 1500,
    cost_estimate: 0.003
  });
  assert(s7 === 200, `PATCH /api/actions/${actionId} returns 200`);
  assert(d7.action.status === 'completed', 'Status updated to completed');

  // PATCH - 404 for missing action
  const { status: s8 } = await request('PATCH', '/api/actions/act_nonexistent', { status: 'failed' });
  assert(s8 === 404, 'PATCH missing action returns 404');

  return actionId;
}

// ──────────────────────────────────────────────
// Phase 2: Validation
// ──────────────────────────────────────────────

async function testValidation() {
  console.log('\n━━━ Phase 2: Validation ━━━');

  // Missing required fields
  const { status: s1, data: d1 } = await request('POST', '/api/actions', {
    agent_name: 'Bad Agent'
    // missing: agent_id, action_type, declared_goal
  });
  assert(s1 === 400, `Missing required fields returns 400 (got ${s1})`);
  assert(d1.details && d1.details.length >= 3, `Reports ${d1.details?.length || 0} validation errors`);

  // Invalid enum value
  const { status: s2 } = await request('POST', '/api/actions', {
    agent_id: 'test',
    action_type: 'invalid_type',
    declared_goal: 'Test'
  });
  assert(s2 === 400, 'Invalid action_type returns 400');

  // Risk score out of range
  const { status: s3 } = await request('POST', '/api/actions', {
    agent_id: 'test',
    action_type: 'build',
    declared_goal: 'Test',
    risk_score: 200
  });
  assert(s3 === 400, 'risk_score > 100 returns 400');

  // PATCH with no outcome fields
  // Need a valid action first
  const { data: temp } = await request('POST', '/api/actions', {
    agent_id: 'val-test',
    action_type: 'test',
    declared_goal: 'Validation target'
  });
  const { status: s4 } = await request('PATCH', `/api/actions/${temp.action_id}`, {
    agent_id: 'trying to change identity'
  });
  assert(s4 === 400, 'PATCH with no valid outcome fields returns 400');
}

// ──────────────────────────────────────────────
// Phase 3: Open Loops
// ──────────────────────────────────────────────

async function testOpenLoops(actionId) {
  console.log('\n━━━ Phase 3: Open Loops ━━━');

  // POST - Create loop
  const { status: s1, data: d1 } = await request('POST', '/api/actions/loops', {
    action_id: actionId,
    loop_type: 'followup',
    description: 'Need to verify test results with team',
    priority: 'high',
    owner: 'wes'
  });
  assert(s1 === 201, `POST /api/actions/loops returns 201 (got ${s1})`);
  assert(d1.loop_id && d1.loop_id.startsWith('loop_'), `loop_id generated: ${d1.loop_id}`);
  const loopId = d1.loop_id;

  // POST - Create second loop
  const { status: s1b, data: d1b } = await request('POST', '/api/actions/loops', {
    action_id: actionId,
    loop_type: 'approval',
    description: 'Needs sign-off before production deploy',
    priority: 'critical'
  });
  assert(s1b === 201, 'Second loop created');

  // POST - Invalid parent
  const { status: s2 } = await request('POST', '/api/actions/loops', {
    action_id: 'act_nonexistent',
    loop_type: 'followup',
    description: 'Orphan loop'
  });
  assert(s2 === 404, 'Loop with invalid parent returns 404');

  // GET - List open loops
  const { status: s3, data: d3 } = await request('GET', '/api/actions/loops?status=open');
  assert(s3 === 200, 'GET /api/actions/loops returns 200');
  assert(Array.isArray(d3.loops), 'Response has loops array');
  assert(d3.stats && d3.stats.open_count !== undefined, 'Response includes stats');

  // GET - Single loop
  const { status: s4, data: d4 } = await request('GET', `/api/actions/loops/${loopId}`);
  assert(s4 === 200, `GET /api/actions/loops/${loopId} returns 200`);
  assert(d4.loop.loop_id === loopId, 'Returned correct loop');
  assert(d4.loop.agent_id, 'Loop includes parent action agent_id');

  // PATCH - Resolve loop
  const { status: s5, data: d5 } = await request('PATCH', `/api/actions/loops/${loopId}`, {
    status: 'resolved',
    resolution: 'Team confirmed test results are valid'
  });
  assert(s5 === 200, 'PATCH resolve loop returns 200');
  assert(d5.loop.status === 'resolved', 'Loop status is resolved');
  assert(d5.loop.resolved_at, 'resolved_at is set');

  // PATCH - Can't resolve already resolved
  const { status: s6 } = await request('PATCH', `/api/actions/loops/${loopId}`, {
    status: 'resolved',
    resolution: 'Double resolve'
  });
  assert(s6 === 409, 'Resolving already-resolved loop returns 409');

  // PATCH - Cancel the second loop
  const { status: s7 } = await request('PATCH', `/api/actions/loops/${d1b.loop_id}`, {
    status: 'cancelled'
  });
  assert(s7 === 200, 'Cancel loop returns 200');

  return loopId;
}

// ──────────────────────────────────────────────
// Phase 4: Assumptions
// ──────────────────────────────────────────────

async function testAssumptions(actionId) {
  console.log('\n━━━ Phase 4: Assumptions ━━━');

  // POST - Create assumption
  const { status: s1, data: d1 } = await request('POST', '/api/actions/assumptions', {
    action_id: actionId,
    assumption: 'Database schema is up to date',
    basis: 'Ran migrations 5 minutes ago'
  });
  assert(s1 === 201, `POST /api/actions/assumptions returns 201 (got ${s1})`);
  assert(d1.assumption_id && d1.assumption_id.startsWith('asm_'), `assumption_id generated: ${d1.assumption_id}`);

  // POST - Create second assumption
  const { status: s1b } = await request('POST', '/api/actions/assumptions', {
    action_id: actionId,
    assumption: 'API key will remain valid during test',
    basis: 'Key was rotated yesterday',
    validated: true
  });
  assert(s1b === 201, 'Second assumption created');

  // POST - Invalid parent
  const { status: s2 } = await request('POST', '/api/actions/assumptions', {
    action_id: 'act_nonexistent',
    assumption: 'Orphan assumption'
  });
  assert(s2 === 404, 'Assumption with invalid parent returns 404');

  // GET - List assumptions
  const { status: s3, data: d3 } = await request('GET', '/api/actions/assumptions');
  assert(s3 === 200, 'GET /api/actions/assumptions returns 200');
  assert(Array.isArray(d3.assumptions), 'Response has assumptions array');
  assert(d3.assumptions.length >= 2, `At least 2 assumptions returned (got ${d3.assumptions.length})`);

  // GET - Filter by action_id
  const { status: s4, data: d4 } = await request('GET', `/api/actions/assumptions?action_id=${actionId}`);
  assert(s4 === 200, 'Filter by action_id returns 200');
  assert(d4.assumptions.every(a => a.action_id === actionId), 'All results match action_id filter');
}

// ──────────────────────────────────────────────
// Phase 4b: Assumption Updates
// ──────────────────────────────────────────────

async function testAssumptionUpdates(actionId) {
  console.log('\n━━━ Phase 4b: Assumption Updates ━━━');

  // Create an assumption to validate
  const { status: s1, data: d1 } = await request('POST', '/api/actions/assumptions', {
    action_id: actionId,
    assumption: 'Test assumption for validation',
    basis: 'Testing validate endpoint'
  });
  assert(s1 === 201, 'Created assumption for update tests');
  const asmId = d1.assumption_id;

  // GET single assumption
  const { status: s2, data: d2 } = await request('GET', `/api/actions/assumptions/${asmId}`);
  assert(s2 === 200, `GET /api/actions/assumptions/${asmId} returns 200`);
  assert(d2.assumption.assumption_id === asmId, 'Returned correct assumption');
  assert(d2.assumption.agent_id, 'Assumption includes parent action agent_id');

  // GET - 404 for missing assumption
  const { status: s3 } = await request('GET', '/api/actions/assumptions/asm_nonexistent');
  assert(s3 === 404, 'GET missing assumption returns 404');

  // PATCH - Validate assumption
  const { status: s4, data: d4 } = await request('PATCH', `/api/actions/assumptions/${asmId}`, {
    validated: true
  });
  assert(s4 === 200, 'PATCH validate assumption returns 200');
  assert(d4.assumption.validated === 1, 'validated is set to 1');
  assert(d4.assumption.validated_at, 'validated_at is set');

  // Create another assumption to invalidate
  const { data: d5 } = await request('POST', '/api/actions/assumptions', {
    action_id: actionId,
    assumption: 'Test assumption for invalidation',
    basis: 'Testing invalidate endpoint'
  });
  const asmId2 = d5.assumption_id;

  // PATCH - Invalidate without reason should fail
  const { status: s6 } = await request('PATCH', `/api/actions/assumptions/${asmId2}`, {
    validated: false
  });
  assert(s6 === 400, 'Invalidate without reason returns 400');

  // PATCH - Invalidate with reason
  const { status: s7, data: d7 } = await request('PATCH', `/api/actions/assumptions/${asmId2}`, {
    validated: false,
    invalidated_reason: 'Schema was actually out of date'
  });
  assert(s7 === 200, 'PATCH invalidate assumption returns 200');
  assert(d7.assumption.invalidated === 1, 'invalidated is set to 1');
  assert(d7.assumption.invalidated_at, 'invalidated_at is set');
  assert(d7.assumption.invalidated_reason === 'Schema was actually out of date', 'invalidated_reason is stored');

  // PATCH - Can't update already invalidated
  const { status: s8 } = await request('PATCH', `/api/actions/assumptions/${asmId2}`, {
    validated: true
  });
  assert(s8 === 409, 'Updating already-invalidated assumption returns 409');

  // PATCH - 404 for missing assumption
  const { status: s9 } = await request('PATCH', '/api/actions/assumptions/asm_nonexistent', {
    validated: true
  });
  assert(s9 === 404, 'PATCH missing assumption returns 404');

  return { validatedId: asmId, invalidatedId: asmId2 };
}

// ──────────────────────────────────────────────
// Phase 5: Risk Signals
// ──────────────────────────────────────────────

async function testRiskSignals() {
  console.log('\n━━━ Phase 5: Risk Signals ━━━');

  const { status: s1, data: d1 } = await request('GET', '/api/actions/signals');
  assert(s1 === 200, `GET /api/actions/signals returns 200 (got ${s1})`);
  assert(Array.isArray(d1.signals), 'Response has signals array');
  assert(d1.counts !== undefined, 'Response has counts');
  assert(typeof d1.counts.red === 'number', 'counts.red is a number');
  assert(typeof d1.counts.amber === 'number', 'counts.amber is a number');
  assert(typeof d1.counts.total === 'number', 'counts.total is a number');
  log('ℹ️', `Signals: ${d1.counts.red} red, ${d1.counts.amber} amber, ${d1.counts.total} total`);
}

// ──────────────────────────────────────────────
// Phase 6: SDK
// ──────────────────────────────────────────────

async function testSDK() {
  console.log('\n━━━ Phase 6: SDK ━━━');

  // Dynamic import of the SDK
  const { DashClaw } = await import('../sdk/dashclaw.js');

  const agent = new DashClaw({
    baseUrl: BASE_URL,
    apiKey: API_KEY || 'dev-mode',
    agentId: 'sdk-test-agent',
    agentName: 'SDK Test Agent',
    swarmId: 'test-swarm'
  });

  // Constructor validation
  let constructorThrew = false;
  try { new DashClaw({}); } catch { constructorThrew = true; }
  assert(constructorThrew, 'Constructor throws without required params');

  // createAction
  const created = await agent.createAction({
    action_type: 'test',
    declared_goal: 'SDK integration test',
    risk_score: 15,
    confidence: 95
  });
  assert(created.action_id, `SDK createAction returns action_id: ${created.action_id}`);

  // updateOutcome
  const updated = await agent.updateOutcome(created.action_id, {
    status: 'completed',
    output_summary: 'SDK test passed',
    duration_ms: 500
  });
  assert(updated.action.status === 'completed', 'SDK updateOutcome sets status');

  // registerOpenLoop
  const loop = await agent.registerOpenLoop(
    created.action_id,
    'review',
    'SDK test loop'
  );
  assert(loop.loop_id, `SDK registerOpenLoop returns loop_id: ${loop.loop_id}`);

  // resolveOpenLoop
  const resolved = await agent.resolveOpenLoop(loop.loop_id, 'resolved', 'Resolved via SDK test');
  assert(resolved.loop.status === 'resolved', 'SDK resolveOpenLoop works');

  // recordAssumption
  const asm = await agent.recordAssumption({
    action_id: created.action_id,
    assumption: 'SDK is working correctly',
    basis: 'All previous tests passed'
  });
  assert(asm.assumption_id, `SDK recordAssumption returns assumption_id: ${asm.assumption_id}`);

  // getAction
  const detail = await agent.getAction(created.action_id);
  assert(detail.action.action_id === created.action_id, 'SDK getAction returns correct action');

  // getSignals
  const signals = await agent.getSignals();
  assert(Array.isArray(signals.signals), 'SDK getSignals returns array');

  // getActions (via direct API — SDK has no getActions method)
  const { status: actionsStatus, data: actionsResult } = await request('GET', '/api/actions?limit=5');
  assert(actionsStatus === 200 && Array.isArray(actionsResult.actions), 'GET /api/actions returns array (SDK gap)');

  // getOpenLoops (via direct API — SDK has no getOpenLoops method)
  const { status: loopsStatus, data: loopsResult } = await request('GET', '/api/actions/loops?status=open');
  assert(loopsStatus === 200 && Array.isArray(loopsResult.loops), 'GET /api/actions/loops returns array (SDK gap)');
}

// ──────────────────────────────────────────────
// Phase 5b: Drift Detection
// ──────────────────────────────────────────────

async function testDriftDetection() {
  console.log('\n━━━ Phase 5b: Drift Detection ━━━');

  // GET assumptions with drift scoring
  const { status: s1, data: d1 } = await request('GET', '/api/actions/assumptions?drift=true&limit=10');
  assert(s1 === 200, 'GET assumptions with drift=true returns 200');
  assert(d1.drift_summary !== undefined, 'Response includes drift_summary');
  assert(typeof d1.drift_summary.total === 'number', 'drift_summary has total count');
  assert(typeof d1.drift_summary.at_risk === 'number', 'drift_summary has at_risk count');

  // Check that drift_score is present on assumptions
  if (d1.assumptions.length > 0) {
    const hasScore = d1.assumptions.some(a => a.drift_score !== undefined);
    assert(hasScore, 'At least one assumption has drift_score');
  } else {
    assert(true, 'No assumptions to check drift_score on (OK)');
  }
}

// ──────────────────────────────────────────────
// Phase 8: Root-Cause Tracing
// ──────────────────────────────────────────────

async function testRootCauseTrace(actionId) {
  console.log('\n━━━ Phase 8: Root-Cause Tracing ━━━');

  // GET trace for existing action
  const { status: s1, data: d1 } = await request('GET', `/api/actions/${actionId}/trace`);
  assert(s1 === 200, `GET /api/actions/${actionId}/trace returns 200`);
  assert(d1.action, 'Trace includes action');
  assert(d1.trace, 'Trace includes trace object');
  assert(d1.trace.assumptions, 'Trace includes assumptions summary');
  assert(d1.trace.loops, 'Trace includes loops summary');
  assert(typeof d1.trace.assumptions.total === 'number', 'assumptions.total is a number');
  assert(typeof d1.trace.loops.total === 'number', 'loops.total is a number');
  assert(Array.isArray(d1.trace.parent_chain), 'parent_chain is an array');
  assert(Array.isArray(d1.trace.related_actions), 'related_actions is an array');
  assert(Array.isArray(d1.trace.root_cause_indicators), 'root_cause_indicators is an array');

  // GET trace for missing action
  const { status: s2 } = await request('GET', '/api/actions/act_nonexistent/trace');
  assert(s2 === 404, 'GET trace for missing action returns 404');
}

// ──────────────────────────────────────────────
// Phase 9: SDK Extended Methods
// ──────────────────────────────────────────────

async function testSDKExtended() {
  console.log('\n━━━ Phase 9: SDK Extended Methods ━━━');

  const { DashClaw } = await import('../sdk/dashclaw.js');

  const agent = new DashClaw({
    baseUrl: BASE_URL,
    apiKey: API_KEY || 'dev-mode',
    agentId: 'sdk-ext-test',
    agentName: 'SDK Extended Test Agent'
  });

  // Create action + assumption for testing
  const created = await agent.createAction({
    action_type: 'test',
    declared_goal: 'SDK extended methods test'
  });
  const asm = await agent.recordAssumption({
    action_id: created.action_id,
    assumption: 'SDK extended test assumption'
  });

  // getAssumption (via direct API — SDK has no getAssumption method)
  const { status: fetchStatus, data: fetched } = await request('GET', `/api/actions/assumptions/${asm.assumption_id}`);
  assert(fetchStatus === 200 && fetched.assumption.assumption_id === asm.assumption_id, 'GET assumption returns correct assumption (SDK gap)');

  // validateAssumption (via direct API — SDK has no validateAssumption method)
  const { status: valStatus, data: validated } = await request('PATCH', `/api/actions/assumptions/${asm.assumption_id}`, { validated: true });
  assert(valStatus === 200 && validated.assumption.validated === 1, 'PATCH validate assumption works (SDK gap)');

  // Create another to invalidate
  const asm2 = await agent.recordAssumption({
    action_id: created.action_id,
    assumption: 'SDK invalidation test assumption'
  });
  const { status: invStatus, data: invalidated } = await request('PATCH', `/api/actions/assumptions/${asm2.assumption_id}`, { validated: false, invalidated_reason: 'Wrong assumption' });
  assert(invStatus === 200 && invalidated.assumption.invalidated === 1, 'PATCH invalidate assumption works (SDK gap)');

  // getDriftReport (via direct API — SDK has no getDriftReport method)
  const { status: driftStatus, data: drift } = await request('GET', '/api/actions/assumptions?drift=true&limit=5');
  assert(driftStatus === 200 && drift.drift_summary !== undefined, 'GET drift report returns drift_summary (SDK gap)');

  // getActionTrace (via direct API — SDK has no getActionTrace method)
  const { status: traceStatus, data: trace } = await request('GET', `/api/actions/${created.action_id}/trace`);
  assert(traceStatus === 200 && trace.trace, 'GET action trace returns trace (SDK gap)');
  assert(trace.trace.assumptions, 'Trace includes assumptions');
}

// ──────────────────────────────────────────────
// Phase 7: Detail endpoint with populated data
// ──────────────────────────────────────────────

async function testDetailEndpoint(actionId) {
  console.log('\n━━━ Phase 7: Detail Endpoint (populated) ━━━');

  const { status, data } = await request('GET', `/api/actions/${actionId}`);
  assert(status === 200, 'GET detail for populated action returns 200');
  assert(data.open_loops.length >= 2, `Action has ${data.open_loops.length} loops`);
  assert(data.assumptions.length >= 2, `Action has ${data.assumptions.length} assumptions`);
  assert(data.action.status === 'completed', 'Action shows completed status');
}

// ──────────────────────────────────────────────
// Phase 12: Handoffs
// ──────────────────────────────────────────────

async function testHandoffs() {
  console.log('\n━━━ Phase 12: Handoffs ━━━');

  // POST handoff
  const { status: s1, data: d1 } = await request('POST', '/api/handoffs', {
    agent_id: 'test-agent',
    summary: 'Completed feature implementation',
    key_decisions: ['Used React over Vue', 'Chose PostgreSQL'],
    open_tasks: ['Write tests', 'Update docs'],
    mood_notes: 'User was focused and productive',
    next_priorities: ['Deploy to staging', 'Run load tests'],
  });
  assert(s1 === 201, 'POST /api/handoffs returns 201');
  assert(d1.handoff_id && d1.handoff_id.startsWith('ho_'), `handoff_id has ho_ prefix: ${d1.handoff_id}`);
  assert(d1.handoff.summary === 'Completed feature implementation', 'Handoff summary matches');

  // GET handoffs
  const { status: s2, data: d2 } = await request('GET', '/api/handoffs?agent_id=test-agent');
  assert(s2 === 200, 'GET /api/handoffs returns 200');
  assert(Array.isArray(d2.handoffs), 'Response contains handoffs array');
  assert(d2.handoffs.length >= 1, 'At least one handoff returned');

  // GET latest
  const { status: s3, data: d3 } = await request('GET', '/api/handoffs?agent_id=test-agent&latest=true');
  assert(s3 === 200, 'GET /api/handoffs?latest=true returns 200');
  assert(d3.handoff !== null, 'Latest handoff is not null');
  assert(d3.handoff.agent_id === 'test-agent', 'Latest handoff has correct agent_id');
}

// ──────────────────────────────────────────────
// Phase 13: Context Points
// ──────────────────────────────────────────────

async function testContextPoints() {
  console.log('\n━━━ Phase 13: Context Points ━━━');

  // POST key point
  const { status: s1, data: d1 } = await request('POST', '/api/context/points', {
    agent_id: 'test-agent',
    content: 'User prefers dark mode for all interfaces',
    category: 'insight',
    importance: 8,
  });
  assert(s1 === 201, 'POST /api/context/points returns 201');
  assert(d1.point_id && d1.point_id.startsWith('cp_'), `point_id has cp_ prefix: ${d1.point_id}`);

  // POST another with different category
  await request('POST', '/api/context/points', {
    agent_id: 'test-agent',
    content: 'Migrate database by end of sprint',
    category: 'task',
    importance: 9,
  });

  // GET all points
  const { status: s2, data: d2 } = await request('GET', '/api/context/points?agent_id=test-agent');
  assert(s2 === 200, 'GET /api/context/points returns 200');
  assert(Array.isArray(d2.points), 'Response contains points array');
  assert(d2.points.length >= 2, 'At least two points returned');

  // GET filtered by category
  const { status: s3, data: d3 } = await request('GET', '/api/context/points?agent_id=test-agent&category=insight');
  assert(s3 === 200, 'GET context points filtered by category returns 200');
  assert(d3.points.every(p => p.category === 'insight'), 'All returned points have correct category');
}

// ──────────────────────────────────────────────
// Phase 14: Context Threads
// ──────────────────────────────────────────────

async function testContextThreads() {
  console.log('\n━━━ Phase 14: Context Threads ━━━');

  // POST thread
  const { status: s1, data: d1 } = await request('POST', '/api/context/threads', {
    agent_id: 'test-agent',
    name: 'Auth Implementation',
    summary: 'Tracking auth system decisions',
  });
  assert(s1 === 201, 'POST /api/context/threads returns 201');
  assert(d1.thread_id && d1.thread_id.startsWith('ct_'), `thread_id has ct_ prefix: ${d1.thread_id}`);
  const threadId = d1.thread_id;

  // POST entry to thread
  const { status: s2, data: d2 } = await request('POST', `/api/context/threads/${threadId}/entries`, {
    content: 'Decided to use JWT strategy over sessions',
    entry_type: 'decision',
  });
  assert(s2 === 201, 'POST thread entry returns 201');
  assert(d2.entry_id && d2.entry_id.startsWith('ce_'), `entry_id has ce_ prefix: ${d2.entry_id}`);

  // POST another entry
  await request('POST', `/api/context/threads/${threadId}/entries`, {
    content: 'Added refresh token rotation',
  });

  // GET thread with entries
  const { status: s3, data: d3 } = await request('GET', `/api/context/threads/${threadId}`);
  assert(s3 === 200, 'GET thread by ID returns 200');
  assert(d3.thread.id === threadId, 'Thread ID matches');
  assert(Array.isArray(d3.entries), 'Response includes entries array');
  assert(d3.entries.length >= 2, `Thread has ${d3.entries.length} entries`);

  // PATCH close thread
  const { status: s4, data: d4 } = await request('PATCH', `/api/context/threads/${threadId}`, {
    status: 'closed',
    summary: 'Auth system complete — JWT + refresh tokens',
  });
  assert(s4 === 200, 'PATCH thread returns 200');
  assert(d4.thread.status === 'closed', 'Thread status is closed');

  // Verify closed thread rejects entries
  const { status: s5 } = await request('POST', `/api/context/threads/${threadId}/entries`, {
    content: 'This should fail',
  });
  assert(s5 === 400, 'POST entry to closed thread returns 400');

  // GET threads list
  const { status: s6, data: d6 } = await request('GET', '/api/context/threads?agent_id=test-agent');
  assert(s6 === 200, 'GET /api/context/threads returns 200');
  assert(Array.isArray(d6.threads), 'Response contains threads array');
}

// ──────────────────────────────────────────────
// Phase 15: Snippets
// ──────────────────────────────────────────────

async function testSnippets() {
  console.log('\n━━━ Phase 15: Snippets ━━━');

  // POST snippet
  const { status: s1, data: d1 } = await request('POST', '/api/snippets', {
    name: 'fetch-with-retry',
    code: 'async function fetchWithRetry(url, retries = 3) { /* ... */ }',
    description: 'Fetch wrapper with exponential backoff',
    language: 'javascript',
    tags: ['fetch', 'retry', 'network'],
  });
  assert(s1 === 201, 'POST /api/snippets returns 201');
  assert(d1.snippet_id && d1.snippet_id.startsWith('sn_'), `snippet_id has sn_ prefix: ${d1.snippet_id}`);
  const snippetId = d1.snippet_id;

  // GET snippets
  const { status: s2, data: d2 } = await request('GET', '/api/snippets');
  assert(s2 === 200, 'GET /api/snippets returns 200');
  assert(Array.isArray(d2.snippets), 'Response contains snippets array');
  assert(d2.snippets.length >= 1, 'At least one snippet returned');

  // GET with search
  const { status: s3, data: d3 } = await request('GET', '/api/snippets?search=retry');
  assert(s3 === 200, 'GET snippets with search returns 200');
  assert(d3.snippets.some(s => s.name === 'fetch-with-retry'), 'Search found the snippet');

  // POST use
  const { status: s4, data: d4 } = await request('POST', `/api/snippets/${snippetId}/use`);
  assert(s4 === 200, 'POST snippet use returns 200');
  assert(d4.snippet.use_count >= 1, `use_count incremented: ${d4.snippet.use_count}`);

  // DELETE snippet
  const { status: s5, data: d5 } = await request('DELETE', `/api/snippets?id=${snippetId}`);
  assert(s5 === 200, 'DELETE snippet returns 200');
  assert(d5.deleted === true, 'Snippet marked as deleted');
}

// ──────────────────────────────────────────────
// Phase 16: User Preferences
// ──────────────────────────────────────────────

async function testPreferences() {
  console.log('\n━━━ Phase 16: User Preferences ━━━');

  // POST observation
  const { status: s1, data: d1 } = await request('POST', '/api/preferences', {
    type: 'observation',
    agent_id: 'test-agent',
    observation: 'User tends to work in focused 2-hour blocks',
    category: 'workflow',
    importance: 7,
  });
  assert(s1 === 201, 'POST observation returns 201');
  assert(d1.observation_id && d1.observation_id.startsWith('uo_'), `observation_id prefix: ${d1.observation_id}`);

  // POST preference
  const { status: s2, data: d2 } = await request('POST', '/api/preferences', {
    type: 'preference',
    agent_id: 'test-agent',
    preference: 'Prefers concise responses over verbose explanations',
    category: 'communication',
    confidence: 85,
  });
  assert(s2 === 201, 'POST preference returns 201');
  assert(d2.preference_id && d2.preference_id.startsWith('up_'), `preference_id prefix: ${d2.preference_id}`);

  // POST mood
  const { status: s3, data: d3 } = await request('POST', '/api/preferences', {
    type: 'mood',
    agent_id: 'test-agent',
    mood: 'focused',
    energy: 'high',
    notes: 'Deep in implementation mode',
  });
  assert(s3 === 201, 'POST mood returns 201');
  assert(d3.mood_id && d3.mood_id.startsWith('um_'), `mood_id prefix: ${d3.mood_id}`);

  // POST approach (success)
  const { status: s4, data: d4 } = await request('POST', '/api/preferences', {
    type: 'approach',
    agent_id: 'test-agent',
    approach: 'Show code examples before explaining concepts',
    context: 'When teaching new APIs',
    success: true,
  });
  assert(s4 === 201, 'POST approach returns 201');
  assert(d4.approach_id, 'approach_id returned');
  assert(d4.approach.success_count >= 1, `success_count: ${d4.approach.success_count}`);

  // POST approach (fail — upserts same approach)
  await request('POST', '/api/preferences', {
    type: 'approach',
    agent_id: 'test-agent',
    approach: 'Show code examples before explaining concepts',
    success: false,
  });

  // GET summary
  const { status: s5, data: d5 } = await request('GET', '/api/preferences?type=summary&agent_id=test-agent');
  assert(s5 === 200, 'GET preference summary returns 200');
  assert(d5.summary, 'Response has summary object');
  assert(typeof d5.summary.observations_count === 'number', 'Summary has observations_count');
  assert(Array.isArray(d5.summary.preferences), 'Summary has preferences array');
  assert(Array.isArray(d5.summary.recent_moods), 'Summary has recent_moods array');
  assert(Array.isArray(d5.summary.top_approaches), 'Summary has top_approaches array');

  // GET approaches
  const { status: s6, data: d6 } = await request('GET', '/api/preferences?type=approaches&agent_id=test-agent');
  assert(s6 === 200, 'GET approaches returns 200');
  assert(Array.isArray(d6.approaches), 'Response has approaches array');
  const approach = d6.approaches.find(a => a.approach === 'Show code examples before explaining concepts');
  assert(approach, 'Found our tracked approach');
  assert(approach.success_count >= 1, 'approach has success_count >= 1');
  assert(approach.fail_count >= 1, 'approach has fail_count >= 1');
}

// ──────────────────────────────────────────────
// Phase 17: Digest + Security Scan
// ──────────────────────────────────────────────

async function testDigestAndSecurity() {
  console.log('\n━━━ Phase 17: Digest + Security Scan ━━━');

  // GET digest
  const { status: s1, data: d1 } = await request('GET', '/api/digest');
  assert(s1 === 200, 'GET /api/digest returns 200');
  assert(d1.date, 'Digest has date');
  assert(d1.digest, 'Digest has digest object');
  assert(d1.summary, 'Digest has summary object');
  assert(typeof d1.summary.total_activities === 'number', 'Summary has total_activities');

  // POST security scan (clean content)
  const { status: s2, data: d2 } = await request('POST', '/api/security/scan', {
    text: 'Hello world, this is a normal message with no secrets.',
    store: false,
  });
  assert(s2 === 200, 'POST /api/security/scan returns 200');
  assert(d2.clean === true, 'Clean content reports clean=true');
  assert(d2.findings_count === 0, 'Clean content has 0 findings');

  // POST security scan (dirty content)
  const { status: s3, data: d3 } = await request('POST', '/api/security/scan', {
    text: 'My API key is sk-1234567890abcdef1234567890abcdef and my password="hunter2secret"',
    agent_id: 'test-agent',
    store: true,
  });
  assert(s3 === 200, 'POST security scan with secrets returns 200');
  assert(d3.clean === false, 'Dirty content reports clean=false');
  assert(d3.findings_count >= 2, `Found ${d3.findings_count} issues in dirty content`);
  assert(d3.critical_count >= 1, `Critical findings: ${d3.critical_count}`);
  assert(d3.redacted_text.includes('[REDACTED:'), 'Redacted text contains REDACTED markers');
  assert(!d3.redacted_text.includes('sk-1234567890'), 'Redacted text does not contain the API key');
}

// ──────────────────────────────────────────────
// Phase 18: Agent Messaging
// ──────────────────────────────────────────────

async function testAgentMessaging() {
  console.log('\n━━━ Phase 18: Agent Messaging ━━━');

  // POST direct message
  const { status: s1, data: d1 } = await request('POST', '/api/messages', {
    from_agent_id: 'agent-alpha',
    to_agent_id: 'agent-beta',
    message_type: 'info',
    subject: 'Test message',
    body: 'Hello from agent-alpha to agent-beta',
  });
  assert(s1 === 201, 'POST direct message returns 201');
  assert(d1.message_id && d1.message_id.startsWith('msg_'), `message_id prefix: ${d1.message_id}`);
  assert(d1.message.status === 'sent', 'Message status is sent');
  assert(d1.message.from_agent_id === 'agent-alpha', 'from_agent_id matches');

  // POST broadcast message (to_agent_id = null)
  const { status: s2, data: d2 } = await request('POST', '/api/messages', {
    from_agent_id: 'agent-alpha',
    message_type: 'status',
    subject: 'Broadcast update',
    body: 'Status update for everyone',
  });
  assert(s2 === 201, 'POST broadcast message returns 201');
  assert(d2.message.to_agent_id === null, 'Broadcast has null to_agent_id');

  // GET inbox for agent-beta (should see direct + broadcast)
  const { status: s3, data: d3 } = await request('GET', '/api/messages?agent_id=agent-beta&direction=inbox');
  assert(s3 === 200, 'GET inbox returns 200');
  assert(d3.messages.length >= 2, `Inbox has ${d3.messages.length} messages (expected >= 2)`);
  assert(typeof d3.unread_count === 'number', 'Response includes unread_count');

  // GET inbox with unread filter
  const { status: s4, data: d4 } = await request('GET', '/api/messages?agent_id=agent-beta&direction=inbox&unread=true');
  assert(s4 === 200, 'GET unread inbox returns 200');
  assert(d4.messages.every(m => m.status === 'sent'), 'All unread messages have status=sent');

  // PATCH mark read
  const msgToRead = d3.messages.find(m => m.to_agent_id === 'agent-beta');
  const { status: s5, data: d5 } = await request('PATCH', '/api/messages', {
    message_ids: [msgToRead.id],
    action: 'read',
    agent_id: 'agent-beta',
  });
  assert(s5 === 200, 'PATCH mark read returns 200');
  assert(d5.updated >= 1, `Marked ${d5.updated} message(s) as read`);

  // Verify read_at is set
  const { data: d5b } = await request('GET', `/api/messages?agent_id=agent-beta&direction=inbox`);
  const readMsg = d5b.messages.find(m => m.id === msgToRead.id);
  assert(readMsg && readMsg.read_at !== null, 'read_at is set after mark read');

  // PATCH archive
  const { status: s6, data: d6 } = await request('PATCH', '/api/messages', {
    message_ids: [msgToRead.id],
    action: 'archive',
    agent_id: 'agent-beta',
  });
  assert(s6 === 200, 'PATCH archive returns 200');
  assert(d6.updated >= 1, `Archived ${d6.updated} message(s)`);

  // Validation: missing body
  const { status: s7 } = await request('POST', '/api/messages', {
    from_agent_id: 'agent-alpha',
    to_agent_id: 'agent-beta',
  });
  assert(s7 === 400, 'Missing body returns 400');

  // Validation: invalid message_type
  const { status: s8 } = await request('POST', '/api/messages', {
    from_agent_id: 'agent-alpha',
    body: 'test',
    message_type: 'invalid_type',
  });
  assert(s8 === 400, 'Invalid message_type returns 400');
}

// ──────────────────────────────────────────────
// Phase 19: Message Threads + Shared Docs
// ──────────────────────────────────────────────

async function testMessageThreadsAndDocs() {
  console.log('\n━━━ Phase 19: Message Threads + Shared Docs ━━━');

  // POST create thread
  const { status: s1, data: d1 } = await request('POST', '/api/messages/threads', {
    name: 'Test Thread Alpha-Beta',
    participants: ['agent-alpha', 'agent-beta'],
    created_by: 'agent-alpha',
  });
  assert(s1 === 201, 'POST thread returns 201');
  assert(d1.thread_id && d1.thread_id.startsWith('mt_'), `thread_id prefix: ${d1.thread_id}`);
  assert(d1.thread.status === 'open', 'Thread status is open');

  const threadId = d1.thread_id;

  // POST message to thread
  const { status: s2, data: d2 } = await request('POST', '/api/messages', {
    from_agent_id: 'agent-alpha',
    to_agent_id: 'agent-beta',
    body: 'First message in thread',
    thread_id: threadId,
  });
  assert(s2 === 201, 'POST message to thread returns 201');
  assert(d2.message.thread_id === threadId, 'Message thread_id matches');

  // POST reply in thread
  const { status: s3 } = await request('POST', '/api/messages', {
    from_agent_id: 'agent-beta',
    to_agent_id: 'agent-alpha',
    body: 'Reply from beta',
    thread_id: threadId,
  });
  assert(s3 === 201, 'POST reply in thread returns 201');

  // GET threads (should have message_count)
  const { status: s4, data: d4 } = await request('GET', '/api/messages/threads');
  assert(s4 === 200, 'GET threads returns 200');
  const ourThread = d4.threads.find(t => t.id === threadId);
  assert(ourThread && ourThread.message_count >= 2, `Thread has ${ourThread?.message_count} messages (expected >= 2)`);

  // PATCH resolve thread
  const { status: s5, data: d5 } = await request('PATCH', '/api/messages/threads', {
    thread_id: threadId,
    status: 'resolved',
    summary: 'Resolved by test',
  });
  assert(s5 === 200, 'PATCH resolve thread returns 200');
  assert(d5.thread.status === 'resolved', 'Thread status is resolved');
  assert(d5.thread.resolved_at !== null, 'resolved_at is set');

  // POST shared doc (create)
  const { status: s6, data: d6 } = await request('POST', '/api/messages/docs', {
    name: 'Test Shared Doc',
    content: 'Initial content from alpha',
    agent_id: 'agent-alpha',
  });
  assert(s6 === 201, 'POST shared doc returns 201');
  assert(d6.doc_id && d6.doc_id.startsWith('sd_'), `doc_id prefix: ${d6.doc_id}`);
  assert(d6.doc.version === 1, 'Initial version is 1');

  // POST upsert same doc (update)
  const { status: s7, data: d7 } = await request('POST', '/api/messages/docs', {
    name: 'Test Shared Doc',
    content: 'Updated content from beta',
    agent_id: 'agent-beta',
  });
  assert(s7 === 201, 'POST upsert doc returns 201');
  assert(d7.doc.version === 2, 'Version incremented to 2');
  assert(d7.doc.last_edited_by === 'agent-beta', 'last_edited_by updated');

  // GET shared docs
  const { status: s8, data: d8 } = await request('GET', '/api/messages/docs');
  assert(s8 === 200, 'GET shared docs returns 200');
  assert(d8.docs.length >= 1, `Found ${d8.docs.length} shared doc(s)`);

  // Validation: missing name for thread
  const { status: s9 } = await request('POST', '/api/messages/threads', {
    created_by: 'agent-alpha',
  });
  assert(s9 === 400, 'Thread missing name returns 400');

  // Validation: missing content for doc
  const { status: s10 } = await request('POST', '/api/messages/docs', {
    name: 'Bad Doc',
    agent_id: 'agent-alpha',
  });
  assert(s10 === 400, 'Doc missing content returns 400');
}

// ──────────────────────────────────────────────
// Run all tests
// ──────────────────────────────────────────────

async function main() {
  console.log(`\n🧪 ActionRecord Control Plane - Integration Tests`);
  console.log(`   Target: ${BASE_URL}`);
  console.log(`   API Key: ${API_KEY ? '(configured)' : '(none - dev mode)'}\n`);

  // Verify server is running
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const healthData = await res.json().catch(() => null);
    if (res.status === 503 && healthData?.status === 'degraded') {
      log('✅', 'Server is running (degraded health — some checks failed)');
    } else if (!res.ok) {
      throw new Error(`Health check returned ${res.status}`);
    } else {
      log('✅', 'Server is running');
    }
  } catch (error) {
    console.error(`\n❌ Cannot reach ${BASE_URL} - is the dev server running?`);
    console.error(`   Run: npm run dev\n`);
    process.exit(1);
  }

  try {
    const actionId = await testCoreAPI();
    await testValidation();
    await testOpenLoops(actionId);
    await testAssumptions(actionId);
    await testAssumptionUpdates(actionId);
    await testRiskSignals();
    await testDriftDetection();
    await testSDK();
    await testSDKExtended();
    await testRootCauseTrace(actionId);
    await testDetailEndpoint(actionId);
    // Archived v1 routes — probe once and skip all if not available
    const probe = await request('GET', '/api/handoffs');
    if (probe.status === 404 || probe.data?.error?.includes('Non-JSON')) {
      const skipped = ['Handoffs', 'Context Points', 'Context Threads', 'Snippets',
        'Preferences', 'Digest & Security', 'Agent Messaging', 'Message Threads & Docs'];
      for (const name of skipped) {
        console.log(`\n━━━ ${name} (SKIPPED — archived route) ━━━`);
      }
    } else {
      await testHandoffs();
      await testContextPoints();
      await testContextThreads();
      await testSnippets();
      await testPreferences();
      await testDigestAndSecurity();
      await testAgentMessaging();
      await testMessageThreadsAndDocs();
    }
  } catch (error) {
    console.error('\n💥 Test suite crashed:', error.message);
    console.error(error.stack);
    failed++;
  }

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  if (failed > 0) {
    console.log('  Failed tests:');
    results.filter(r => !r.ok).forEach(r => console.log(`    ❌ ${r.label}`));
    console.log('');
    process.exit(1);
  }

  console.log('  🎉 All tests passed!\n');
}

main();
