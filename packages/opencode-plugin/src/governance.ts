/**
 * GovernanceBridge — translates opencode tool/permission/event hooks into
 * DashClaw's 4-step governance loop:
 *
 *   1. before tool call → guard()  + createAction()
 *   2. (block / require_approval handled here)
 *   3. tool runs
 *   4. after tool call → updateOutcome()
 */

import {
  ApprovalDeniedError,
  ApprovalTimeoutError,
  DashClawClient,
  GovernanceBlockedError,
  GovernanceUnreachableError,
  type ActionRecord,
} from './client.js';
import {
  inferReversible,
  inferRiskScore,
  resolveActionType,
  type PluginConfig,
} from './config.js';

export interface BridgeLogger {
  debug?(msg: string, meta?: Record<string, unknown>): void;
  info?(msg: string, meta?: Record<string, unknown>): void;
  warn?(msg: string, meta?: Record<string, unknown>): void;
  error?(msg: string, meta?: Record<string, unknown>): void;
}

const consoleLogger: BridgeLogger = {
  debug: () => {},
  info: (m, meta) => console.log(`[dashclaw] ${m}`, meta ?? ''),
  warn: (m, meta) => console.warn(`[dashclaw] ${m}`, meta ?? ''),
  error: (m, meta) => console.error(`[dashclaw] ${m}`, meta ?? ''),
};

interface PendingCall {
  actionId: string;
  toolName: string;
  startedAt: number;
}

export class GovernanceBridge {
  private readonly client: DashClawClient;
  private readonly cfg: PluginConfig;
  private readonly log: BridgeLogger;
  /** keyed by `${sessionID}:${callID}` — set in before, consumed in after. */
  private readonly inflight = new Map<string, PendingCall>();
  /** sessions we've already heartbeated for. */
  private readonly seenSessions = new Set<string>();

  constructor(cfg: PluginConfig, opts: { logger?: BridgeLogger } = {}) {
    this.cfg = cfg;
    this.log = opts.logger ?? consoleLogger;
    this.client = new DashClawClient({
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      agentId: cfg.agentId,
      agentName: cfg.agentName,
    });
  }

  /** Call once at plugin init. Best-effort heartbeat. */
  async start(metadata: Record<string, unknown> = {}): Promise<void> {
    try {
      await this.client.heartbeat('online', {
        agent_type: 'opencode',
        adapter_version: '0.1.0',
        adapter: '@swarmxai_guardrails/opencode-plugin',
        ...metadata,
      });
      this.log.info?.(`registered with DashClaw as ${this.cfg.agentId} (${this.cfg.agentName})`);
    } catch (err) {
      // Non-fatal — heartbeat is metadata only.
      this.log.warn?.('heartbeat failed at startup', { error: stringifyError(err) });
    }
  }

  /** Best-effort offline heartbeat. */
  async stop(): Promise<void> {
    try {
      await this.client.heartbeat('offline');
    } catch (err) {
      this.log.debug?.('heartbeat(offline) failed', { error: stringifyError(err) });
    }
  }

  /**
   * Translate `tool.execute.before` into guard() + createAction().
   * Throws to abort the tool call when policy says block / approval denied.
   */
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

    let decision: { decision: string; action_id: string; reason?: string };
    try {
      decision = await this.client.guard({
        action_type: actionType,
        declared_goal: declaredGoal,
        risk_score: riskScore,
        reversible,
        metadata: {
          tool: input.tool,
          session_id: input.sessionID,
          call_id: input.callID,
          args_preview: previewArgs(input.args),
        },
      });
    } catch (err) {
      this.handleUnreachable('guard', err);
      return; // fail-open path returns silently
    }

    if (decision.decision === 'block') {
      this.log.warn?.(`BLOCK ${input.tool} (callID=${input.callID}): ${decision.reason ?? 'no reason'}`);
      throw new GovernanceBlockedError({
        decision: 'block',
        action_id: decision.action_id,
        reason: decision.reason,
      });
    }

    let actionRecord: ActionRecord;
    try {
      actionRecord = await this.client.createAction({
        action_type: actionType,
        declared_goal: declaredGoal,
        risk_score: riskScore,
        reversible,
        metadata: {
          tool: input.tool,
          session_id: input.sessionID,
          call_id: input.callID,
          args_preview: previewArgs(input.args),
          guard_decision_id: decision.action_id,
        },
      });
    } catch (err) {
      this.handleUnreachable('createAction', err);
      return;
    }

    if (decision.decision === 'require_approval') {
      this.log.info?.(`AWAITING APPROVAL ${input.tool} (action=${actionRecord.id}): ${decision.reason ?? ''}`);
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

    this.inflight.set(this.key(input.sessionID, input.callID), {
      actionId: actionRecord.id,
      toolName: input.tool,
      startedAt: Date.now(),
    });
  }

  /**
   * Translate `tool.execute.after` into updateOutcome().
   * Always best-effort — never throws back into the tool flow.
   */
  async afterToolCall(input: {
    tool: string;
    sessionID: string;
    callID: string;
    output: { title: string; output: string; metadata: unknown };
    /** True iff opencode reported a tool error in metadata. */
    failed?: boolean;
    errorMessage?: string;
  }): Promise<void> {
    const k = this.key(input.sessionID, input.callID);
    const pending = this.inflight.get(k);
    if (!pending) return; // guard never opened a record (ignored / unreachable)
    this.inflight.delete(k);

    const durationMs = Date.now() - pending.startedAt;
    try {
      await this.client.updateOutcome(pending.actionId, {
        status: input.failed ? 'failed' : 'ok',
        error_message: input.errorMessage,
        duration_ms: durationMs,
        ...(this.cfg.defaultModel ? { model: this.cfg.defaultModel } : {}),
        metadata: {
          tool: input.tool,
          output_preview: previewString(input.output?.output, 500),
          title: input.output?.title,
        },
      });
    } catch (err) {
      this.log.warn?.(`updateOutcome failed for action=${pending.actionId}`, {
        error: stringifyError(err),
      });
    }
  }

  /** Translate `permission.ask` into a guard() check. */
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
        this.log.warn?.(`permission.ask ${input.type ?? input.id} → DENY (${decision.reason ?? ''})`);
      } else if (decision.decision === 'allow' && output.status === 'ask') {
        // Don't auto-allow unless the policy explicitly says allow.
        // Leave status='ask' so opencode falls back to user prompt.
      }
    } catch (err) {
      // Don't change output.status on unreachable — let opencode use its
      // default behaviour. This is a soft-fail because the primary
      // governance gate is `tool.execute.before`.
      this.log.debug?.('permission.ask guard failed', { error: stringifyError(err) });
    }
  }

  private async markSession(sessionId: string): Promise<void> {
    if (this.seenSessions.has(sessionId)) return;
    this.seenSessions.add(sessionId);
    try {
      await this.client.heartbeat('busy', { session_id: sessionId, agent_type: 'opencode' });
    } catch {
      // ignore — heartbeat is metadata only
    }
  }

  private handleUnreachable(stage: string, err: unknown): void {
    if (err instanceof GovernanceUnreachableError) {
      this.log.warn?.(`DashClaw unreachable during ${stage}: ${stringifyError(err)}`);
      if (this.cfg.failClosed) {
        throw new GovernanceBlockedError({
          decision: 'block',
          action_id: '',
          reason: `DashClaw governance unreachable (failClosed=true)`,
        });
      }
      return;
    }
    // Unexpected — re-throw, don't silently swallow.
    throw err;
  }

  private key(sessionId: string, callId: string): string {
    return `${sessionId}:${callId}`;
  }
}

function previewArgs(args: unknown): unknown {
  try {
    const s = JSON.stringify(args);
    if (s.length <= 1000) return args;
    return { _truncated: true, preview: s.slice(0, 1000) };
  } catch {
    return { _unserializable: true };
  }
}

function previewString(s: string | undefined, max: number): string {
  if (!s) return '';
  return s.length > max ? `${s.slice(0, max)}...` : s;
}

function stringifyError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

export { GovernanceBlockedError } from './client.js';
