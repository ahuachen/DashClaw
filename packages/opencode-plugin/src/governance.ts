/**
 * GovernanceBridge — behavior security orchestration.
 *
 * Translates opencode tool/permission/event hooks into the behavior security
 * provider's 4-step governance loop:
 *
 *   1. tool.execute.before → guard()  + createAction()
 *   2. block / require_approval handled here (throws to abort)
 *   3. tool runs
 *   4. tool.execute.after  → updateOutcome()
 */

import {
  ApprovalDeniedError,
  ApprovalTimeoutError,
  BehaviorSecurityClient,
  BehaviorSecurityUnreachableError,
  GovernanceBlockedError,
  type ActionRecord,
} from './client.js';
import {
  inferReversible,
  inferRiskScore,
  resolveActionType,
  type BehaviorSecurityConfig,
} from './config.js';

export interface BridgeLogger {
  debug?(msg: string, meta?: Record<string, unknown>): void;
  info?(msg: string, meta?: Record<string, unknown>): void;
  warn?(msg: string, meta?: Record<string, unknown>): void;
  error?(msg: string, meta?: Record<string, unknown>): void;
}

const consoleLogger: BridgeLogger = {
  debug: () => {},
  info: (m, meta) => console.log(`[swarmxai-guardrails:behavior] ${m}`, meta ?? ''),
  warn: (m, meta) => console.warn(`[swarmxai-guardrails:behavior] ${m}`, meta ?? ''),
  error: (m, meta) => console.error(`[swarmxai-guardrails:behavior] ${m}`, meta ?? ''),
};

interface PendingCall {
  actionId: string;
  toolName: string;
  startedAt: number;
}

export class GovernanceBridge {
  private readonly client: BehaviorSecurityClient;
  private readonly cfg: BehaviorSecurityConfig;
  private readonly log: BridgeLogger;
  private readonly inflight = new Map<string, PendingCall>();
  private readonly seenSessions = new Set<string>();

  constructor(cfg: BehaviorSecurityConfig, opts: { logger?: BridgeLogger } = {}) {
    this.cfg = cfg;
    this.log = opts.logger ?? consoleLogger;
    this.client = new BehaviorSecurityClient({
      provider: cfg.provider,
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      agentId: cfg.agentId,
      agentName: cfg.agentName,
    });
  }

  async start(metadata: Record<string, unknown> = {}): Promise<void> {
    try {
      await this.client.heartbeat('online', {
        agent_type: 'opencode',
        adapter: '@swarmxai_guardrails/opencode-plugin',
        provider: this.cfg.provider,
        ...metadata,
      });
      this.log.info?.(`registered with ${this.cfg.provider} as ${this.cfg.agentId}`);
    } catch (err) {
      this.log.warn?.('startup heartbeat failed', { error: str(err) });
    }
  }

  async stop(): Promise<void> {
    try {
      await this.client.heartbeat('offline');
    } catch {
      // best-effort
    }
  }

  async beforeToolCall(input: {
    tool: string;
    sessionID: string;
    callID: string;
    args: unknown;
  }): Promise<void> {
    if (this.cfg.ignoredTools.has(input.tool)) return;

    await this.markSession(input.sessionID);

    const actionType = resolveActionType(input.tool, this.cfg.toolActionTypes);
    const baseRisk = inferRiskScore(input.tool, this.cfg.riskScoreDefault);
    const riskScore = this.cfg.highRiskTools.has(input.tool) ? Math.max(baseRisk, 90) : baseRisk;
    const reversible = inferReversible(input.tool);
    const declaredGoal = `opencode tool call: ${input.tool}`;
    const sharedMeta = {
      tool: input.tool,
      session_id: input.sessionID,
      call_id: input.callID,
      args_preview: previewArgs(input.args),
    };

    // Step 1 — guard
    let decision: { decision: string; action_id: string; reason?: string };
    try {
      decision = await this.client.guard({
        action_type: actionType,
        declared_goal: declaredGoal,
        risk_score: riskScore,
        reversible,
        metadata: sharedMeta,
      });
    } catch (err) {
      this.handleUnreachable('guard', err);
      return;
    }

    if (decision.decision === 'block') {
      this.log.warn?.(`BLOCK ${input.tool} (${input.callID}): ${decision.reason ?? ''}`);
      throw new GovernanceBlockedError({
        decision: 'block',
        action_id: decision.action_id,
        reason: decision.reason,
      });
    }

    // Step 2 — create action record
    let actionRecord: ActionRecord;
    try {
      actionRecord = await this.client.createAction({
        action_type: actionType,
        declared_goal: declaredGoal,
        risk_score: riskScore,
        reversible,
        metadata: { ...sharedMeta, guard_decision_id: decision.action_id },
      });
    } catch (err) {
      this.handleUnreachable('createAction', err);
      return;
    }

    // Step 3 — wait for approval if required
    if (decision.decision === 'require_approval') {
      this.log.info?.(`AWAITING APPROVAL ${input.tool} (action=${actionRecord.id})`);
      try {
        await this.client.waitForApproval(actionRecord.id, {
          timeoutMs: this.cfg.approvalTimeoutMs,
        });
        this.log.info?.(`APPROVED ${input.tool} (action=${actionRecord.id})`);
      } catch (err) {
        if (err instanceof ApprovalDeniedError) {
          this.log.warn?.(`DENIED ${input.tool} (action=${actionRecord.id})`);
          throw new GovernanceBlockedError({
            decision: 'block',
            action_id: actionRecord.id,
            reason: 'Human reviewer denied the request',
          });
        }
        if (err instanceof ApprovalTimeoutError) {
          this.log.warn?.(`APPROVAL TIMEOUT ${input.tool} (action=${actionRecord.id})`);
          throw new GovernanceBlockedError({
            decision: 'block',
            action_id: actionRecord.id,
            reason: `Approval not granted within ${this.cfg.approvalTimeoutMs}ms`,
          });
        }
        this.handleUnreachable('waitForApproval', err);
        return;
      }
    }

    this.inflight.set(key(input.sessionID, input.callID), {
      actionId: actionRecord.id,
      toolName: input.tool,
      startedAt: Date.now(),
    });
  }

  async afterToolCall(input: {
    tool: string;
    sessionID: string;
    callID: string;
    output: { title: string; output: string; metadata: unknown };
    failed?: boolean;
    errorMessage?: string;
  }): Promise<void> {
    const k = key(input.sessionID, input.callID);
    const pending = this.inflight.get(k);
    if (!pending) return;
    this.inflight.delete(k);

    try {
      await this.client.updateOutcome(pending.actionId, {
        status: input.failed ? 'failed' : 'ok',
        error_message: input.errorMessage,
        duration_ms: Date.now() - pending.startedAt,
        metadata: {
          tool: input.tool,
          output_preview: preview(input.output?.output, 500),
          title: input.output?.title,
        },
      });
    } catch (err) {
      this.log.warn?.(`updateOutcome failed (action=${pending.actionId})`, { error: str(err) });
    }
  }

  async permissionAsk(
    input: { id?: string; type?: string; pattern?: string; metadata?: Record<string, unknown> },
    output: { status: 'ask' | 'deny' | 'allow' },
  ): Promise<void> {
    if (!this.cfg.baseUrl) return;
    try {
      const decision = await this.client.guard({
        action_type: `permission.${input.type ?? 'ask'}`,
        declared_goal: `opencode permission request: ${input.type ?? input.id ?? 'unknown'}`,
        risk_score: this.cfg.riskScoreDefault,
        metadata: {
          permission_type: input.type,
          permission_id: input.id,
          pattern: input.pattern,
          ...input.metadata,
        },
      });
      if (decision.decision === 'block') {
        output.status = 'deny';
        this.log.warn?.(`permission.ask ${input.type ?? input.id} → DENY`);
      }
    } catch {
      // soft-fail: primary gate is tool.execute.before
    }
  }

  private async markSession(sessionId: string): Promise<void> {
    if (this.seenSessions.has(sessionId)) return;
    this.seenSessions.add(sessionId);
    try {
      await this.client.heartbeat('busy', { session_id: sessionId, agent_type: 'opencode' });
    } catch {
      // ignore
    }
  }

  private handleUnreachable(stage: string, err: unknown): void {
    if (err instanceof BehaviorSecurityUnreachableError) {
      this.log.warn?.(`${this.cfg.provider} unreachable during ${stage}: ${str(err)}`);
      if (this.cfg.failClosed) {
        throw new GovernanceBlockedError({
          decision: 'block',
          action_id: '',
          reason: `Behavior security service unreachable (failClosed=true)`,
        });
      }
      return;
    }
    throw err;
  }
}

export { GovernanceBlockedError } from './client.js';

function key(sessionId: string, callId: string): string {
  return `${sessionId}:${callId}`;
}

function previewArgs(args: unknown): unknown {
  try {
    const s = JSON.stringify(args);
    return s.length <= 1000 ? args : { _truncated: true, preview: s.slice(0, 1000) };
  } catch {
    return { _unserializable: true };
  }
}

function preview(s: string | undefined, max: number): string {
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function str(e: unknown): string {
  if (e instanceof Error) return e.message;
  try { return JSON.stringify(e); } catch { return String(e); }
}
