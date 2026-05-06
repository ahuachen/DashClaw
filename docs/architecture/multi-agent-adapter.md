# Multi-Agent Adapter Protocol (MAAP)

**状态：草案 v1（2026-05-07）**

DashClaw 是一个**最小治理运行时**。任何智能体框架（OpenClaw、OpenCode、Hermes、Claude Code、自研框架……）都可以通过一个轻量适配层接入治理循环，**无需修改 DashClaw 后端**。

本文定义这套适配层的统一语义、生命周期、配置约定，作为新增 adapter 的契约依据。

---

## 1. 设计原则

1. **服务端零改动**。所有现有 adapter 都构建在已经稳定的 `/api/guard`、`/api/actions`、`/api/agents/heartbeat` 之上。Adapter 是一个"翻译层"，把宿主框架的 hook 信号翻译成治理 API 调用。
2. **语言原生**。Python 框架就用 Python adapter，TypeScript 框架就用 TS adapter，避免 IPC 桥。
3. **`agent_id` 是治理边界**。每个 adapter 实例都必须声明 `agent_id`（治理路由）和 `agent_name`（人类可读审计标签），决策、动作、心跳都按此区分。
4. **失败安全策略可配置**。`failClosed=true`（默认）：治理 API 不可达时 block 所有工具调用；`failClosed=false`：降级为放行 + 本地告警。
5. **不阻塞热路径**。轮询 / SSE / 异步上报都允许，但默认 `before_*` hook 是同步等待 guard 决策的（policy 决定要不要允许）。

---

## 2. 治理循环（Governance Loop）

每次工具调用都遵循同一个 4 阶段循环。Adapter 的职责就是把宿主框架的"工具调用前/后"事件钩子映射到这 4 步：

```
┌────────────────────────────────────────────────────────────────┐
│  Tool Call Lifecycle (adapter responsibility)                  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  1. before_tool_call ──► POST /api/guard                       │
│                          ├─ allow            → 继续             │
│                          ├─ block            → 抛出/中断         │
│                          └─ require_approval → waitForApproval  │
│                                                                │
│  2. (allowed)        ──► POST /api/actions   → 记录 action_id   │
│                                                                │
│  3. (tool runs)                                                │
│                                                                │
│  4. after_tool_call  ──► PATCH /api/actions/:id (outcome)      │
│                          status = ok | failed | denied         │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

会话级：

```
on_session_start ──► POST /api/agents/heartbeat (status="online")
on_session_end   ──► POST /api/agents/heartbeat (status="offline")
```

---

## 3. 标准配置契约

所有 adapter（不管语言）都接受以下配置键。优先级从高到低：插件配置 > 环境变量 > 默认值。

| 配置键（插件配置） | 环境变量 | 默认 | 含义 |
|---|---|---|---|
| `dashclawUrl` / `baseUrl` | `DASHCLAW_BASE_URL`、`DASHCLAW_URL` | — | 治理服务 base URL |
| `dashclawApiKey` / `apiKey` | `DASHCLAW_API_KEY` | — | API Key |
| `agentId` | `DASHCLAW_AGENT_ID` | adapter 名（如 `opencode`、`hermes`） | 治理路由标识 |
| `agentName` | `DASHCLAW_AGENT_NAME` | hostname 或自定义 | 审计可读标签 |
| `failClosed` | `DASHCLAW_FAIL_CLOSED` | `true` | 治理 API 不可达时是否 block |
| `riskScoreDefault` | `DASHCLAW_RISK_DEFAULT` | `50` | 未声明工具的默认风险分 |
| `highRiskTools` | `DASHCLAW_HIGH_RISK_TOOLS`（逗号分隔） | `[]` | 强制走人工审批的工具清单 |
| `defaultModel` | `DASHCLAW_DEFAULT_MODEL` | — | 上报令牌使用时的兜底 model id |
| `approvalTimeoutMs` | `DASHCLAW_APPROVAL_TIMEOUT_MS` | `300000` | 等待人工批准的最长时间 |

---

## 4. Adapter 接口（伪 IDL）

所有 adapter 内部都暴露一个统一的"Governance Bridge"对象，提供以下 5 个方法。各语言实现应以此为参考：

```typescript
interface GovernanceBridge {
  // 工具调用前 — 返回 ALLOW 之外都应该中断/挂起工具调用
  beforeToolCall(input: {
    toolName: string;
    args: unknown;
    sessionId: string;
    callId: string;
    declaredGoal?: string;
    riskScore?: number;
    systemsTouched?: string[];
    reversible?: boolean;
  }): Promise<{
    decision: 'allow' | 'block' | 'require_approval';
    actionId?: string;     // 仅 allow 时返回，after_tool_call 必须带回
    reason?: string;
    blockReason?: string;  // 给宿主框架展示
  }>;

  // 工具调用后 — outcome 关 action record
  afterToolCall(input: {
    actionId: string;
    status: 'ok' | 'failed' | 'denied';
    errorMessage?: string;
    tokensIn?: number;
    tokensOut?: number;
    model?: string;
    durationMs?: number;
  }): Promise<void>;

  // 会话生命周期
  onSessionStart(sessionId: string): Promise<void>;
  onSessionEnd(sessionId: string, opts?: { interrupted?: boolean }): Promise<void>;

  // 可选：assumption 记录、令牌归因
  recordAssumption?(input: { actionId: string; text: string }): Promise<void>;
  attributeTokens?(input: { tokensIn: number; tokensOut: number; model: string }): void;
}
```

---

## 5. Block / Approval 决策回流

每个宿主框架都有自己的"中断工具调用"机制。Adapter 必须把治理决策翻译成宿主框架认识的中断信号：

| 宿主框架 | 中断机制 | Adapter 实现 |
|---|---|---|
| **OpenClaw** | hook 返回 `{ block: true, blockReason }` | 已实现于 `packages/openclaw-plugin/` |
| **OpenCode** | `tool.execute.before` hook 抛错 / 改 `output.args = null` | 抛 `GovernanceBlockedError`；`permission.ask` 的 `output.status = 'reject'` |
| **Hermes** | `pre_tool_call` hook 抛 `BlockToolCall` 异常 | 抛 `dashclaw_governance.GovernanceBlocked` |
| **Claude Code** | hook（PreToolUse）返回 exit code 2 + stderr | adapter 进程返回 `{ decision: 'block', reason }` |

**Approval 路径**：当 `decision === 'require_approval'` 时，adapter 必须调用 `waitForApproval(actionId)`，**同步阻塞**直到收到决策（默认 5 分钟超时）。这意味着工具调用线程会被挂起 — 宿主框架若不能容忍长阻塞，可以在 adapter 配置里把 `highRiskTools` 改写为本地预过滤（直接 block 而不走人工审批）。

---

## 6. Agent 注册与发现

DashClaw 的 `/api/agents` 端点已经提供基于 `action_records` 的自动发现 — 任何 adapter 第一次调用 `createAction` 时，它的 `agent_id` 会自动出现在 `/api/agents` 列表里。

进一步的元数据（agent 类型、版本、capabilities）通过 `heartbeat` 的 `metadata` 字段携带：

```json
POST /api/agents/heartbeat
{
  "agent_id": "opencode-prod-1",
  "status": "online",
  "metadata": {
    "agent_type": "opencode",
    "agent_version": "0.x.y",
    "adapter_version": "1.0.0",
    "capabilities": ["tool.execute", "permission.ask"],
    "host": "macbook.local"
  }
}
```

这样 mission-control 上能直接看到"现在有哪些类型的 agent 在跑"。

---

## 7. 各语言 Adapter 实现清单

| Adapter 包 | 语言 | 宿主框架 | 安装方式 | 状态 |
|---|---|---|---|---|
| `@dashclaw/openclaw-plugin` | TS | OpenClaw | npm + `openclaw.json` 注册 | ✅ 已发布（v1.2.5）|
| `@dashclaw/opencode-plugin` | TS | OpenCode | npm + `opencode.json` 的 `plugin: [...]` | 🚧 v0.1（本提交）|
| `dashclaw-hermes-plugin` | Python | Hermes | pip + `~/.hermes/config.yaml` 启用 | 🚧 v0.1（本提交）|
| `@dashclaw/claude-code-hook` | bash/sh | Claude Code | settings.json 的 `PreToolUse` hook | 计划中 |

每个 adapter 的源码位于 `packages/<adapter-name>/`，集成文档位于 `docs/integrations/<framework>.md`。

---

## 8. 适配新框架的 5 步流程

为新的 agent 框架增加 adapter，按以下顺序：

1. **识别 hook 点**：宿主框架是否提供 `before_tool_call / after_tool_call / on_session_*` 钩子？hook 是否能阻断？
2. **挑选语言**：用宿主框架的原生语言写 adapter，避免跨进程通信。
3. **包装治理 API**：HTTP 直接调，或包装一层（TS 用现有 `dashclaw` npm 包；Python 用 `requests` / `httpx` 自己写 client，保持精简）。
4. **实现 Governance Bridge**：按 §4 的接口实现 5 个方法，把宿主框架的事件翻译成 4 步治理循环。
5. **注册 + 文档**：在 `docs/integrations/<framework>.md` 写安装指南，用一个 smoke 测试证明 block 决策能确实中断工具调用。

---

## 9. 服务端可选增强（不属于本提交）

下面这些是后续可以做的服务端增强，**当前不做**（YAGNI）：

- `POST /api/agents/register`：声明 capabilities 与签名公钥（Phase 2 JWKS 验证已在路线图）
- `(agent_type, action_type)` 二元组路由 policy（当前只按 `action_type` 路由）
- 给每个 agent_type 独立的 mission-control 视图

服务端能力今天已足够支撑多 adapter 接入；先验证 OpenCode + Hermes 两个 adapter 真能跑通端到端 governance loop，再决定服务端是否升级。

---

## 参考

- 治理循环：`docs/architecture/runtime-api.md`
- SDK 方法：`sdk/dashclaw.js`
- OpenClaw 插件实现：`packages/openclaw-plugin/src/index.ts`
- 多 agent 字段（数据库）：`drizzle/0003_guard_decisions_agent_name.sql`
