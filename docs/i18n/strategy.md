# DashClaw 国际化（i18n）策略

**状态：草案 v1（2026-05-07）**

DashClaw 前端目前**没有国际化框架**，全部文案为英文硬编码。本文给出现状评估、方案对比、推荐路径。**动手翻译之前必须先选定一个方案**——i18n 的成本几乎全部来自首次铺设，事后变更代价高。

---

## 1. 现状

### 1.1 数据

| 项 | 数量 |
|---|---|
| `app/**/page.js` 页面文件 | 62 |
| 组件文件（含 `_components/`、`components/`） | 71 |
| 前端代码总行数（仅 `page.js`） | ~25,654 |
| 已安装的 i18n 依赖 | **0**（package.json 未引入 `next-intl`、`react-i18next`、`i18next`、`@formatjs/*`） |
| 现有的 `messages/`、`locales/`、`public/locales/` 目录 | 不存在（`app/messages/` 是业务 messaging 模块，跟 i18n 无关） |

### 1.2 文案分布特征（抽样阅读）

- 英文硬编码在 JSX 中：`<h1>Mission Control</h1>`、`Risk Score`、`Block`、`Decisions`
- 提示文案以模板字符串穿插：`` `${count} pending approvals` ``
- 后端返回的 reason / signal 也是英文（`policy block reason: "Production access denied"`）
- 文档（`/docs` 页面 2165 行）大量英文 markdown
- Toast / 错误信息分散在 fetch handler 里
- 部分组件用 emoji 替代文字（不影响 i18n）

### 1.3 后端文案

后端 `/api/guard` 返回的 `reason`、`signals`、错误信息也是英文，且会回显到 UI。**真正中文化必须前后端一起做**，否则 UI 中文 + 错误信息英文是糟糕的体验。

---

## 2. 方案对比

| 方案 | 工作量 | 翻译覆盖 | 可维护性 | 推荐度 |
|---|---|---|---|---|
| **A. 完整 next-intl + 全量翻译** | 120+ 人天 | 全部 UI + 后端 reason | ⭐⭐⭐⭐⭐ | 长期 |
| **B. next-intl + 关键页面翻译** | 25–35 人天 | 5–8 个高频页面 | ⭐⭐⭐⭐ | **推荐先做** |
| **C. SSR 拦截层自动翻译（LLM）** | 5–8 人天 | 静态文案近似覆盖 | ⭐⭐ | 不推荐 |
| **D. 浏览器扩展/系统级翻译** | 0 人天 | 用户自助 | ⭐ | 仅作过渡 |
| **E. 仅翻译 swarmxai 嵌入用的 4 个页面** | 8–12 人天 | 4 个页面 | ⭐⭐⭐⭐ | 与 swarmxai 集成同步做 |

---

## 3. 方案 B：next-intl + 关键页面翻译（推荐先做）

### 3.1 涉及范围

只翻译以下 5–8 个高频页面，**其它页面保留英文，按需逐个增量改造**：

| 页面 | 优先级 | 行数 |
|---|---|---|
| `/`（首页） | 高 | 934 |
| `/mission-control` | 高 | 589 |
| `/decisions` | 高 | 679 |
| `/setup` | 高 | （待数） |
| `/connect` | 高 | （待数） |
| `/agents` | 中 | （待数） |
| `/my-agent` | 中 | （待数） |
| 共享 layout / nav / footer | 高 | — |

### 3.2 技术栈

- **`next-intl` v3** — Next.js App Router 官方推荐的 i18n 库
- 路由策略：`/en/...` 和 `/zh/...` 双前缀，默认 `en`，根路径走 middleware 重定向
- 文案存储：`messages/en.json` + `messages/zh-CN.json`
- 服务端翻译：`getTranslations()` 用于 RSC
- 客户端翻译：`useTranslations()` 用于 client component

### 3.3 改造步骤

#### B.1 安装与基线配置

```bash
pnpm add next-intl
```

`middleware.js` 顶部插入 next-intl 的 locale 检测（与现有 middleware 合并）：

```js
import createIntlMiddleware from 'next-intl/middleware';

const intl = createIntlMiddleware({
  locales: ['en', 'zh-CN'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',  // /zh-CN/... 显式带前缀，/... 默认 en
});

export default function middleware(req) {
  // ... 现有的 API key resolution、CORS、auth 逻辑
  if (req.nextUrl.pathname.startsWith('/api/')) return next();
  return intl.handleRequest ? intl.handleRequest(req) : intl(req);
}
```

`app/[locale]/layout.js`（把现有 `app/layout.js` 的内容下沉到 `[locale]` 段）：

```js
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export default async function LocaleLayout({ children, params: { locale } }) {
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages} locale={locale}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

#### B.2 文案抽取

每个目标页面执行：

```jsx
// 改造前
<h1>Mission Control</h1>
<button>Approve</button>

// 改造后（client component）
const t = useTranslations('missionControl');
<h1>{t('title')}</h1>
<button>{t('approve')}</button>
```

`messages/en.json`：
```json
{
  "missionControl": {
    "title": "Mission Control",
    "approve": "Approve"
  }
}
```

`messages/zh-CN.json`：
```json
{
  "missionControl": {
    "title": "决策中心",
    "approve": "批准"
  }
}
```

#### B.3 后端 reason 国际化

后端文案有两条路径：

1. **静态 reason**（policy 内置）：把 reason 改成 message key，前端用 t(reasonKey) 渲染
2. **动态 reason**（policy reasoner 生成）：暂保留英文，前端做"display fallback"

最稳的做法是后端只回 `reason_code: "policy.production.deny"`（机器码），UI 在 messages 里查。需要 `app/lib/policy/reasons.js` 维护 code → 文案。

#### B.4 工作量分解

| 工作 | 人天 |
|---|---|
| next-intl 引入、layout 改造、middleware 合并 | 2 |
| 抽取共享 layout / nav / topbar 文案 | 1 |
| 5 个关键页面文案抽取（avg 2 天/页） | 10 |
| 翻译（前端 + 后端 reason，~800 条 string） | 4 |
| 后端 reason_code 表 + API 改造 | 4 |
| QA + 视觉回归（中文比英文长 30–40%，UI 适配） | 3 |
| 文档（i18n 维护规约、新增页面 checklist） | 1 |
| **合计** | **25 人天** |

### 3.4 验收标准

- [ ] `?lang=zh-CN` cookie 或 `/zh-CN/` 路由能让 5 个目标页面全部中文渲染
- [ ] 切换语言后所有动态 toast、错误提示也跟随
- [ ] 中文最长字符串不超出布局（容器无横向溢出）
- [ ] CI 加 lint 规则：禁止新代码在 JSX 文本节点直接写 `[A-Z][a-z]+ [a-z]+`（粗略英文检测）
- [ ] 维护文档：新增页面必须按 i18n checklist 走

---

## 4. 方案 E：仅翻译 swarmxai 嵌入用的 4 个页面（短期可行）

如果 swarmxai 集成方案 A（iframe 嵌入）先上，那 i18n 的最小集合就是被嵌入的 4 个页面：

| 页面 | iframe 入口 |
|---|---|
| `/mission-control` | swarmxai 菜单"决策中心" |
| `/decisions` | swarmxai 菜单"决策台账" |
| `/setup` | swarmxai 菜单"接入配置" |
| `/connect` | swarmxai 菜单"通道接入" |

工作量：方案 B 工作量打 5 折 ≈ **8–12 人天**。其它页面用户在 swarmxai 里看不到，可以暂不动。

**这是最经济的起步路径**：和方案 A（swarmxai 集成）合并交付，4 周内可上线一个完整的中文治理体验。

---

## 5. 方案 C / D：不推荐，仅作背景

### C. SSR 拦截层自动翻译

在 Next.js middleware 里拦截 HTML 响应，用 LLM（Claude Haiku 4.5）实时翻译成中文。

**问题**：
- 翻译质量不稳定，"Action" 可能翻译成"行动"也可能"动作"，**前后不一致**
- 动态内容（API 数据中的 reason）翻译会破坏机器可读性（前端期望英文枚举值）
- LLM 调用成本：单页平均 1k tokens × 用户量 → 月 $$$
- 无法本地化数据格式（日期、数字）

**仅在以下场景考虑**：试运行阶段，"先让中文用户能用起来"，承担质量妥协。

### D. 浏览器扩展级翻译（Chrome Translate）

用户点右上角"翻译此页"。

**问题**：
- 输入框、按钮 label、aria-label 都会被翻译，破坏交互
- 翻译质量逐句独立，上下文丢失
- 无法做品牌词控制（"DashClaw"、"OpenClaw"、"Hermes" 这些专名要保留）

**作用**：作为方案 B/E 落地前的过渡，告知用户"内置中文支持开发中，请先使用浏览器翻译"。

---

## 6. 推荐路径

```
现在            1 个月             3 个月              6 个月
 │                │                  │                   │
 ├─ 方案 D 公告  ─┤                  │                   │
 │  (浏览器翻译)                     │                   │
 │                                   │                   │
 │   方案 E (swarmxai 嵌入 4 页)    │                   │
 │   + swarmxai 集成方案 A 同步上线 │                   │
 │   ───────────────────────────────┤                   │
 │                                                       │
 │       方案 B 扩展到 8 页 + 后端 reason_code 体系     │
 │       ──────────────────────────────────────────────┤
 │                                                       │
 │            方案 A 全量翻译（按页增量推进）            │
 │            ──────────────────────────────────────►   │
```

---

## 7. 待用户确认的决策点

| # | 决策 | 候选 |
|---|---|---|
| 1 | 选哪个方案起步 | A. 完整 next-intl 全量 · B. next-intl 关键页面 · **E. 仅 swarmxai 嵌入页（推荐）** |
| 2 | 路由策略 | A. `/zh-CN/...` 路径前缀 · B. `?lang=zh-CN` 查询参数 · C. cookie + Accept-Language 协商 |
| 3 | 是否同步翻译后端 reason | A. 是，用 reason_code 表 · B. 否，前端做兜底翻译表 · C. 暂保留英文 reason |
| 4 | 是否引入 i18n lint | A. 是，加自定义 ESLint 规则 · B. 否，仅靠 review |
| 5 | DashClaw 文档（`/docs` 页面 2165 行）是否翻译 | A. 是（额外 5 人天） · B. 不翻译 · C. 用 LLM 一次性生成 zh 副本，人工 spot-check |

请用户在以上 5 个决策点上各选一项，再正式启动。

---

## 8. 现在能做的不需要决策的小事

不论最终选哪个方案，下面 3 件事都是无害的"i18n 准备"，可以现在做（**本次提交不做，仅记录**）：

1. **统一品牌词**：DashClaw、OpenClaw、OpenCode（小写 c）、Hermes 在所有文案里大小写一致
2. **抽取常量**：把 hard-coded 的 status/decision 标签 `'allow' | 'block' | 'require_approval'` 改成 `lib/labels.js` 集中管理（为之后 i18n key 映射做准备）
3. **加 i18n 友好的占位符**：把 ` ${count} pending approvals` 改成 `${count} pending approvals` 已经够格式化了；但 `ICU MessageFormat` 的 plural（`{count, plural, one {# approval} other {# approvals}}`）需要重写

这些是"零依赖、纯重构"的准备工作，不引入任何运行时变化。
