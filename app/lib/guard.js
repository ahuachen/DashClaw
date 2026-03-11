/**
 * Guard evaluation engine.
 * Evaluates agent context against org policies and returns allow/warn/block/require_approval.
 */

import { randomUUID } from 'node:crypto';
import { deliverGuardWebhook } from './webhooks.js';
import { checkSemanticGuardrail } from './llm.js';
import { generateActionEmbedding, isEmbeddingsEnabled } from './embeddings.js';
import { scanSensitiveData } from './security.js';
import { EVENTS, publishOrgEvent } from './events.js';

const DECISION_SEVERITY = { allow: 0, warn: 1, require_approval: 2, block: 3 };

function redactAny(value, findings) {
  if (typeof value === 'string') {
    const scan = scanSensitiveData(value);
    if (!scan.clean) findings.push(...scan.findings);
    return scan.redacted;
  }
  if (Array.isArray(value)) return value.map((v) => redactAny(v, findings));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = redactAny(v, findings);
    return out;
  }
  return value;
}

/**
 * Evaluate guard policies for an incoming agent action.
 *
 * @param {string} orgId
 * @param {Object} context - { action_type, risk_score, agent_id, systems_touched, reversible, declared_goal }
 * @param {Function} sql - neon sql tagged template
 * @param {Object} [options]
 * @param {boolean} [options.includeSignals=false] - also check live signals (expensive)
 * @param {Function} [options.computeSignals] - computeSignals function (injected to avoid circular deps)
 * @returns {Promise<{ decision, reasons, warnings, matched_policies, risk_score, evaluated_at }>}
 */
export async function evaluateGuard(orgId, context, sql, options = {}) {
  const policies = await sql`
    SELECT id, name, policy_type, rules
    FROM guard_policies
    WHERE org_id = ${orgId} AND active = 1
  `;

  const reasons = [];
  const warnings = [];
  const matchedPolicies = [];
  let highestDecision = 'allow';

  for (const policy of policies) {
    let rules;
    try {
      rules = JSON.parse(policy.rules);
    } catch {
      continue; // skip malformed
    }

    const result = await evaluatePolicy(policy, rules, context, sql, orgId);
    if (result) {
      applyResult(result, policy, reasons, warnings, matchedPolicies);
      if (DECISION_SEVERITY[result.action] > DECISION_SEVERITY[highestDecision]) {
        highestDecision = result.action;
      }
    }
  }

  // Process webhook_check policies (after local policies, so preliminary decision is known)
  // Snapshot the preliminary state so all webhooks see the same baseline
  const webhookPolicies = policies.filter(p => p.policy_type === 'webhook_check');
  const preliminary = {
    decision: highestDecision,
    reasons: [...reasons],
    warnings: [...warnings],
    matchedPolicies: [...matchedPolicies],
  };
  for (const policy of webhookPolicies) {
    let rules;
    try { rules = JSON.parse(policy.rules); } catch { continue; }

    const webhookResult = await evaluateWebhookPolicy(
      policy, rules, context, orgId, sql, preliminary
    );
    if (webhookResult) {
      applyResult(webhookResult, policy, reasons, warnings, matchedPolicies);
      if (DECISION_SEVERITY[webhookResult.action] > DECISION_SEVERITY[highestDecision]) {
        highestDecision = webhookResult.action;
      }
    }
  }

  // Optionally check live signals
  if (options.includeSignals && options.computeSignals) {
    try {
      const signals = await options.computeSignals(orgId, context.agent_id || null, sql);
      for (const signal of signals) {
        warnings.push(`Active signal: ${signal.type} — ${signal.label}`);
      }
    } catch {
      // Signal check is best-effort
    }
  }

  const evaluated_at = new Date().toISOString();

  // Log decision fire-and-forget
  const decisionId = `gd_${randomUUID().replace(/-/g, '').slice(0, 24)}`;

  // SECURITY: do not store raw secrets in guard decision context.
  // This keeps the evaluation logic unchanged; only the logged context is redacted.
  const dlpFindings = [];
  const safeContextForLog = redactAny(context, dlpFindings);
  if (dlpFindings.length > 0) {
    console.warn(`[Guard] Redacted ${dlpFindings.length} sensitive pattern(s) from guard_decisions.context before storing.`);
  }

  sql`
    INSERT INTO guard_decisions (id, org_id, agent_id, decision, reason, matched_policies, context, risk_score, action_type, created_at)
    VALUES (
      ${decisionId},
      ${orgId},
      ${context.agent_id || null},
      ${highestDecision},
      ${reasons.join('; ') || null},
      ${JSON.stringify(matchedPolicies)},
      ${JSON.stringify(safeContextForLog)},
      ${context.risk_score != null ? context.risk_score : null},
      ${context.action_type || null},
      ${evaluated_at}
    )
  `.catch((err) => {
    console.warn('[Guard] Failed to persist guard_decisions audit row:', err.message);
  });

  void publishOrgEvent(EVENTS.GUARD_DECISION_CREATED, {
    orgId,
    decision: {
      id: decisionId,
      org_id: orgId,
      agent_id: context.agent_id || null,
      decision: highestDecision,
      reason: reasons.join('; ') || null,
      matched_policies: matchedPolicies,
      context: safeContextForLog,
      risk_score: context.risk_score != null ? context.risk_score : null,
      action_type: context.action_type || null,
      created_at: evaluated_at
    }
  });

  return {
    decision: highestDecision,
    reasons,
    warnings,
    matched_policies: matchedPolicies,
    risk_score: context.risk_score != null ? context.risk_score : null,
    evaluated_at,
  };
}

function applyResult(result, policy, reasons, warnings, matchedPolicies) {
  if (result.action === 'warn') {
    warnings.push(`${policy.name}: ${result.reason}`);
  } else if (result.action !== 'allow') {
    reasons.push(`${policy.name}: ${result.reason}`);
  }
  if (result.extraWarnings) {
    warnings.push(...result.extraWarnings);
  }
  matchedPolicies.push(policy.id);
}

export async function evaluatePolicy(policy, rules, context, sql, orgId) {
  switch (policy.policy_type) {
    case 'risk_threshold': {
      const threshold = rules.threshold ?? 80;
      // SECURITY: Clamp agent-reported risk_score to valid range (0-100).
      // Agent-supplied scores are advisory — treat as untrusted input.
      const rawScore = Number(context.risk_score) || 0;
      const riskScore = Math.max(0, Math.min(rawScore, 100));
      if (riskScore >= threshold) {
        return { action: rules.action || 'block', reason: `Risk score ${riskScore} >= threshold ${threshold}` };
      }
      return null;
    }

    case 'require_approval': {
      const actionTypes = rules.action_types || [];
      if (actionTypes.includes(context.action_type)) {
        return { action: 'require_approval', reason: `Action type "${context.action_type}" requires approval` };
      }
      return null;
    }

    case 'block_action_type': {
      const actionTypes = rules.action_types || [];
      if (actionTypes.includes(context.action_type)) {
        return { action: 'block', reason: `Action type "${context.action_type}" is blocked by policy` };
      }
      return null;
    }

    case 'rate_limit': {
      const maxActions = rules.max_actions || 50;
      const windowMinutes = Math.max(1, Math.min(10080, parseInt(rules.window_minutes, 10) || 60));
      const agentId = context.agent_id;
      if (!agentId) return null;

      const rows = await sql.query(
        `SELECT COUNT(*) as cnt FROM action_records
         WHERE org_id = $1 AND agent_id = $2
         AND timestamp_start::timestamptz > NOW() - INTERVAL '1 minute' * $3`,
        [orgId, agentId, windowMinutes]
      );

      const count = parseInt(rows[0]?.cnt || '0', 10);
      if (count >= maxActions) {
        return { action: rules.action || 'warn', reason: `Agent performed ${count} actions in ${windowMinutes}min (limit: ${maxActions})` };
      }
      return null;
    }

    case 'webhook_check':
      // Handled separately after local policy loop
      return null;

    case 'behavioral_anomaly': {
      if (!isEmbeddingsEnabled()) {
        console.warn('[Guard] behavioral_anomaly policy skipped: No OpenAI API Key configured.');
        return null;
      }
      const threshold = rules.similarity_threshold ?? 0.75;
      const minHistory = rules.min_history ?? 5;
      const agentId = context.agent_id;
      if (!agentId) return null;

      // 1. Generate embedding for current proposed action
      const embedding = await generateActionEmbedding(context);
      if (!embedding) return null;

      // 2. Search for similar actions in history
      // Note: <=> is cosine distance in pgvector. Similarity = 1 - distance.
      const similarityQuery = `
        SELECT 1 - (embedding <=> $1::vector) as similarity
        FROM action_embeddings
        WHERE org_id = $2 AND agent_id = $3
        ORDER BY similarity DESC
        LIMIT 1
      `;
      
      try {
        const rows = await sql.query(similarityQuery, [JSON.stringify(embedding), orgId, agentId]);
        
        // 3. Evaluate anomaly
        if (rows.length === 0) {
          // No history yet
          return { action: 'warn', reason: 'New agent behavior: No historical data for similarity baseline.' };
        }

        const maxSimilarity = rows[0].similarity;
        if (maxSimilarity < threshold) {
          return { 
            action: rules.action || 'require_approval', 
            reason: `Behavioral Anomaly: Action similarity (${(maxSimilarity * 100).toFixed(1)}%) is below the safety threshold (${(threshold * 100).toFixed(0)}%).` 
          };
        }
      } catch (err) {
        if (err.message.includes('vector') || err.message.includes('does not exist')) {
          console.warn('[Guard] pgvector not enabled or table missing. Skipping anomaly detection.');
          return null;
        }
        throw err;
      }
      return null;
    }

    case 'semantic_check': {
      const instruction = rules.instruction;
      if (!instruction) return null;

      // Fallback when LLM check fails: 'allow' (fail-open) or 'block' (fail-closed).
      // Per-policy setting via rules.fallback, with global override via env var.
      const globalFallback = process.env.DASHCLAW_GUARD_FALLBACK || 'allow';
      const fallback = rules.fallback || globalFallback;
      const model = rules.model || 'gpt-4o-mini';

      const result = await checkSemanticGuardrail(context, instruction, model);

      if (!result) {
        // LLM check failed or was skipped (no key)
        if (fallback === 'block') {
          return { action: 'block', reason: 'Semantic check failed (fallback: block)' };
        }
        return null; // pass-through
      }

      if (result.allowed === false) {
        return { action: 'block', reason: `Semantic Violation: ${result.reason}` };
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Evaluate a webhook_check policy by calling the customer's endpoint.
 * Customer decision can only upgrade severity (never downgrade).
 */
export async function evaluateWebhookPolicy(policy, rules, context, orgId, sql, preliminary) {
  const payload = {
    event: 'guard.evaluation',
    org_id: orgId,
    timestamp: new Date().toISOString(),
    context: {
      action_type: context.action_type,
      risk_score: context.risk_score ?? null,
      agent_id: context.agent_id ?? null,
      systems_touched: context.systems_touched ?? [],
      reversible: context.reversible ?? null,
      declared_goal: context.declared_goal ?? null,
    },
    preliminary_decision: preliminary.decision,
    matched_policies: preliminary.matchedPolicies,
    reasons: preliminary.reasons,
    warnings: preliminary.warnings,
  };

  const timeoutMs = rules.timeout_ms || 5000;
  const onTimeout = rules.on_timeout || 'allow';

  const result = await deliverGuardWebhook({
    url: rules.url,
    policyId: policy.id,
    orgId,
    payload,
    timeoutMs,
    sql,
  });

  if (!result.success || !result.response) {
    // Timeout or error — apply on_timeout rule
    if (onTimeout === 'block') {
      return { action: 'block', reason: 'Webhook check failed or timed out (on_timeout: block)' };
    }
    return null; // fail-open
  }

  const resp = result.response;
  const customerDecision = resp.decision;

  const customerReasons = Array.isArray(resp.reasons) ? resp.reasons : [];
  const customerWarnings = Array.isArray(resp.warnings)
    ? resp.warnings.map(w => `${policy.name} (webhook): ${w}`)
    : [];

  // Only accept valid decisions that are more restrictive than preliminary
  if (customerDecision && DECISION_SEVERITY[customerDecision] !== undefined) {
    if (DECISION_SEVERITY[customerDecision] > DECISION_SEVERITY[preliminary.decision]) {
      const reason = customerReasons.length > 0
        ? customerReasons.join('; ')
        : `Webhook escalated to ${customerDecision}`;
      return { action: customerDecision, reason: `${policy.name} (webhook): ${reason}`, extraWarnings: customerWarnings };
    }
  }

  // Customer response doesn't escalate — return warnings only (as a warn-level result)
  if (customerWarnings.length > 0) {
    return { action: 'warn', reason: customerWarnings[0], extraWarnings: customerWarnings.slice(1) };
  }
  return null;
}
