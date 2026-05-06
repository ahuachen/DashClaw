/**
 * Standard MAAP (Multi-Agent Adapter Protocol) configuration shape.
 * See: docs/architecture/multi-agent-adapter.md §3.
 */

export interface PluginConfig {
  baseUrl: string;
  apiKey: string;
  agentId: string;
  agentName: string;
  failClosed: boolean;
  riskScoreDefault: number;
  highRiskTools: ReadonlySet<string>;
  defaultModel: string;
  approvalTimeoutMs: number;
  /** Tools whose calls are not reported at all (read-only / trivial). */
  ignoredTools: ReadonlySet<string>;
  /** Map of opencode tool name -> action_type override. */
  toolActionTypes: Readonly<Record<string, string>>;
}

function firstString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.length > 0) return c;
  }
  return '';
}

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
  }
  return fallback;
}

function asNumber(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.length > 0) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function asStringSet(v: unknown): Set<string> {
  if (Array.isArray(v)) {
    return new Set(v.filter((x): x is string => typeof x === 'string' && x.length > 0));
  }
  if (typeof v === 'string' && v.length > 0) {
    return new Set(v.split(',').map((s) => s.trim()).filter(Boolean));
  }
  return new Set();
}

function asStringMap(v: unknown): Record<string, string> {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const out: Record<string, string> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'string') out[k] = val;
    }
    return out;
  }
  return {};
}

export function resolveConfig(raw: Record<string, unknown> | undefined): PluginConfig {
  const cfg = raw ?? {};
  const env = typeof process !== 'undefined' && process?.env ? process.env : {};

  const baseUrl = firstString(
    cfg.baseUrl,
    cfg.dashclawUrl,
    env.DASHCLAW_BASE_URL,
    env.DASHCLAW_URL,
  ).replace(/\/$/, '');

  const apiKey = firstString(cfg.apiKey, cfg.dashclawApiKey, env.DASHCLAW_API_KEY);
  const agentId = firstString(cfg.agentId, env.DASHCLAW_AGENT_ID) || 'opencode';
  const agentName = firstString(cfg.agentName, env.DASHCLAW_AGENT_NAME) || agentId;

  return {
    baseUrl,
    apiKey,
    agentId,
    agentName,
    failClosed: asBool(cfg.failClosed ?? env.DASHCLAW_FAIL_CLOSED, true),
    riskScoreDefault: asNumber(cfg.riskScoreDefault ?? env.DASHCLAW_RISK_DEFAULT, 50),
    highRiskTools: asStringSet(cfg.highRiskTools ?? env.DASHCLAW_HIGH_RISK_TOOLS),
    defaultModel: firstString(cfg.defaultModel, env.DASHCLAW_DEFAULT_MODEL),
    approvalTimeoutMs: asNumber(cfg.approvalTimeoutMs ?? env.DASHCLAW_APPROVAL_TIMEOUT_MS, 300_000),
    ignoredTools: asStringSet(cfg.ignoredTools),
    toolActionTypes: asStringMap(cfg.toolActionTypes),
  };
}

/**
 * Map an opencode tool name to a DashClaw action_type.
 * Heuristic: built-in tool names are usually descriptive enough
 * (read, write, bash, edit, glob, grep, webfetch, todoread, todowrite).
 * Override with `toolActionTypes` config if needed.
 */
export function resolveActionType(toolName: string, overrides: Readonly<Record<string, string>>): string {
  if (overrides[toolName]) return overrides[toolName];
  // Default: pass through tool name lowercased; server-side policies
  // can match against this `action_type` directly.
  return toolName.toLowerCase();
}

/**
 * Conservative risk score per built-in opencode tool.
 * Anything not listed falls back to `config.riskScoreDefault`.
 */
const BUILTIN_RISK: Record<string, number> = {
  read: 5,
  glob: 5,
  grep: 5,
  list: 5,
  todoread: 5,
  webfetch: 20,
  edit: 60,
  write: 65,
  patch: 65,
  todowrite: 30,
  bash: 80,
};

export function inferRiskScore(toolName: string, fallback: number): number {
  return BUILTIN_RISK[toolName.toLowerCase()] ?? fallback;
}

/**
 * Heuristic for "reversible" — read-only tools are reversible by definition.
 * Anything that mutates state is not.
 */
const REVERSIBLE_TOOLS = new Set(['read', 'glob', 'grep', 'list', 'todoread', 'webfetch']);
export function inferReversible(toolName: string): boolean {
  return REVERSIBLE_TOOLS.has(toolName.toLowerCase());
}
