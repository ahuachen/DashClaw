# Integration: swarmxai 平台

把 DashClaw 集成进 [swarmxai](https://github.com/...) 管理端的设计方案。
本文给出 **3 套方案**（轻 / 中 / 重），并明确推荐路径与拒绝路径。

---

## TL;DR — 推荐路径

> **方案 A（菜单 iframe 嵌入）先做、可上线；方案 B（后端代理 + 菜单嵌入）作为下一步演进；方案 C（完整 Vue 重写）不推荐**。

| 方案 | 工作量 | 集成深度 | 何时选 |
|---|---|---|---|
| **A. 菜单 iframe 嵌入** | 0.5–1 周 | 视觉嵌入 + SSO 透传 | 现在做，立即可用 |
| **B. iframe + 后端代理 + 数据互通** | 2–4 周 | 共享租户、统一审计、菜单/角色由 swarmxai 管 | 治理纳入 swarmxai 工作流后 |
| **C. 完整 Vue 重写 + Java 后端复刻** | 3–6 个月 | 原生集成 | 不推荐，理由见 §6 |

---

## 1. 技术栈现状对照

| 层 | DashClaw | swarmxai_frontend | swarmxai_backend |
|---|---|---|---|
| 语言 | TypeScript / JavaScript | TypeScript | Java 21 |
| 框架 | Next.js 16 (App Router) | Vue 3 + Vben Admin 5.5.9 + Ant Design Vue | Spring Boot 3.5.5 + MyBatis-Plus |
| 包管理 | pnpm | pnpm + Turbo (monorepo) | Maven |
| 数据库 | Postgres (Drizzle ORM) | — | MySQL 主从 + Redis + ClickHouse |
| 鉴权 | API key (header `x-api-key`) + 多租户 `x-org-id` | 来自后端 | JWT Bearer + `tenant-id` 头 + Spring Security |
| 部署 | Next.js standalone 容器 | nginx 静态资源（端口 8080） | Spring jar（端口 48080） |
| 前端规模 | 62 page.js + 71 components | monorepo，多 app | — |

**核心约束**：DashClaw 是 React/Next，swarmxai_frontend 是 Vue。**没有"把 DashClaw 抽成 Vue 组件"的低成本路径** — 跨框架组件复用要么用 micro-frontend（qiankun/wujie），要么 iframe，要么完全重写。swarmxai 当前**没有微前端框架**，但**已有原生 iframe 嵌入样例**（dtarts、twins、ssonic 三个 view），所以 iframe 是最现成的路径。

---

## 2. 方案 A：菜单 iframe 嵌入（推荐先做）

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────┐
│           swarmxai_frontend (Vue + nginx :8080)          │
│  ┌────────────────────────┐                              │
│  │  顶级菜单：DashClaw 治理 │                              │
│  │  ├ Mission Control     │ ──┐                          │
│  │  ├ Decisions           │   │  IFrameView              │
│  │  ├ Setup               │   │  src=https://dashclaw…  │
│  │  └ Connect             │ ──┘                          │
│  └────────────────────────┘                              │
└──────────────────────────┬──────────────────────────────┘
                           │ iframe + postMessage
                           ▼
┌─────────────────────────────────────────────────────────┐
│        DashClaw (Next.js, 独立部署 :3310 或子域名)        │
│        Postgres 独立                                      │
└─────────────────────────────────────────────────────────┘
```

### 2.2 实施清单

#### A.1 前端：在 swarmxai_frontend 新增 dashclaw 模块

**文件 1：路由模块**

`apps/web-antd/src/router/routes/modules/dashclaw.ts`：

```ts
import type { RouteRecordRaw } from 'vue-router';
import { BasicLayout, IFrameView } from '#/layouts';
import { $t } from '#/locales';

const DASHCLAW_BASE = import.meta.env.VITE_GLOB_DASHCLAW_URL || 'https://dashclaw.swarmxai.local';

const routes: RouteRecordRaw[] = [
  {
    path: '/dashclaw',
    component: BasicLayout,
    meta: {
      icon: 'lucide:shield-check',
      order: 60,
      title: $t('dashclaw.menu.root'),
      keepAlive: true,
    },
    children: [
      {
        path: 'mission-control',
        name: 'DashClawMissionControl',
        component: IFrameView,
        meta: {
          title: $t('dashclaw.menu.missionControl'),
          iframeSrc: `${DASHCLAW_BASE}/mission-control?embed=swarmxai`,
        },
      },
      {
        path: 'decisions',
        name: 'DashClawDecisions',
        component: IFrameView,
        meta: {
          title: $t('dashclaw.menu.decisions'),
          iframeSrc: `${DASHCLAW_BASE}/decisions?embed=swarmxai`,
        },
      },
      {
        path: 'setup',
        name: 'DashClawSetup',
        component: IFrameView,
        meta: {
          title: $t('dashclaw.menu.setup'),
          iframeSrc: `${DASHCLAW_BASE}/setup?embed=swarmxai`,
        },
      },
      {
        path: 'connect',
        name: 'DashClawConnect',
        component: IFrameView,
        meta: {
          title: $t('dashclaw.menu.connect'),
          iframeSrc: `${DASHCLAW_BASE}/connect?embed=swarmxai`,
        },
      },
    ],
  },
];

export default routes;
```

**文件 2：i18n 翻译**

`apps/web-antd/src/locales/langs/zh-CN/dashclaw.json`：
```json
{
  "menu": {
    "root": "智能体治理",
    "missionControl": "决策中心",
    "decisions": "决策台账",
    "setup": "接入配置",
    "connect": "通道接入"
  }
}
```

`apps/web-antd/src/locales/langs/en-US/dashclaw.json`：
```json
{
  "menu": {
    "root": "Agent Governance",
    "missionControl": "Mission Control",
    "decisions": "Decisions",
    "setup": "Setup",
    "connect": "Connect"
  }
}
```

**文件 3：环境变量**

`apps/web-antd/.env.development`、`.env.production`：
```bash
VITE_GLOB_DASHCLAW_URL=https://dashclaw.swarmxai.local
```

#### A.2 后端菜单（关键 — swarmxai 菜单是后端动态下发）

swarmxai 菜单存在 `system_menu` 表（`iplatform-module-system`）。需要执行 SQL 插入新菜单项，并把对应的角色权限（`system_role_menu`）配置好。

```sql
-- 顶级菜单
INSERT INTO system_menu (parent_id, name, type, path, icon, component, sort, status, tenant_id)
VALUES (0, '智能体治理', 1, '/dashclaw', 'shield-check', 'BasicLayout', 60, 0, 1);

-- 子菜单（id 为上一步插入的 id）
INSERT INTO system_menu (parent_id, name, type, path, icon, component, sort, status, tenant_id)
VALUES
  (@root_id, 'Mission Control', 2, 'mission-control', '', 'IFrameView', 1, 0, 1),
  (@root_id, '决策台账',         2, 'decisions',       '', 'IFrameView', 2, 0, 1),
  (@root_id, '接入配置',         2, 'setup',           '', 'IFrameView', 3, 0, 1),
  (@root_id, '通道接入',         2, 'connect',         '', 'IFrameView', 4, 0, 1);

-- 给管理员角色赋权（角色 id 视租户而定）
INSERT INTO system_role_menu (role_id, menu_id, tenant_id) ...;
```

#### A.3 SSO：把 swarmxai JWT 透传到 DashClaw

DashClaw 用 `x-api-key`，而 swarmxai 用 `Authorization: Bearer <jwt>`。两套鉴权要打通，最稳的做法：

**方案 A.SSO.1（最简）：每租户预置一个 DashClaw API key，存在 swarmxai 用户表**

- swarmxai 后端在用户登录后，根据租户 id 查 `tenant_dashclaw_keys` 表拿到对应的 DashClaw API key
- 通过 `postMessage` 注入到 iframe，让 iframe 内的 DashClaw 携带这个 key 调用自己的 API

iframe 父页面（swarmxai 侧）：
```vue
<script setup>
import { onMounted } from 'vue';
import { useUserStore } from '@/store/user';

const user = useUserStore();
const iframeRef = ref<HTMLIFrameElement>();

onMounted(() => {
  iframeRef.value!.addEventListener('load', () => {
    iframeRef.value!.contentWindow!.postMessage({
      type: 'swarmxai.auth',
      apiKey: user.dashclawApiKey,        // 由后端在 fetchUserInfo 时返回
      orgId: `org_swarmxai_t${user.tenantId}`,
      userName: user.nickname,
    }, '*');
  });
});
</script>
```

iframe 内（DashClaw 侧，本仓库 + 一处微改）：
- 在 `app/lib/embed-bridge.ts`（新增）里监听 `message`，把 swarmxai 注入的 API key 写入 `localStorage`，DashClaw 现有的 API client 已经从 localStorage 读 key
- URL 用 `?embed=swarmxai` 标记环境，UI 适当隐藏顶部 nav（通过 CSS class 控制）

**方案 A.SSO.2（更隐秘）：iframe 同源 + Cookie 共享**

把 DashClaw 部署在 swarmxai 的子域（例：`dashclaw.swarmxai.local`），swarmxai_backend 在登录时下发的 cookie 带 `Domain=.swarmxai.local`，DashClaw 后端添加一个端点 `/api/auth/exchange-jwt` 用 swarmxai JWT 换取 DashClaw session。需要 DashClaw 改一处中间件。

**推荐**：先用 A.SSO.1（零改动 DashClaw 后端），后期演进到 A.SSO.2。

#### A.4 网关 / 反代

如果 swarmxai 全部走 nginx 网关，nginx 配置加：

```nginx
location /dashclaw-app/ {
  # 内部转发到 DashClaw 容器，子路径剥离
  proxy_pass http://dashclaw-container:3310/;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  # 解决 iframe X-Frame-Options
  proxy_hide_header X-Frame-Options;
  add_header Content-Security-Policy "frame-ancestors 'self' https://swarmxai.local";
}
```

DashClaw 自己也要把 `next.config.js` 的 `headers()` 中 `X-Frame-Options` 改成 `SAMEORIGIN` 或 ALLOW-FROM swarmxai 域。

### 2.3 工作量估算

| 工作 | 人天 |
|---|---|
| 前端路由 + i18n + 菜单图标 | 0.5 |
| 后端 SQL 菜单数据 + 部署脚本 | 0.5 |
| `tenant_dashclaw_keys` 表 + 用户信息接口扩展 | 1.0 |
| postMessage SSO 桥（DashClaw 侧改 1 处） | 0.5 |
| nginx + X-Frame-Options 调试 | 0.5 |
| 联调 + 文档 | 1.0 |
| **合计** | **4 人天** |

### 2.4 优缺点

✅ DashClaw 几乎零改动（仅一处 embed 桥）
✅ 后续 DashClaw 升级独立，不污染 swarmxai 主仓库
✅ Postgres 独立，不挤占 swarmxai 的 MySQL/Redis
✅ 多租户语义保留（`org_swarmxai_t<tid>` 命名空间）

❌ 跨域 + iframe 体验略割裂（双滚动条、字体不统一）
❌ swarmxai 全局搜索 / 通知 / 主题切换不会传到 DashClaw 内
❌ DashClaw 的 API 在 swarmxai 后端层面是黑盒，无法做联合审计

---

## 3. 方案 B：iframe + 后端代理 + 统一治理总线（演进）

在方案 A 基础上做两个升级：

### 3.1 swarmxai 后端新增 `iplatform-module-dashclaw`

按 swarmxai-extension-modules 的标准模式新建 Maven 子模块，作为**反向代理 + 数据投影**，**不复刻 DashClaw 业务逻辑**：

```
iplatform-module-dashclaw/
├── pom.xml
├── iplatform-module-dashclaw-api/      # DTO + 接口
└── iplatform-module-dashclaw-biz/
    └── src/main/java/.../service/
        ├── DashClawClient.java          # 调 DashClaw HTTP API（带租户级 API key）
        ├── DashClawProxyController.java # /admin-api/dashclaw/** → 透传到 DashClaw
        ├── DashClawSyncJob.java         # 定时拉 /api/agents、/api/decisions 投影到 ClickHouse
        └── DashClawPolicyService.java   # 包装常用治理动作（创建策略、审批通过）
```

**意义**：
- swarmxai 的统一审计日志能看到 DashClaw 决策（投影到 `dashclaw_decisions` ClickHouse 表）
- swarmxai 的报表系统（`iplatform-module-report`）能联表查询治理数据
- swarmxai 的工作流（`iplatform-module-bpm`）能调 DashClawPolicyService 做"BPM 节点完成 → 触发 DashClaw 策略评估"

### 3.2 前端从 IFrameView 升级为部分原生 Vue 组件

**只挑高频、UI 简单的页面用 Vue 重写**，其它仍走 iframe：

| DashClaw 页面 | 升级策略 |
|---|---|
| `/agents`（列表） | Vue 重写 — 调 `/admin-api/dashclaw/agents` |
| `/decisions`（决策流） | Vue 重写 — 调 `/admin-api/dashclaw/decisions` |
| `/api-keys`（key 管理） | Vue 重写 — 集成 swarmxai 租户体系 |
| `/mission-control`（仪表盘） | iframe（图表多、复刻成本高） |
| `/workflows`（工作流编辑器） | iframe（编辑器复杂） |
| `/connect`（通道接入向导） | iframe |
| `/livingcode`（活的代码地图） | iframe |

### 3.3 工作量估算

约 2–4 周，取决于 Vue 重写哪几个页面。

---

## 4. 方案 C：完整 Vue 重写 + Java 后端复刻

**结论：不推荐**。

### 4.1 工作量

- 前端 60+ React 页面 → Vue 3：每页平均 2 人天起，共 **120+ 人天**
- 71 个 React 组件重写：30 人天
- Next.js App Router 的 RSC / Server Actions / streaming SSE 没有 Vue 等价物 — 需要重新设计数据流
- 后端 80 个 SDK 方法 + 50+ Drizzle 迁移 → Java + MyBatis：**60+ 人天**
- Drizzle schema → MySQL（DashClaw 当前在 Postgres 上有大量 jsonb / 数组类型，MySQL 用 JSON 字段勉强支持但语义不全等价）：10 人天
- DashClaw 的 SSE / 流式审批、ApprovalDeniedError、GuardBlockedError 这套客户端语义要在 Java 重新实现：10 人天

### 4.2 风险

- **DashClaw 仍在快速演进**（platform 2.13.3、SDK 2.11.1，最近一周还在提交）。复刻就意味着永远在追上游。
- **Drizzle → MyBatis 的 schema 等价性**很难保证，PG-only 特性（`jsonb_path_query`、`generated columns`）落到 MySQL 后会引入隐藏 bug。
- **第三方插件生态会断**：DashClaw 的 OpenClaw / opencode / Hermes 三个 adapter 都是直接调 DashClaw HTTP API，复刻后这些 adapter 必须改成调 swarmxai Java API，等于推翻了适配器协议（详见 `docs/architecture/multi-agent-adapter.md`）。
- **维护成本翻倍**：之后 DashClaw 升级要在两个仓库同步。

### 4.3 仅在以下情况考虑

- 监管要求所有审计数据落到 swarmxai 主库
- 公司战略要求"一个登录、一个数据库"
- DashClaw 不再独立演进，归并入 swarmxai

短期看这些条件都不成立，所以推荐保留 DashClaw 独立。

---

## 5. 关键决策点（请用户确认）

完成方案 A 之前需要确认：

| # | 决策点 | 选项 |
|---|---|---|
| 1 | DashClaw 部署位置 | A. swarmxai 子域（`dashclaw.swarmxai.local`） · B. swarmxai nginx 反代 `/dashclaw-app/` · C. 完全独立域名 |
| 2 | 多租户语义 | A. 一个 swarmxai 租户对应一个 DashClaw `org_id` · B. 全部 swarmxai 用户共用一个 DashClaw org |
| 3 | API key 管理 | A. swarmxai 后端代管，存 `tenant_dashclaw_keys` · B. 用户在 swarmxai UI 自助配置 |
| 4 | 嵌入哪些页面 | 默认建议：mission-control / decisions / setup / connect / agents · 是否还要 workflows、capabilities、policies？|
| 5 | 是否也加方案 B 的后端代理模块 | 推荐先做 A，后续再加 B；B 仅在需要联合审计/报表时启用 |

---

## 6. 相关文档

- DashClaw 治理循环：[`docs/architecture/runtime-api.md`](../architecture/runtime-api.md)
- 多 agent 适配协议：[`docs/architecture/multi-agent-adapter.md`](../architecture/multi-agent-adapter.md)
- Hermes 集成：[`hermes.md`](./hermes.md)
- opencode 集成：[`opencode.md`](./opencode.md)
- swarmxai 平台代码（**只读引用，不改其代码**）：
  - 路由动态加载：`apps/web-antd/src/router/routes/index.ts:7-16`
  - IFrameView 注册：`apps/web-antd/src/layouts/index.ts:4`
  - i18n 入口：`apps/web-antd/src/locales/index.ts`
  - JWT 安全配置：`iplatform-framework/iplatform-spring-boot-starter-security/.../IplatformWebSecurityConfigurerAdapter.java`
  - API 前缀环境变量：`apps/web-antd/.env`
