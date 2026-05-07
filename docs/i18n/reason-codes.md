# 后端 reason_code 体系实施 plan

**状态：待落地（plan E 前端 4 页翻译已完成；本文是后端配套工作）**

DashClaw 的 `/api/guard` 决策返回的 `reason` 字段当前是**动态拼接的英文字符串**，前端切到中文后这些字符串仍为英文 — 用户看到的会是「中文 UI · 英文原因」混合。要彻底中文化必须给后端引入 `reason_code` 体系。

---

## 1. 现状（grep 出的事实）

`app/lib/guard.js` 里硬编码了约 20 条 reason 模板：

```js
// 静态字符串
reason: 'Semantic check unavailable (no LLM key configured) — human review required'
reason: 'New agent behavior: No historical data for similarity baseline.'
reason: 'Webhook check failed or timed out (on_timeout: block)'
reason: 'Semantic check failed (fallback: block)'

// 带参数的字符串
reason: `Risk score ${riskScore} >= threshold ${threshold}`
reason: `Action type "${context.action_type}" requires approval`
reason: `Action type "${context.action_type}" is blocked by policy`
reason: `Agent performed ${count} actions in ${windowMinutes}min (limit: ${maxActions})`
reason: `Behavioral Anomaly: Action similarity (${(maxSimilarity * 100).toFixed(1)}%) is below the safety threshold (${(threshold * 100).toFixed(0)}%).`
reason: `Semantic Violation: ${result.reason}`
reason: `Permission escalation: agent has ${agentLevel}, tool requires ${toolPerm}`
reason: `Green contract: no test status reported, ${requiredLevel} required`
reason: `Green contract: observed ${observedLevel}, required ${requiredLevel}`
reason: `Branch ${branch.name || 'unknown'} is ${branch.freshness} (${branch.commits_behind} commits behind)`
reason: `${policy.name} (webhook): ${reason}`
```

`reasons` 多个 reason 用 `';'` 拼接（line 257、297）。

前端展示 reason 的地方（mission-control 拦截卡片、decisions 表格）当前直接渲染这个英文字符串。

---

## 2. 目标设计

把 `reason: string` 一对一升级为 `{ reason_code: string, reason_args: Record<string, unknown>, reason: string /* 兼容字段，保留英文 */ }`。前端拿 `reason_code` 在 `messages/{locale}.json` 里查模板，用 `reason_args` 填充；`reason` 保留为 fallback。

### 2.1 API 形状（向后兼容）

```jsonc
// 现状
{
  "decision": "block",
  "action_id": "act_gd_xxx",
  "reason": "Risk score 85 >= threshold 70",
  "signals": ["high risk"]
}

// 目标
{
  "decision": "block",
  "action_id": "act_gd_xxx",
  "reason": "Risk score 85 >= threshold 70",   // ← 不删，保留英文 fallback
  "reason_code": "risk.threshold.exceeded",
  "reason_args": { "riskScore": 85, "threshold": 70 },
  "signals": [
    { "code": "high_risk", "args": {} }       // ← signals 同步升级（可选 phase 2）
  ]
}
```

旧 SDK 客户端继续读 `reason`，零破坏。新前端读 `reason_code + reason_args` 走本地化。

### 2.2 reason_code 命名约定

`<category>.<subcategory>.<verb>`，全小写、下划线分隔多词：

- `risk.threshold.exceeded` — 风险分超阈值
- `action.type.blocked` — action_type 被策略拦截
- `action.type.approval_required` — action_type 需要审批
- `rate.limit.exceeded` — 频率限制
- `semantic.unavailable` — 语义检查不可用
- `semantic.failed.block` — 语义检查失败（fallback=block）
- `semantic.failed.approval` — 语义检查失败（fallback=approval）
- `semantic.violation` — 语义检查发现违规
- `behavior.anomaly.similarity_low` — 行为相似度低于基线
- `behavior.no_baseline` — 无历史基线
- `permission.escalation` — 权限提升
- `green_contract.no_test_status` — 绿契约：缺测试状态
- `green_contract.below_required` — 绿契约：低于要求
- `green_contract.branch_stale` — 绿契约：分支过期
- `webhook.timeout` — 外部 webhook 超时
- `webhook.policy.matched` — 自定义 webhook 命中
- `policy.default.allow` — 默认放行（无匹配）

### 2.3 messages 模板形态

`messages/zh-CN.json`（已经有占位）：

```json
{
  "policy": {
    "reasonCodes": {
      "risk.threshold.exceeded": "风险分 {riskScore} 超过阈值 {threshold}",
      "action.type.blocked": "动作类型「{actionType}」被策略拦截",
      "action.type.approval_required": "动作类型「{actionType}」需要审批",
      "rate.limit.exceeded": "智能体在 {windowMinutes} 分钟内执行了 {count} 个动作（上限 {maxActions}）",
      "semantic.unavailable": "语义检查不可用（未配置 LLM 密钥）— 需要人工审核",
      "semantic.failed.block": "语义检查失败（兜底：拦截）",
      "semantic.failed.approval": "语义检查失败（兜底：审批）",
      "semantic.violation": "语义违规：{detail}",
      "behavior.anomaly.similarity_low": "行为异常：动作相似度 {similarityPercent}% 低于安全阈值 {thresholdPercent}%",
      "behavior.no_baseline": "新智能体行为：暂无历史基线数据",
      "permission.escalation": "权限提升：智能体有 {agentLevel}，工具要求 {toolPerm}",
      "green_contract.no_test_status": "绿契约：未上报测试状态，要求 {requiredLevel}",
      "green_contract.below_required": "绿契约：实际为 {observedLevel}，要求 {requiredLevel}",
      "green_contract.branch_stale": "绿契约：分支 {branchName} 处于「{freshness}」（落后 {commitsBehind} 个提交）",
      "webhook.timeout": "外部 webhook 超时（on_timeout: block）",
      "webhook.policy.matched": "{policyName}（webhook）：{detail}",
      "policy.default.allow": "无匹配策略 — 默认放行"
    }
  }
}
```

`en.json` 镜像同样的 keys，值是当前的英文文案 — 前端切英文时用同一套模板渲染，效果等同当前写法。

---

## 3. 实施步骤

### 3.1 后端：guard.js 改造

每条 `return { action, reason: '...' }` 升级为 `return { action, reason: '...', reason_code, reason_args }`：

```js
// 改造前
if (riskScore >= threshold) {
  return { action: rules.action || 'block', reason: `Risk score ${riskScore} >= threshold ${threshold}` };
}

// 改造后
if (riskScore >= threshold) {
  return {
    action: rules.action || 'block',
    reason: `Risk score ${riskScore} >= threshold ${threshold}`,  // 保留兼容
    reason_code: 'risk.threshold.exceeded',
    reason_args: { riskScore, threshold },
  };
}
```

**约 20 处需改**，文件全在 `app/lib/guard.js`。每处约 3 行改动，工作量 ~2 小时。

### 3.2 后端：聚合层

`evaluatePolicies()`（line ~257、297）现在用 `reasons.join('; ')`。改成：

```js
const reasonChain = matchedPolicies.map(p => ({
  code: p.reason_code,
  args: p.reason_args,
  reason: p.reason,  // 兼容
}));
return {
  decision,
  reason: reasonChain.map(r => r.reason).join('; '),         // 兼容
  reason_chain: reasonChain,                                  // 新增
  reason_code: reasonChain[0]?.code,                          // 主原因
  reason_args: reasonChain[0]?.args,
  ...
};
```

`reason_chain` 让前端能渲染多条原因，`reason_code/args` 只取主原因（最高优先级的）。

### 3.3 后端：guard_decisions 表

`drizzle/000X_guard_decisions_reason_code.sql`：

```sql
ALTER TABLE guard_decisions ADD COLUMN reason_code text;
ALTER TABLE guard_decisions ADD COLUMN reason_args jsonb;
```

落库为查询/审计用。决策台账 (`/decisions`) 历史记录也能本地化展示。

### 3.4 前端：渲染辅助

新增 `app/lib/i18n/translateReason.js`：

```js
import { useTranslations } from 'next-intl';

export function useReasonRenderer() {
  const t = useTranslations('policy.reasonCodes');
  return ({ reason_code, reason_args, reason }) => {
    if (!reason_code) return reason || '';
    try {
      return t(reason_code, reason_args || {});
    } catch {
      return reason || reason_code;  // 翻译缺失时用英文 fallback
    }
  };
}
```

mission-control / decisions / 任何展示 reason 的组件用 `useReasonRenderer()` 替代直接 `{action.reason}`。

### 3.5 SDK 与 dashclaw npm 包

`sdk/dashclaw.js` 的 `GuardDecision` 类型加新字段（保留 `reason`）。版本号小升（2.11.x → 2.12.0），changelog 标注「新增 reason_code/reason_args，旧字段不变」。

`packages/openclaw-plugin`、`packages/opencode-plugin`、`packages/hermes-plugin` 三个 adapter 自动获益（它们透传 reason 到宿主框架，加 reason_code 后宿主也能本地化）。

---

## 4. 工作量估算

| 工作 | 人天 |
|---|---|
| guard.js 20 处 reason 改造 | 1 |
| 聚合层（reason_chain）+ 单测 | 0.5 |
| Drizzle 迁移 + repository 改 | 0.5 |
| 前端 useReasonRenderer 工具 + 替换调用点（mission-control 拦截卡 + decisions 表） | 1 |
| messages 翻译（约 16 条 reason_code） | 0.5 |
| SDK type 升级 + 测试 | 0.5 |
| **合计** | **4 人天** |

---

## 5. 落地顺序建议

1. **先做 §3.1 + §3.4**：guard.js 加字段、前端做兜底渲染 — 这一步交付后已经能让前端展示中文 reason（即使后端 reason_chain 还没做）。
2. **再做 §3.2**：reason_chain 让多条原因都能本地化。
3. **§3.3 落库**作为审计需求来时再做。
4. **§3.5 SDK 升级** 作为最后一步，让外部 adapter 客户端能拿到 reason_code。

---

## 6. 决策点（可与 swarmxai 后端代理模块同步设计）

在写后端 reason_code 的同时，如果同步推进 swarmxai 集成方案 B（`iplatform-module-dashclaw` 反向代理 + 数据投影），那 `reason_code` 字段也是 swarmxai 后端做联合审计的关键 — 它能直接落 ClickHouse 做按原因聚合的分析（本地化展示由前端按 locale 渲染）。

所以这两件事可以**合并为同一批工作的两个面**：DashClaw 后端先升级 reason_code（本文 §3），swarmxai 后端代理模块直接用 reason_code 字段做透传 + 聚合（无需自己再翻译）。
