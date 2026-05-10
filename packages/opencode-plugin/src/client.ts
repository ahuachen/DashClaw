/**
 * Behavior security HTTP client.
 *
 * Implements the SwarmXAI behavior security protocol, which is compatible
 * with the DashClaw REST API. Both 'dashclaw' and 'custom' providers use
 * this client — the custom provider must expose the same endpoint contract.
 *
 * Endpoints used:
 *   POST /api/guard
 *   POST /api/actions
 *   PATCH /api/actions/:id
 *   GET  /api/actions/:id
 *   POST /api/agents/heartbeat
 */

// ── Request / response types ──────────────────────────────────────────────────

export interface GuardContext {
  action_type: string;
  declared_goal?: string;
  risk_score?: number;
  reversible?: boolean;
  systems_touched?: string[];
  agent_id?: string;
  agent_name?: string;
  metadata?: Record<string, unknown>;
}

export interface GuardDecision {
  decision: 'allow' | 'block' | 'require_approval';
  action_id: string;
  reason?: string;
  signals?: string[];
  risk_score?: number;
}

export interface ActionInput {
  action_type: string;
  declared_goal?: string;
  risk_score?: number;
  reversible?: boolean;
  systems_touched?: string[];
  agent_id?: string;
  agent_name?: string;
  tokens_in?: number;
  tokens_out?: number;
  cost_estimate?: number;
  model?: string;
  metadata?: Record<string, unknown>;
}

export interface ActionRecord {
  id: string;
  status: string;
  approved_by?: string | null;
  [key: string]: unknown;
}

export interface OutcomeInput {
  status?: 'ok' | 'failed' | 'denied';
  error_message?: string;
  tokens_in?: number;
  tokens_out?: number;
  model?: string;
  cost_estimate?: number;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

// ── Errors ────────────────────────────────────────────────────────────────────

export class BehaviorSecurityUnreachableError extends Error {
  constructor(public override cause: unknown) {
    super(`Behavior security service unreachable: ${stringifyError(cause)}`);
    this.name = 'BehaviorSecurityUnreachableError';
  }
}

/** Thrown to abort tool execution — caught by opencode's Effect runtime. */
export class GovernanceBlockedError extends Error {
  constructor(public decision: Pick<GuardDecision, 'decision' | 'action_id' | 'reason'>) {
    super(decision.reason ?? 'Action blocked by behavior security policy');
    this.name = 'GovernanceBlockedError';
  }
}

export class ApprovalDeniedError extends Error {
  constructor(public action: ActionRecord) {
    super(`Approval denied for action ${action.id}`);
    this.name = 'ApprovalDeniedError';
  }
}

export class ApprovalTimeoutError extends Error {
  constructor(
    public actionId: string,
    public timeoutMs: number,
  ) {
    super(`Approval timed out for action ${actionId} after ${timeoutMs}ms`);
    this.name = 'ApprovalTimeoutError';
  }
}

// ── Client ────────────────────────────────────────────────────────────────────

export interface BehaviorSecurityClientOptions {
  /** Provider tag — used in User-Agent and log context only. */
  provider: string;
  baseUrl: string;
  apiKey: string;
  agentId: string;
  agentName?: string;
  requestTimeoutMs?: number;
}

export class BehaviorSecurityClient {
  readonly provider: string;
  readonly baseUrl: string;
  private readonly apiKey: string;
  readonly agentId: string;
  readonly agentName: string | null;
  private readonly requestTimeoutMs: number;

  constructor(opts: BehaviorSecurityClientOptions) {
    if (!opts.baseUrl) throw new Error('behaviorSecurity.baseUrl is required');
    if (!opts.apiKey) throw new Error('behaviorSecurity.apiKey is required');
    if (!opts.agentId) throw new Error('behaviorSecurity.agentId is required');
    this.provider = opts.provider;
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.agentId = opts.agentId;
    this.agentName = opts.agentName ?? null;
    this.requestTimeoutMs = opts.requestTimeoutMs ?? 10_000;
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST' | 'PATCH',
    body?: unknown,
  ): Promise<T> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.requestTimeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'User-Agent': `swarmxai-guardrails/${this.provider}/0.1.0 (agent_id=${this.agentId})`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ac.signal,
      });
      const text = await res.text();
      const data: unknown = text ? safeJson(text) : null;
      if (!res.ok) {
        const err = Object.assign(
          new Error(`BehaviorSecurity ${method} ${path} → ${res.status}: ${text || res.statusText}`),
          { status: res.status, data },
        );
        throw err;
      }
      return data as T;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new BehaviorSecurityUnreachableError(`${path} timed out`);
      }
      if (err instanceof TypeError) throw new BehaviorSecurityUnreachableError(err);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async guard(ctx: GuardContext): Promise<GuardDecision> {
    return this.request<GuardDecision>('/api/guard', 'POST', {
      ...ctx,
      agent_id: ctx.agent_id ?? this.agentId,
      ...(ctx.agent_name == null && this.agentName ? { agent_name: this.agentName } : {}),
    });
  }

  async createAction(action: ActionInput): Promise<ActionRecord> {
    return this.request<ActionRecord>('/api/actions', 'POST', {
      ...action,
      agent_id: action.agent_id ?? this.agentId,
      ...(action.agent_name == null && this.agentName ? { agent_name: this.agentName } : {}),
    });
  }

  async updateOutcome(actionId: string, outcome: OutcomeInput): Promise<ActionRecord> {
    return this.request<ActionRecord>(`/api/actions/${actionId}`, 'PATCH', {
      ...outcome,
      timestamp_end: new Date().toISOString(),
    });
  }

  async getAction(actionId: string): Promise<ActionRecord> {
    return this.request<ActionRecord>(`/api/actions/${actionId}`, 'GET');
  }

  async heartbeat(
    status: 'online' | 'offline' | 'busy',
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.request<unknown>('/api/agents/heartbeat', 'POST', {
      agent_id: this.agentId,
      status,
      metadata: metadata ?? null,
    });
  }

  async waitForApproval(
    actionId: string,
    opts: { timeoutMs?: number; intervalMs?: number } = {},
  ): Promise<ActionRecord> {
    const timeoutMs = opts.timeoutMs ?? 300_000;
    const intervalMs = opts.intervalMs ?? 5_000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const action = await this.getAction(actionId);
      if (action.approved_by) return action;
      if (['failed', 'cancelled', 'denied'].includes(action.status)) {
        throw new ApprovalDeniedError(action);
      }
      await sleep(Math.min(intervalMs, deadline - Date.now()));
    }
    throw new ApprovalTimeoutError(actionId, timeoutMs);
  }
}

// ── Backwards-compat alias (used internally by governance.ts) ─────────────────
/** @deprecated Use BehaviorSecurityClient */
export { BehaviorSecurityClient as DashClawClient };
export { BehaviorSecurityUnreachableError as GovernanceUnreachableError };

// ── Private helpers ───────────────────────────────────────────────────────────

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function stringifyError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}
