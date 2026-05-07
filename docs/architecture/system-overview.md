# DashClaw 系统综合分析

**版本**：基于 DashClaw v2.13.3，写入 2026-05-07
**作用**：给团队成员、新接入者、集成方一份**全景式**入门读物。读完能对系统是什么、能做什么、怎么做的、文件在哪有清晰认知，需要深入时知道去哪份分主题文档。

> 本文不重复 [`PROJECT_DETAILS.md`](../../PROJECT_DETAILS.md) 已有的接口表格 — 它从"系统视角"补全 PROJECT_DETAILS 的"参考视角"。

---

## 0. 速览数字

| 维度 | 数 |
|---|---|
| 项目代码（`app/**/*.{js,jsx,ts,tsx}`） | **656 个文件** |
| Next.js page 文件 | **62 个 `page.js`/`page.jsx`** |
| API 路由文件（`app/api/**/route.{js,ts}`） | **180 个活跃 + 48 归档 = 228** |
| 核心 lib 模块（`app/lib/*.js`） | **101 个文件 / 88 个 .js** |
| 数据库表（`schema/schema.js` + 5 个迁移） | **63 张表**（核心 + 扩展 + 审计） |
| SDK 方法（`sdk/dashclaw.js`） | **80 个方法**（v2 canonical）+ legacy 2934 行兼容层 |
| 单元测试 | **191 个测试文件** |
| 适配器（packages/） | **3 个**（OpenClaw / opencode / Hermes） |
| Tier-1 治理端点（不可少） | **8 个**（guard / actions / approvals / assumptions / signals / policies / policies/generate / health）|
| 集成的外部系统 | **9+**（Slack / Discord / Telegram / Linear / GitHub / Email / Stripe / OpenAI / Anthropic）|
| Examples 示例（`examples/`） | **15+**（OpenAI、Anthropic、LangGraph、CrewAI、AutoGen、Claude Code、Claude Managed Agents、MCP）|

---

## 1. 系统定位

### 1.1 是什么

DashClaw 是一个 **AI 智能体决策治理基础设施（Decision Infrastructure for AI Agents）**。它不是一个智能体平台，不替代 Agent 框架；它做的是：**为现有的 Agent 框架（OpenClaw / opencode / Hermes / Claude Code / OpenAI SDK / LangGraph 等）提供一个独立的"策略防火墙 + 决策审计 + 人工审批"运行时**。

### 1.2 不是什么

DashClaw 明确**拒绝以下功能**进入 Tier-1（核心运行时）：

| 不做 | 因为 |
|---|---|
| 给 Agent 提供工具（Calendar / Email / CRM） | 这是 Agent Framework 的事 |
| 替 Agent 调 LLM | 同上 |
| 业务工作流编排（不带治理） | 用 BPM 系统 |
| 通用 RAG 知识管理（不带 risk score） | 用知识库产品 |

凡涉及"帮 Agent 完成目标"的功能都被归到 `app/api/_archive/`（48 个端点已归档）。Tier-1 + Tier-2 加起来只做"治理智能体目标"。

### 1.3 解决的问题

1. **Agent 越权**：拦截危险工具调用（删生产库、推到 main、改密钥）
2. **决策黑盒**：每个决策落库 + 因果链可追溯
3. **人工兜底**：高风险决策走 HITL 审批，多通道送达（Discord / Telegram / Slack / PWA）
4. **多 Agent 治理**：同一治理后端管 OpenClaw、opencode、Hermes 等多种 Agent 框架
5. **运营可观测**：实时决策流、风险信号、漂移检测、审批积压、令牌消耗

### 1.4 关键术语

| 术语 | 含义 |
|---|---|
| **Action** | 一次 Agent 想做的事（部署、删文件、调 API），由 SDK 显式声明 |
| **Guard** | 策略评估器，对一个动作给出 `allow / warn / block / require_approval` 决策 |
| **Decision** | guard 的输出，落库到 `guard_decisions` |
| **Action Record** | 已开启的治理动作完整生命周期记录，落 `action_records` |
| **Policy** | 治理策略（risk threshold、action type 拦截、rate limit、green contract、permission level、custom webhook）|
| **Assumption** | Agent 在执行动作时声明的假设（"我相信这是测试库"），用于事后真伪验证 |
| **Signal** | 异常检测信号（autonomy spike、stale loop、assumption drift） |
| **Open Loop** | 未闭合的悬挂决策（等审批、等结果） |
| **Capability** | 注册到 DashClaw 的可治理 HTTP 能力（agent 可调用且自动 guard） |
| **Workflow** | 多步治理工作流模板（prompt → capability_invoke → knowledge_search 三种步骤） |

---

## 2. 整体架构

### 2.1 三层架构

```
┌─────────────────────────────────────────────────────────────┐
│  Tier 1: Core Runtime  (8 endpoints, NEVER remove)         │
│  /api/guard /api/actions /api/approvals /api/assumptions   │
│  /api/signals /api/policies /api/policies/generate         │
│  /api/health                                                │
├─────────────────────────────────────────────────────────────┤
│  Tier 2: Extensions  (operational intelligence)             │
│  Compliance · Drift · Evaluations · Scoring                 │
│  Execution Studio (capabilities · workflows · knowledge)    │
│  Billing & Metering · Learning · Analytics                  │
├─────────────────────────────────────────────────────────────┤
│  Tier 3: Archived  app/api/_archive/                        │
│  Messaging · CRM · Workspace · Memory Health (legacy)       │
└─────────────────────────────────────────────────────────────┘
                            ↑
                     org_id 多租户边界
                            ↑
┌─────────────────────────────────────────────────────────────┐
│  External: Agent Adapters (packages/)                       │
│  @dashclaw/openclaw-plugin                                  │
│  @dashclaw/opencode-plugin                                  │
│  dashclaw-hermes-plugin                                     │
│  @dashclaw/cli + @dashclaw/mcp-server                       │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 治理 4 步循环

每个被治理的 Agent 动作都跑同一个循环。**这是 DashClaw 的语义内核**：

```
┌─────────────────────────────────────────────────────────────┐
│  STEP 1  Guard       POST /api/guard                        │
│  ─────────────────                                          │
│  「我能不能做 X？」                                         │
│  → allow / warn / block / require_approval                  │
│  → 落 guard_decisions                                       │
│                                                             │
│  STEP 2  Record      POST /api/actions                      │
│  ─────────────────                                          │
│  「我正在做 X」                                             │
│  → 创建 action_records，status='running'/'pending_approval' │
│                                                             │
│  STEP 3  Verify      POST /api/assumptions                  │
│  ─────────────────                                          │
│  「我相信 Y 是真的，在 X 期间」                             │
│  → 落 assumptions（事后验证用）                              │
│                                                             │
│  STEP 4  Outcome     PATCH /api/actions/:id                 │
│  ─────────────────                                          │
│  「X 完成了，结果是 Z」                                     │
│  → status='completed'|'failed'，记 tokens、cost、output     │
└─────────────────────────────────────────────────────────────┘
```

最小可用治理只需 STEP 1 + 2 + 4（5 个 SDK 方法即可，详见 [`PROJECT_DETAILS.md`](../../PROJECT_DETAILS.md) §"Minimum viable governance loop"）。

### 2.3 多租户边界

所有 API 都按 `org_id` 隔离。`org_id` 由两个机制注入：

1. **API Key 反查**：SDK 携带 `x-api-key`，middleware（`middleware.js`）走 `apiKeys` 表 SHA-256 哈希查 → orgId
2. **Cookie 会话**：浏览器登录后从 NextAuth JWT cookie → email → users 表 → orgId

每个 `route.js` 都先 `getOrgId(request)`（`app/lib/org.js:10-11`），然后 SQL where 都带 `where org_id = $1`。**63 张表中 27 张有显式 FK 到 organizations 表，36 张做逻辑隔离**。

### 2.4 三种部署模式

| 模式 | 设置 | 用途 |
|---|---|---|
| **self_host**（默认） | `DASHCLAW_MODE=self_host` 或不设 | 单租户、本地 Postgres、不要 Neon |
| **demo** | `DASHCLAW_MODE=demo` | 公开 demo，所有 page 不走 auth，API 用内置 fixtures（不写库）|
| **hosted** | `DASHCLAW_HOSTED=true` | 多租户云端（Neon），`/connect` 加 trial 自动开通流，`/api/hosted/*` 端点开启 |

---

## 3. 功能模块矩阵

按用户能感知的"功能"组织。每个模块的代码入口都标了 file_path。

### 3.1 治理核心（Tier 1）

| 模块 | UI | API | 核心 lib |
|---|---|---|---|
| **决策中心** | `/mission-control` (`app/mission-control/page.js`) | `/api/operations/feed`、`/api/operations/summary` | `app/lib/missionControl.js`、`app/lib/operations-feed.js` |
| **决策台账** | `/decisions` (`app/decisions/page.js`) | `/api/guard/decisions` | `app/lib/repositories/guard.repository.js` |
| **审批队列** | `/approvals` | `/api/approvals/[actionId]` | `app/lib/notification-adapters/`（fan-out） |
| **策略管理** | `/policies` | `/api/policies` + `/api/policies/{generate,simulate,test}` | `app/lib/guard.js`、`app/lib/policy-generator.js`（LLM 自然语言→策略）|
| **风险信号** | `/security` | `/api/signals` | `app/lib/signals.js` |
| **假设链** | `/decisions/:id`（嵌入） | `/api/assumptions` | — |
| **接入配置** | `/setup` (`app/setup/page.jsx`) | `/api/setup/{status,proof,migrate,ping}`、`/api/doctor`、`/api/health` | `app/lib/readiness.mjs`、`app/lib/doctor/` |
| **通道接入** | `/connect` (`app/connect/page.jsx`) | `/api/hosted/workspaces`（hosted 模式） | `app/connect/HostedProvisionClient.jsx` |

### 3.2 扩展能力（Tier 2）

| 模块 | UI | API | 状态 |
|---|---|---|---|
| **Execution Studio · Capabilities** | `/capabilities` | `/api/capabilities`（CRUD + invoke + access + health） | Stable |
| **Execution Studio · Workflows** | `/workflows` | `/api/workflows/templates`（CRUD + execute + runs + resume + cancel） | Stable |
| **Execution Studio · Model Strategies** | `/workflows/.../strategies` | `/api/model-strategies`（CRUD + complete） | Stable |
| **Execution Studio · Knowledge** | （集成在 workflow） | `/api/knowledge/collections`（含 pgvector 嵌入 + 语义搜索） | Stable |
| **Scoring & Evaluations** | `/scoring`、`/evaluations` | `/api/scoring/profiles`、`/api/evaluations` | Stable |
| **Learning** | `/learning`、`/learning/analytics` | `/api/learning/{recommendations,analytics/*}` | Stable |
| **Drift Detection** | `/drift` | `/api/drift/{alerts,metrics,policies}` | Beta |
| **Compliance** | `/compliance` | `/api/compliance/{exports,schedules,trends}` | Beta |
| **Analytics** | `/analytics` | `/api/analytics`、`/api/usage/costs` | Stable |
| **Billing** | `/usage` | `/api/billing/{checkout,portal}`、Stripe webhook | Stable |
| **Audit Log** | `/audit-log` | `/api/activity` | Stable |
| **Webhooks（外发）** | `/webhooks` | `/api/webhooks`、`/api/webhooks/[id]/test` | Stable |
| **Agents 概览** | `/agents`、`/agents/[agentId]` | `/api/agents`、`/api/agents/heartbeat` | Stable |
| **Identities & Pairings** | `/api-keys`、`/identities` | `/api/identities`、`/api/pairings` | Stable |
| **My Agent (Personal)** | `/my-agent` | — | Beta |
| **Sessions** | （后台） | `/api/sessions`（多轮会话 + events） | Stable |
| **Bug Hunter** | `/bug-hunter` | `/api/_archive/bug-hunter`（被归档但 UI 还在） | Experimental |
| **Workspace** | `/workspace` | — | Beta |

### 3.3 平台基础（独立模块）

| 模块 | 入口 | 用途 |
|---|---|---|
| **Doctor** | `/api/doctor` + `npm run doctor` + `dashclaw doctor` CLI | 一站式诊断（DB、env、auth、deploy、SDK 可达性、shape drift、签名） + 安全自动修复 |
| **LivingCode** | `/livingcode/`（静态 HTML） | 代码图谱：路由、env vars、表、adapter、events、信号、setting key 实时快照 + 时序 sparkline + 上次 diff。`npm run livingcode:refresh` 重生成。 |
| **MCP Server** | `/api/mcp`（JSON-RPC HTTP） + npm `@dashclaw/mcp-server`（stdio） | 让任何 MCP 客户端（Claude Code / Claude Desktop / Claude Managed Agents）通过一行配置接入治理 |
| **OpenAPI Critical Stable** | `docs/openapi/critical-stable.openapi.json` | 13 个公开稳定端点的契约。`pnpm openapi:check` 在 CI 防漂移。 |

---

## 4. 数据模型

完整 schema 见 [`schema/schema.js`](../../schema/schema.js)（44 KB / 1072 行）。**63 张表分为 5 个域**。

### 4.1 域划分

| 域 | 代表表 | 说明 |
|---|---|---|
| **Governance Core** | action_records、guard_decisions、guard_policies、assumptions、approvals | 治理 4 步循环数据 |
| **Agent & Identity** | organizations、users、apiKeys、agentPresence、agentIdentities、agentPairings、agentSessions、sessionEvents | 多租户 + agent 注册 + 心跳 |
| **Execution & Workflow** | workflows、executions、scheduledJobs、evalScores、scoringProfiles、scoringDimensions、profileScores、riskTemplates | 执行编排 + 评分体系 |
| **Learning & Drift** | learningEpisodes、learningRecommendations、learningVelocity、learningCurves、driftBaselines、driftAlerts、driftSnapshots | 持续学习 + 漂移检测 |
| **Operations** | activityLogs、usageMeters、tokenSnapshots、tokenBudgets、dailyTotals、notificationPreferences | 运营度量 + 通知偏好 |

### 4.2 治理核心表（详细）

#### `action_records`（`schema/schema.js:71-110`）
```
id, action_id (UNIQUE),
agent_id, agent_name,
action_type, declared_goal, reasoning,
status (pending|running|pending_approval|completed|failed|blocked|cancelled),
risk_score, confidence,
recommendationId, recommendationApplied,
output_summary, side_effects,
tokens_in, tokens_out, cost_estimate, model,
signature, verified, approved_by,
timestamp_start, timestamp_end,
metadata (json),
org_id (FK)
```

#### `guard_decisions`（`schema/schema.js:486-498`）
```
id, org_id (FK),
agent_id, agent_name,            ← agent_name 由 drizzle/0003 添加（Phase-1 信任声明）
decision (allow|warn|block|require_approval),
reason, matched_policies (json),
context (json), risk_score, action_type,
created_at
```

#### `agent_presence`（`schema/schema.js:361-369`）
```
agent_id (PK), org_id (FK), agent_name,
status (online|offline|busy|idle|stale),
current_task_id,
last_heartbeat_at,
metadata (json)            ← adapter 在这里塞 agent_type、capabilities 等
```

### 4.3 多租户隔离

- **27 张表** 有 `org_id` + FK → organizations.id（强约束）
- **36 张表** 有 `org_id` 但没 FK（日志类、可逻辑删除的）
- API key 不直接存原文，只存 `keyHash`（SHA-256） + `keyPrefix`（显示用）— `apiKeys` 表（`schema/schema.js:53-66`）
- NextAuth 没有用标准 `accounts/sessions/verification_tokens`，自定义 `users` 表 + `(provider, provider_account_id)` 复合唯一索引

### 4.4 迁移时序

| 编号 | 文件 | 说明 |
|---|---|---|
| 0000 | `clammy_falcon.sql`（44 KB） | 初始化 50+ 张表 |
| 0001 | `agent_messages_action_index.sql` | 消息表索引 |
| 0002 | `agent_sessions_and_permission_level.sql` | 加 4 张 agent identity / pairing 表 |
| 0003 | `guard_decisions_agent_name.sql` | guard_decisions 加 agent_name 列 |
| 0003 | `hosted_trial_columns.sql` | organizations 加 hosted_mode + trial_action_cap |

---

## 5. 关键流程（带代码引用）

### 5.1 流程 A：guard 决策入库

```
SDK guard()                    ──→  sdk/dashclaw.js:97-104
   ↓
POST /api/guard                ──→  app/api/guard/route.js:26-68
   ↓ validateGuardInput
   ↓ scanForPromptInjection
   ↓
evaluateGuard()                ──→  app/lib/guard.js:84-310
   ↓ loadGuardPolicies (按 agent_id 过滤)
   ↓ computeRiskScore (基于 action_type / reversible / systems_touched / declared_goal)
   ↓ predictiveRisk.adjust (历史失败率 + LLM 可选)
   ↓ for each policy: evaluatePolicy(...)
   ↓   ├─ risk_threshold     guard.js:332-338
   ↓   ├─ action_type        guard.js:340-352
   ↓   ├─ rate_limit         guard.js:362-376
   ↓   ├─ semantic_check     guard.js:440-470
   ↓   ├─ behavior_anomaly   guard.js:404-420
   ↓   ├─ permission_escalation
   ↓   ├─ green_contract
   ↓   └─ webhook_check (异步)
   ↓
入库 guard_decisions           ──→  publishOrgEvent(GUARD_DECISION_CREATED)
   ↓
返回 { decision, action_id, reason, signals, risk_score, matched_policies }
```

服务端**强制**重新计算 risk_score（`Math.max(server_computed, agent_supplied)`）防止 SDK 撒谎降分。

### 5.2 流程 B：人工审批闭环

```
高风险动作                     ──→  /api/actions POST
   ↓ guard 返回 require_approval
   ↓ createAction(status='pending_approval')
   ↓
Notification Fan-out          ──→  app/lib/actionAlerts.js
   ├─ Discord DM (Approve/Deny embed)   discordApprovals.js (TweetNaCl 签名)
   ├─ Telegram inline keyboard          telegramApprovals.js
   └─ Slack blocks (notice only)        notification-adapters/slack.js
   ↓
人按 Approve / Deny
   ├─ Discord: POST /api/discord/interactions  (Ed25519 验证)
   ├─ Telegram: POST /api/telegram/webhook     (timingSafeEqual chat_id)
   └─ Web: POST /api/approvals/[actionId]      (admin role check)
   ↓
recordApproval()              ──→  原子 update action.status + approved_by + reasoning
   ↓
publishOrgEvent(ACTION_UPDATED)
   ↓
SDK waitForApproval()         ──→  sdk/dashclaw.js:219-310
   ├─ 优先：SSE  /api/stream      app/api/stream/route.js (15s 心跳, 30min 上限)
   └─ 降级：5s 轮询 GET /api/actions/[id]
   ↓
SDK 拿到 status=completed → 继续执行 / 抛 ApprovalDeniedError
   ↓
fireWebhooksForApproval       ──→  外发 webhook（用户在 /webhooks 配置的，HMAC SHA-256 签名）
```

### 5.3 流程 C：workflow 执行

```
POST /api/workflows/templates/[id]/execute      ──→  app/api/workflows/templates/[templateId]/execute/route.js:39-200
   ↓ load template
   ↓ guard(action_type='workflow_execute')   ← 整个 workflow 当一个动作做 guard
   ↓ DLP scan 输入变量
   ↓ block? → createBlockedActionRecord
   ↓
executeWorkflow()              ──→  app/lib/workflow-executor.js:39-200
   ↓ for each step:
   ↓   ├─ resume?   → reuse 缓存 output
   ↓   ├─ condition false? → skip
   ↓   └─ executeStep:
   ↓        ├─ prompt              → handlePrompt           step-handlers.js:94-129  (用 model strategy)
   ↓        ├─ capability_invoke   → handleCapabilityInvoke step-handlers.js:48-86   (调 capability-invoke.js)
   ↓        └─ knowledge_search    → handleKnowledgeSearch  step-handlers.js:15-40   (pgvector top-k)
   ↓ persistStepResult            ──→  workflow_step_results 表
   ↓
汇总 → action_records (parent action 关闭)
```

总耗时上限 120s（Vercel limit）。失败可 resume from last completed checkpoint。

### 5.4 流程 D：capability invoke（HTTP 能力调用）

```
POST /api/capabilities/[id]/invoke  ──→  app/api/capabilities/[capabilityId]/invoke/route.js:40-200
   ↓ prepareCapabilityInvocation (load auth + endpoint + schema from DB)
   ↓
guard 评估                      ← 先 guard 再 invoke
   ↓ block? → 403 + createBlockedActionRecord
   ↓ require_approval? → 202 + 回 action_id 让 SDK waitForApproval
   ↓
executeCapabilityInvocation     ──→  app/lib/capability-invoke.js:137-180
   ↓ retry policy（exponential backoff + jitter）
   ↓ singleAttempt:
   ↓   ├─ mapRequest (dot-path)              app/lib/mapping.js
   ↓   ├─ resolve auth (bearer / api_key)    capability-invoke.js:18-38
   ↓   ├─ fetch + AbortController (60s 超时)
   ↓   └─ mapResponse / 错误分类（timeout / network / capability_error）
   ↓
更新 action_records (status, output, duration_ms)
```

---

## 6. API 端点全景

完整索引：[`docs/api-inventory.md`](../api-inventory.md) + 机器可读 [`docs/api-inventory.json`](../api-inventory.json)。下面按业务域分组的概览：

| 域 | 端点数 | 代表路由 |
|---|---|---|
| **A · 治理核心** | 17 | `/api/guard`、`/api/actions`、`/api/approvals/{id}`、`/api/assumptions`、`/api/signals` |
| **B · 策略与决策** | 21 | `/api/policies`、`/api/policies/generate`、`/api/scoring/profiles`、`/api/evaluations`、`/api/risk-templates` |
| **C · 智能体管理** | 15 | `/api/agents`、`/api/agents/heartbeat`、`/api/identities`、`/api/pairings`、`/api/sessions` |
| **D · 执行与工作流** | 32 | `/api/workflows/templates`、`/api/capabilities`、`/api/model-strategies`、`/api/knowledge`、`/api/artifacts` |
| **E · 学习与分析** | 21 | `/api/learning`、`/api/drift`、`/api/analytics`、`/api/operations/{feed,summary}` |
| **F · 集成与通知** | 13 | `/api/messages`、`/api/webhooks`、`/api/discord/interactions`、`/api/telegram/webhook`、`/api/integrations/health` |
| **G · 计费与部署** | 8 | `/api/billing/{checkout,portal}`、`/api/usage`、`/api/hosted/workspaces`、Stripe webhook |
| **H · 平台基础** | 32 | `/api/health`、`/api/auth/*`、`/api/setup/*`、`/api/doctor`、`/api/keys`、`/api/mcp`、cron 任务 |
| **I · _archive**（已归档但有些 UI 仍引用） | 48 | `/api/_archive/{routing,context,messages,feedback,...}` |

**HTTP 方法分布**：GET 173 / POST 113 / PATCH 28 / DELETE 29 / PUT 1。

**路由别名**（`next.config.js:80-87`）—— 给老 SDK 用：

```
/api/actions/:actionId/approve       → /api/approvals/:actionId
/api/actions/assumptions             → /api/assumptions
/api/actions/assumptions/:id         → /api/assumptions/:id
/api/actions/signals                 → /api/signals
```

**成熟度**：Stable 41 / Beta 20 / Experimental 167 — 治理核心和大部分扩展是 stable，learning/drift/eval 多在 experimental（持续迭代中）。

---

## 7. 集成与通知

### 7.1 通知 / 审批通道（核心）

DashClaw 维护一个**统一 fan-out 层**（`app/lib/notification-adapters/index.js:1-40`），各 adapter 检查自己的 `requiredKeys`，缺 env var 自动跳过；`DASHCLAW_ALERTS_<NAME>=false` 是 kill switch。

| 通道 | 模式 | 入口 | 反向接入 |
|---|---|---|---|
| **Discord** | Bot DM + interactions webhook | `app/lib/discordApprovals.js` | `app/api/discord/interactions/route.js` (Ed25519 签名) |
| **Telegram** | Bot inline keyboard | `app/lib/telegramApprovals.js` | `app/api/telegram/webhook/route.js` (chat_id 白名单 + 签名) |
| **Slack** | Incoming webhook + bot token | `app/lib/notification-adapters/slack.js` | 仅通知，不支持反向交互 |
| **Email** | Resend → SendGrid 降级 | `app/lib/notification-adapters/email.js` | — |
| **Linear** | GraphQL，仅 critical signals 创 issue | `app/lib/notification-adapters/linear.js` | — |
| **GitHub** | REST API，仅 critical signals 创 issue | `app/lib/notification-adapters/github.js` | — |

**审批闭环**：Action 进入 pending_approval → Discord/Telegram 推送 → 人按按钮 → webhook 回调 → recordApproval → SSE 通知 SDK → SDK 解开阻塞。

### 7.2 OAuth / 用户登录

`app/lib/authConfig.mjs:1-71` 动态注册 NextAuth providers：

| Provider | 触发条件（env） |
|---|---|
| GitHub | `GITHUB_ID` + `GITHUB_SECRET` |
| Google | `GOOGLE_ID` + `GOOGLE_SECRET` |
| OIDC（Authentik / Keycloak / Okta 等） | `OIDC_CLIENT_ID/SECRET/ISSUER_URL` |
| 本地密码 | `DASHCLAW_LOCAL_ADMIN_PASSWORD`（fallback，单机自托管用） |

无 magic link / passwordless（Resend 仅做 alert）。

### 7.3 第三方平台

| 平台 | 用途 | 入口 |
|---|---|---|
| **Stripe** | 付费 / 订阅 | `app/api/billing/checkout/route.js`、`app/api/webhooks/stripe/route.js`、`app/lib/billing.js` |
| **OpenAI / Anthropic** | LLM provider（含 BYOK，per-org 加密存储） | `app/lib/llm.js`、`app/lib/providers.js` |
| **Neon** | 托管 Postgres（hosted 模式默认） | `app/lib/db.js` |
| **Vercel** | 默认部署目标 + cron + analytics | — |
| **GitHub Token** | governance 通知 + integration health | `app/lib/integration-health.js:91-99` |
| **Linear API** | governance 通知 | `app/lib/notification-adapters/linear.js` |

### 7.4 健康监测

`/api/cron/integration-health`（每 6 小时一次）跑 `app/lib/integration-health.js:21-134`，对 OpenAI / Anthropic / Slack / Discord / Linear / GitHub / Neon / Resend / Stripe 共 9 个 provider 做轻量探测，状态变化时触发 health-change-alerts → 走通知 fan-out。

### 7.5 外发 Webhook（用户配置的）

`/api/webhooks` (`app/api/webhooks/route.js:11-95`) 让用户配置自己的 endpoint。事件类型：

```
all, autonomy_spike, high_impact_low_oversight, repeated_failures,
stale_loop, assumption_drift, stale_assumption, stale_running_action,
approval_pending, approval_granted, approval_denied
```

每次匹配事件 → HMAC SHA-256 签名 → POST 到用户 URL，记录 delivery 历史。

### 7.6 MCP Server（DashClaw 作为 MCP 服务器）

`app/api/mcp/route.js`（HTTP JSON-RPC 2.0）+ `mcp-server/`（stdio 包） 暴露 8 个治理工具 + 4 个资源给任何 MCP 客户端。客户端只要在 `claude_desktop_config.json` 加一行就接入治理：

```json
{
  "mcpServers": {
    "dashclaw": {
      "command": "npx",
      "args": ["@dashclaw/mcp-server"],
      "env": { "DASHCLAW_URL": "...", "DASHCLAW_API_KEY": "..." }
    }
  }
}
```

工具：`guard`、`record`、`invoke`、`capabilities_list`、`policies_list`、`wait_for_approval`、`session_start`、`session_end`。
资源：`dashclaw://policies`、`dashclaw://capabilities`、`dashclaw://agent/{id}/history`、`dashclaw://status`。

---

## 8. 技术栈

| 层 | 技术 | 版本（package.json） |
|---|---|---|
| 运行时 | Node.js | ≥ 20（推荐 22） |
| 包管理 | pnpm | ^10 |
| Web 框架 | Next.js（App Router） | 16.2.4，Turbopack dev |
| UI | React | 18，Tailwind CSS 3、Lucide icons、自定义 design tokens（`.impeccable.md`） |
| i18n | next-intl | 4.11（plan E：`/zh-CN/` 路径前缀，本次会话引入）|
| 数据库 | Postgres（Neon HTTP 或本地 TCP） | — |
| ORM | Drizzle | — |
| 认证 | NextAuth | 4.24（自定义 users 表，无 sessions 表） |
| 校验 | Zod | 4.4 |
| 测试 | Vitest（jsdom）+ Playwright（smoke） | Vitest 4.1 |
| Stripe | stripe SDK | 22.1 |
| 加密 | tweetnacl（Ed25519 Discord 验证）+ Web Crypto（HMAC、SHA-256、签名） | — |
| 部署 | Vercel（默认）/ Docker / 任意 Node.js host | — |
| Cron | Vercel Cron / GitHub Actions | — |

`Tailwind` 主题与设计 token 见 `.impeccable.md`，颜色 / 字体一律走 `app/globals.css` 变量，**不允许硬编码 hex**。

---

## 9. 安全 / 多租户

### 9.1 身份链

```
SDK → x-api-key 头 → middleware.js
  → resolveApiKey: SHA-256(key) → apiKeys.keyHash 查 → orgId
  → middleware 注入 x-org-id 头给下游 route
  → route.js getOrgId() 拿到 orgId
  → 所有 SQL where org_id = $1
```

`apiKeys.scope` 字段限定 key 能访问哪些 surface（admin / readonly / agent）。

### 9.2 Agent 身份（Phase 1，2026-04 上线）

`guard_decisions.agent_name` 是**信任声明**字段（agent 自己说的），目前无加密验证。`drizzle/0003_guard_decisions_agent_name.sql` 加上的，文档见 [`docs/architecture/runtime-api.md`](./runtime-api.md)。

Phase 2 计划（未实施）：JWKS 验证 + Ed25519 签名 + agent_pairings 准入注册。

### 9.3 PII / DLP redaction

guard 输入、action 输入、approval reasoning 都过 DLP scan（`app/lib/security.js`）。命中 PII 模式（email、phone、SSN、token）的字段被 `[REDACTED]` 替换后才落库。

### 9.4 提示注入扫描

guard 默认对 `declared_goal` 和 `reasoning` 跑 `app/lib/promptInjection.js`，检测 jailbreak 模板（"ignore previous"、role hijack 等）。`DISABLE_PROMPT_INJECTION_SCAN=true` 可关。

### 9.5 签名验证（可选）

`ENFORCE_AGENT_SIGNATURES=true` 时，POST `/api/actions` 要求 SDK 携带 `_signature` 字段。服务端用预注册的 `agent_identities.public_key` 验证。

### 9.6 Rate limit

middleware.js 在 demo 模式自动 rate limit；其它模式可由 policy 配置 rate_limit type（按 agent 计数 + 滑动窗口）。

---

## 10. 测试与 CI

### 10.1 测试

| 类型 | 位置 | 工具 | 命令 |
|---|---|---|---|
| **单元** | `__tests__/unit/` (191 个文件) | Vitest + jsdom | `pnpm test`（watch）/ `pnpm test -- --run`（CI） |
| **API 集成** | `scripts/test-full-api.mjs` | curl 风 fetch | `pnpm test:api` |
| **API 模糊** | `scripts/fuzz-api.mjs` | — | `pnpm test:fuzz` |
| **Smoke (E2E)** | `playwright.config.js` | Playwright | `pnpm test:smoke`（用 `dev:smoke` 端口 3319） |

### 10.2 CI 必过项（`.github/workflows/`）

1. `pnpm openapi:check` — 13 个稳定端点的 OpenAPI 契约不能漂移
2. `pnpm test -- --run` — 单元测试
3. `pnpm lint` — ESLint
4. `pnpm check:contracts` — 自定义契约校验（`scripts/check-contracts.mjs`）

### 10.3 Doctor 自检

`pnpm doctor` 跑 `app/lib/doctor/` 引擎，覆盖：DB 连通、env 完整、auth 配置、deploy 痕迹（Vercel / Docker / etc）、SDK 可达、guard 数据新鲜度、shape drift（schema 与代码不一致）、签名状态。安全自动修复（迁移、默认策略种子）— **危险修复（写 .env、删数据）需人工确认**。

---

## 11. 扩展机制

DashClaw 通过 **6 种扩展点**让外部接入而无需改核心：

| 扩展点 | 描述 | 文档 |
|---|---|---|
| **1. Policy** | 策略类型可自定义（rate_limit / risk_threshold / action_type / semantic / behavior_anomaly / permission_escalation / green_contract / webhook_check） | `app/lib/guard.js:332-580` |
| **2. Agent Adapter (MAAP)** | 多 agent 适配协议，外部 Agent 框架按统一 4 步循环接入 | [`multi-agent-adapter.md`](./multi-agent-adapter.md) |
| **3. Capability** | 用户注册任何 HTTP 端点为可治理 capability，自动 guard + invoke | `/api/capabilities` |
| **4. Workflow Step** | 多步治理工作流，3 种 built-in step 类型 | `app/lib/workflow-executor.js`、`step-handlers.js` |
| **5. MCP Tool** | 通过 MCP server 暴露给 MCP 客户端 | `mcp-server/` |
| **6. Outbound Webhook** | 治理事件外发，HMAC 签名 | `/api/webhooks` |
| **7. Notification Adapter** | 自定义新通知通道（按 Slack/Discord/Telegram 模板加） | `app/lib/notification-adapters/` |

### 已实现的 Agent Adapter

| 包 | 语言 | 宿主 | 路径 |
|---|---|---|---|
| `@dashclaw/openclaw-plugin` | TS | OpenClaw | `packages/openclaw-plugin/` |
| `@dashclaw/opencode-plugin` | TS | opencode (Bun) | `packages/opencode-plugin/`（本次会话新增） |
| `dashclaw-hermes-plugin` | Python | Hermes | `packages/hermes-plugin/`（本次会话新增） |

适配协议：[`multi-agent-adapter.md`](./multi-agent-adapter.md)。集成指南：[`docs/integrations/`](../integrations/)。

---

## 12. 关键文件结构（导航索引）

```
DashClaw/
├── app/                              ← Next.js App Router（前端 + API）
│   ├── api/                          ← 180 个 route.js（含 _archive 228 个）
│   ├── lib/                          ← 101 个核心 lib
│   │   ├── guard.js                  ← 治理决策评估器（核心）
│   │   ├── billing.js                ← cost 计算
│   │   ├── policy-generator.js       ← 自然语言→策略 LLM
│   │   ├── predictive-risk.js        ← 历史 + LLM 风险调整
│   │   ├── workflow-executor.js      ← workflow 执行引擎
│   │   ├── step-handlers.js          ← 三种 step 类型实现
│   │   ├── capability-invoke.js      ← capability HTTP 调用引擎
│   │   ├── notification-adapters/    ← 6 个通知通道
│   │   ├── doctor/                   ← 诊断引擎
│   │   ├── repositories/             ← 数据访问层（按表分文件）
│   │   ├── readiness.mjs             ← /setup 页所用的就绪报告生成
│   │   └── ...
│   ├── components/                   ← 71 个共享 React 组件（PageLayout 等）
│   ├── mission-control/, decisions/, setup/, connect/  ← 4 个 swarmxai 嵌入页
│   ├── agents/, policies/, capabilities/, workflows/, learning/ ← Tier-2 UI
│   └── layout.js                     ← Root layout（next-intl Provider）
├── schema/schema.js                  ← Drizzle schema（63 张表，1072 行）
├── drizzle/                          ← 5 个 SQL 迁移
├── middleware.js                     ← 1379 行：auth + demo + CORS + i18n wrapper
├── next.config.js                    ← Next.js 配置（含 next-intl 插件、路由别名、CSP）
├── i18n/request.js                   ← next-intl locale 解析（本次会话新增）
├── messages/{en,zh-CN}.json          ← i18n 文案（本次会话新增）
├── sdk/
│   ├── dashclaw.js                   ← v2 canonical SDK（80 方法，1006 行）
│   └── legacy/dashclaw-v1.js         ← 兼容层（2934 行）
├── packages/                         ← 4 个独立包
│   ├── openclaw-plugin/
│   ├── opencode-plugin/              ← 本次会话新增
│   ├── hermes-plugin/                ← 本次会话新增
│   └── dashclaw-demo/
├── mcp-server/                       ← MCP server stdio 包
├── examples/                         ← 15+ framework 集成示例
├── scripts/                          ← 70+ 运维脚本（auto-migrate, doctor, openapi-check, ...）
├── __tests__/unit/                   ← 191 个 Vitest 测试
├── docs/
│   ├── architecture/                 ← 架构文档（本文件 + 多 agent / livingcode / runtime-api / ...）
│   ├── integrations/                 ← 集成指南（openclaw / opencode / hermes / swarmxai / claude-code）
│   ├── i18n/                         ← i18n 策略（本次会话新增）
│   ├── api-inventory.{md,json}       ← API 全清单
│   ├── sdk-reference.md / sdk-parity.md
│   ├── ops/, planning/, lessons/, decisions/, releases/  ← 运营 / 规划 / 经验 / ADR / 发布
│   └── ...
├── PROJECT_DETAILS.md                ← 接口 / 模块快速参考
├── QUICK-START.md                    ← 8 分钟接入指南
├── README.md                         ← 公开 README
├── CLAUDE.md                         ← Claude Code 提示
└── .impeccable.md                    ← 设计语言 / brand
```

---

## 13. 文档体系导航

按你想了解的内容选择文档：

### 入门
- 系统是什么 / 怎么用？→ [`README.md`](../../README.md) + [`QUICK-START.md`](../../QUICK-START.md)
- 8 分钟接入第一个 Agent？→ [`/connect`](http://localhost:3310/connect)（运行 `pnpm dev` 后查看）

### 系统理解
- **本文档**：全局架构 / 数据模型 / 关键流程 / 扩展点
- 接口 / 模块快速参考 → [`PROJECT_DETAILS.md`](../../PROJECT_DETAILS.md)
- 治理 4 步循环 API 详解 → [`docs/architecture/runtime-api.md`](./runtime-api.md)

### SDK & Adapter
- SDK 80 方法详解 → [`docs/sdk-reference.md`](../sdk-reference.md)
- 多 Agent 适配协议 → [`docs/architecture/multi-agent-adapter.md`](./multi-agent-adapter.md)
- 各 framework 集成 → [`docs/integrations/`](../integrations/) 下 README + 各 framework 子文档
- LangGraph / CrewAI / OpenAI / AutoGen 示例 → [`examples/`](../../examples/)

### 部署 / 运维
- 自托管不带 OAuth → [`docs/deploy-without-oauth.md`](../deploy-without-oauth.md)
- 托管模式部署 runbook → [`docs/hosted-deployment-runbook.md`](../hosted-deployment-runbook.md)
- OIDC 配置 → [`docs/OIDC_SETUP.md`](../OIDC_SETUP.md)
- Doctor / 诊断 → `pnpm doctor`

### 高级主题
- LivingCode 子系统（代码图谱） → [`docs/architecture/livingcode-subsystem.md`](./livingcode-subsystem.md)
- 平台对象模型 → [`docs/architecture/platform-object-model.md`](./platform-object-model.md)
- Capabilities Tier-2 → [`docs/architecture/capabilities.md`](./capabilities.md)
- 维护循环 → [`docs/architecture/organism-governed-maintenance-loop.md`](./organism-governed-maintenance-loop.md)
- Claude Code handoff 模板 → [`docs/architecture/claude-code-handoff-templates.md`](./claude-code-handoff-templates.md)

### i18n（本次会话新增）
- 翻译策略 → [`docs/i18n/strategy.md`](../i18n/strategy.md)
- 后端 reason_code 体系实施 plan → [`docs/i18n/reason-codes.md`](../i18n/reason-codes.md)

### swarmxai 集成（本次会话新增）
- 嵌入设计 → [`docs/integrations/swarmxai.md`](../integrations/swarmxai.md)

---

## 14. 技术债与未完成的事

诚实记录当前已知的差距，便于规划：

| 项 | 状态 | 文档 |
|---|---|---|
| **agent_name 信任验证 Phase 2** | 未实现（仅 Phase 1 信任声明） | runtime-api.md |
| **i18n 全量页面翻译** | 仅 4 页（plan E），剩 50+ 页 | docs/i18n/strategy.md |
| **后端 reason_code 体系** | 未实施，文档已落地 | docs/i18n/reason-codes.md |
| **swarmxai 集成** | 设计文档已落地，扩展仓未建 | docs/integrations/swarmxai.md |
| **MCP Server stdio 包** | `mcp-server/` 存在但 npm 包未发布 | — |
| **Stripe billing 全集成** | 单元测试覆盖差，部分 webhook 路径手测过 | — |
| **Tier 2 部分 experimental 端点** | 167 个 experimental 中有些可能被移除 / 重构 | api-inventory.md |
| **Drift detection 算法** | 当前是规则 + 简单统计，无 ML 模型 | — |
| **`/docs` UI 页面 i18n** | 2165 行未翻译，规划上不翻 | docs/i18n/strategy.md |

---

## 15. 一句话总结

DashClaw 是一个 **Postgres 上的 Next.js 16 应用**，对外提供 **180 个 HTTP 端点 + 80 个 SDK 方法 + 1 个 MCP server**，把任何 AI 智能体框架的工具调用通过 **4 步治理循环（guard → record → verify → outcome）** 包装成可审计、可拦截、可人工兜底的事件，并将事件实时投影到 6 个外部通道（Discord / Telegram / Slack / Email / Linear / GitHub）做运营响应。

它的扩展性建立在 **6 种扩展点**（policy / adapter / capability / workflow step / MCP tool / outbound webhook / notification adapter）上，所有扩展通过共享 `org_id` 多租户边界 + `apiKeys` 哈希身份链 + 可选 Ed25519 签名验证保证安全。

整个系统**主动拒绝**业务能力（Calendar / CRM / Messaging）—— 这是它最重要的边界，也是它能保持小核心、长期演进、易嵌入的根本原因。
