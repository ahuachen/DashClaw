/**
 * Minimal HTTP client for the DashClaw governance runtime.
 *
 * We don't depend on the `dashclaw` npm package here because:
 *   - We only need 4 endpoints (guard, createAction, updateOutcome, heartbeat).
 *   - This keeps the plugin's install footprint tiny when dropped into
 *     opencode (no transitive deps, runs in Bun without resolution issues).
 *
 * Surface mirrors the relevant subset of `sdk/dashclaw.js`.
 */

export interface GuardContext {
  action_type: string;
  declared_goal?: string;
  risk_score?: number;
  reversible?: boolean;
  systems_touched?: string[];
  agent_id?: string;
  agent_name?: string;
  /** Free-form context mirrored back into guard_decisions.context. */
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

export class GovernanceUnreachableError extends Error {
  constructor(public override cause: unknown) {
    super(`DashClaw governance unreachable: ${stringifyError(cause)}`);
    this.name = 'GovernanceUnreachableError';
  }
}

export class GovernanceBlockedError extends Error {
  constructor(public decision: GuardDecision) {
    super(decision.reason || 'Action blocked by DashClaw policy');
    this.name = 'GovernanceBlockedError';
  }
}

export class ApprovalDeniedError extends Error {
  constructor(public action: ActionRecord) {
    super(`Approval denied for ${action.id}`);
    this.name = 'ApprovalDeniedError';
  }
}

export class ApprovalTimeoutError extends Error {
  constructor(public actionId: string, public timeoutMs: number) {
    super(`Approval timed out for ${actionId} after ${timeoutMs}ms`);
    this.name = 'ApprovalTimeoutError';
  }
}

function stringifyError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e); } catch { return String(e); }
}

export interface DashClawClientOptions {
  baseUrl: string;
  apiKey: string;
  agentId: string;
  agentName?: string;
  /** Per-request timeout. Defaults to 10s. */
  requestTimeoutMs?: number;
}

export class DashClawClient {
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly agentId: string;
  readonly agentName: string | null;
  readonly requestTimeoutMs: number;

  constructor(opts: DashClawClientOptions) {
    if (!opts.baseUrl) throw new Error('baseUrl is required');
    if (!opts.apiKey) throw new Error('apiKey is required');
    if (!opts.agentId) throw new Error('agentId is required');
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.agentId = opts.agentId;
    this.agentName = opts.agentName ?? null;
    this.requestTimeoutMs = opts.requestTimeoutMs ?? 10_000;
  }

  private async request<T>(path: string, method: 'GET' | 'POST' | 'PATCH', body?: unknown): Promise<T> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), this.requestTimeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey,
          'User-Agent': `dashclaw-opencode-plugin/0.1.0 (agent_id=${this.agentId})`,
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: ac.signal,
      });
      const text = await res.text();
      const data: unknown = text ? safeJson(text) : null;
      if (!res.ok) {
        const err = new Error(
          `DashClaw ${method} ${path} failed (${res.status}): ${text || res.statusText}`,
        );
        (err as Error & { status?: number; data?: unknown }).status = res.status;
        (err as Error & { status?: number; data?: unknown }).data = data;
        throw err;
      }
      return data as T;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new GovernanceUnreachableError(`request to ${path} timed out`);
      }
      // Network errors, DNS failures, connection refused, etc.
      if (err instanceof TypeError) throw new GovernanceUnreachableError(err);
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

  async heartbeat(status: 'online' | 'offline' | 'busy', metadata?: Record<string, unknown>): Promise<void> {
    await this.request<unknown>('/api/agents/heartbeat', 'POST', {
      agent_id: this.agentId,
      status,
      metadata: metadata ?? null,
    });
  }

  /**
   * Wait for a human approval decision via polling. The hosted SDK has SSE
   * fallback to polling — for the plugin we keep polling-only to avoid the
   * extra parser surface.
   */
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
      if (action.status === 'failed' || action.status === 'cancelled' || action.status === 'denied') {
        throw new ApprovalDeniedError(action);
      }
      await sleep(intervalMs);
    }
    throw new ApprovalTimeoutError(actionId, timeoutMs);
  }
}

function safeJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
