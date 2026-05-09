/**
 * @swarmxai_guardrails/opencode-plugin configuration.
 *
 * Two independent security domains, each independently configurable:
 *
 *   behaviorSecurity — what the agent is allowed to DO
 *     Controls tool-call interception, approval flows, and policy enforcement.
 *     Backed by DashClaw (DASHCLAW_* env vars).
 *
 *   modelSafety — what the agent is allowed to SAY / process
 *     Controls input content scanning and output compliance checking.
 *     Provider-agnostic (MODEL_SAFETY_* env vars).
 */

// ── Behavior Security (DashClaw) ─────────────────────────────────────────────

export interface BehaviorSecurityConfig {
  baseUrl: string;
  apiKey: string;
  agentId: string;
  agentName: string;
  /** Block all tool calls when DashClaw is unreachable. Default: true. */
  failClosed: boolean;
  riskScoreDefault: number;
  highRiskTools: ReadonlySet<string>;
  approvalTimeoutMs: number;
  /** Tools skipped entirely — not reported to DashClaw. */
  ignoredTools: ReadonlySet<string>;
  /** Override action_type per tool name. */
  toolActionTypes: Readonly<Record<string, string>>;
}

// ── Model Safety ─────────────────────────────────────────────────────────────

export type ModelSafetyProvider =
  | 'llamaguard'
  | 'openai-moderation'
  | 'azure-content-safety'
  | 'custom';

export interface ModelSafetyConfig {
  enabled: boolean;
  provider: ModelSafetyProvider;
  endpoint: string;
  apiKey: string;
  /** Scan tool arguments and declared_goal before execution. Default: true. */
  checkInput: boolean;
  /** Scan tool output before it is fed back to the LLM. Default: true. */
  checkOutput: boolean;
  /** Block when model safety service is unreachable. Default: false. */
  failClosed: boolean;
  /** Content categories to enforce. Empty = provider defaults. */
  categories: ReadonlyArray<string>;
}

// ── Top-level plugin config ───────────────────────────────────────────────────

export interface PluginConfig {
  behaviorSecurity: BehaviorSecurityConfig;
  modelSafety: ModelSafetyConfig;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function asStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string' && v.length > 0) return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// ── Resolvers ─────────────────────────────────────────────────────────────────

function resolveBehaviorSecurity(
  raw: Record<string, unknown>,
  env: Record<string, string | undefined>,
): BehaviorSecurityConfig {
  // Support both nested { behaviorSecurity: {...} } and legacy flat shape
  const cfg = isRecord(raw.behaviorSecurity) ? raw.behaviorSecurity : raw;

  const baseUrl = firstString(
    cfg.baseUrl,
    env.BEHAVIOR_SECURITY_BASE_URL,
  ).replace(/\/$/, '');

  const apiKey = firstString(cfg.apiKey, env.BEHAVIOR_SECURITY_API_KEY);
  const agentId = firstString(cfg.agentId, env.BEHAVIOR_SECURITY_AGENT_ID) || 'opencode';
  const agentName = firstString(cfg.agentName, env.BEHAVIOR_SECURITY_AGENT_NAME) || agentId;

  return {
    baseUrl,
    apiKey,
    agentId,
    agentName,
    failClosed: asBool(cfg.failClosed ?? env.BEHAVIOR_SECURITY_FAIL_CLOSED, true),
    riskScoreDefault: asNumber(cfg.riskScoreDefault ?? env.BEHAVIOR_SECURITY_RISK_DEFAULT, 50),
    highRiskTools: asStringSet(cfg.highRiskTools ?? env.BEHAVIOR_SECURITY_HIGH_RISK_TOOLS),
    approvalTimeoutMs: asNumber(cfg.approvalTimeoutMs ?? env.BEHAVIOR_SECURITY_APPROVAL_TIMEOUT_MS, 300_000),
    ignoredTools: asStringSet(cfg.ignoredTools ?? env.BEHAVIOR_SECURITY_IGNORED_TOOLS),
    toolActionTypes: asStringMap(cfg.toolActionTypes),
  };
}

function resolveModelSafety(
  raw: Record<string, unknown>,
  env: Record<string, string | undefined>,
): ModelSafetyConfig {
  const cfg = isRecord(raw.modelSafety) ? raw.modelSafety : {};

  const endpoint = firstString(cfg.endpoint, env.MODEL_SAFETY_ENDPOINT).replace(/\/$/, '');
  const enabled = endpoint.length > 0
    ? asBool(cfg.enabled ?? env.MODEL_SAFETY_ENABLED, true)
    : false;

  return {
    enabled,
    provider: (firstString(cfg.provider, env.MODEL_SAFETY_PROVIDER) || 'custom') as ModelSafetyProvider,
    endpoint,
    apiKey: firstString(cfg.apiKey, env.MODEL_SAFETY_API_KEY),
    checkInput: asBool(cfg.checkInput ?? env.MODEL_SAFETY_CHECK_INPUT, true),
    checkOutput: asBool(cfg.checkOutput ?? env.MODEL_SAFETY_CHECK_OUTPUT, true),
    failClosed: asBool(cfg.failClosed ?? env.MODEL_SAFETY_FAIL_CLOSED, false),
    categories: asStringArray(cfg.categories ?? env.MODEL_SAFETY_CATEGORIES),
  };
}

export function resolveConfig(raw: Record<string, unknown> | undefined): PluginConfig {
  const cfg = raw ?? {};
  const env = typeof process !== 'undefined' && process?.env
    ? (process.env as Record<string, string | undefined>)
    : {};

  return {
    behaviorSecurity: resolveBehaviorSecurity(cfg, env),
    modelSafety: resolveModelSafety(cfg, env),
  };
}

// ── Utility exports (used by governance.ts) ───────────────────────────────────

export function resolveActionType(
  toolName: string,
  overrides: Readonly<Record<string, string>>,
): string {
  if (overrides[toolName]) return overrides[toolName];
  return toolName.toLowerCase();
}

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

const REVERSIBLE_TOOLS = new Set(['read', 'glob', 'grep', 'list', 'todoread', 'webfetch']);
export function inferReversible(toolName: string): boolean {
  return REVERSIBLE_TOOLS.has(toolName.toLowerCase());
}
