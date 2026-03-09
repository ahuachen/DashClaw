import { useState } from "react";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, Radar } from "recharts";

// ── Embedded analysis data ──────────────────────────────────
const ANALYSIS = {
  name: "DashClaw Platform",
  version: "2.3.2",
  health: 79,
  healthLabel: "HEALTHY",
  lastAnalyzed: "March 2026",
  summary: "AI agent decision infrastructure. Next.js 15 App Router platform providing governance, observability, and accountability for AI agent fleets. Ships as a single codebase serving both a public demo (dashclaw.io) and self-hosted deployments.",
  languages: [
    { name: "JavaScript", pct: 82, color: "#F97316" },
    { name: "Python", pct: 11, color: "#22D3EE" },
    { name: "Markdown", pct: 5, color: "#6366F1" },
    { name: "Other", pct: 2, color: "#475569" },
  ],
  debtCategories: [
    { name: "Code Hygiene", score: 17, max: 25 },
    { name: "Security", score: 24, max: 25 },
    { name: "Documentation", score: 20, max: 20 },
    { name: "Dependency Health", score: 13, max: 15 },
    { name: "Structural Clarity", score: 15, max: 15 },
  ],
  structure: [
    { name: "app/", desc: "Next.js App Router — 30+ pages, 50+ API dirs, shared libs" },
    { name: "app/lib/", desc: "Core platform logic: guard, signals, DLP, LLM, webhooks, encryption" },
    { name: "app/lib/repositories/", desc: "22 repository files — all SQL lives here, enforced by CI" },
    { name: "sdk/", desc: "Node.js SDK (npm: dashclaw, 178+ methods, zero deps, ESM+CJS)" },
    { name: "sdk-python/", desc: "Python SDK (PyPI: dashclaw, urllib only, zero deps)" },
    { name: "scripts/", desc: "50+ migration + CI guard + integration test scripts" },
    { name: "agent-tools/", desc: "Python CLI suite for local agent memory, context, and security" },
    { name: "docs/", desc: "RFCs, runbooks, SDK parity matrix, OIDC setup guide" },
    { name: ".claude/skills/", desc: "Claude Code skill for platform-level operations and diagnostics" },
    { name: "middleware.js", desc: "⚠️ 1,100+ line edge layer — auth, rate limiting, CORS, demo proxy" },
  ],
  findings: [
    { id: 1, severity: "HIGH", title: "middleware.js is 1,100+ lines doing five jobs", file: "middleware.js", detail: "Handles auth, rate limiting, CORS, demo fixture proxy, and org resolution. Demo helper functions alone account for ~600 lines. Any bug here takes down the platform. Needs to be split into focused modules." },
    { id: 2, severity: "HIGH", title: "No TypeScript on a security-sensitive multi-tenant API", file: "entire codebase", detail: "50+ API route directories with no static type checks. Org ID injection bugs and API contract drift are caught at runtime. Migration should start with app/lib/ core modules." },
    { id: 3, severity: "MEDIUM", title: "In-memory rate limiter is instance-local on serverless", file: "middleware.js", detail: "Each serverless instance has its own rate limit counter. Distributed attackers can bypass per-IP limits across instances. Optional Upstash integration exists but is not the default." },
    { id: 4, severity: "MEDIUM", title: "xlsx v0.18.5 carries a known supply-chain advisory", file: "package.json", detail: "SheetJS community edition has had licensing and security issues. Usage appears limited — evaluate exceljs as a low-effort drop-in replacement." },
    { id: 5, severity: "LOW", title: "next-auth v4 migration debt will compound over time", file: "app/lib/auth.js", detail: "Auth.js (v5) is a significantly different API. Security patches flow to v4 for now, but migration difficulty increases the longer it is deferred." },
  ],
  dependencies: [
    { name: "next", version: "15.5.12", status: "current" },
    { name: "react", version: "^18", status: "current" },
    { name: "next-auth", version: "^4.24.13", status: "aging" },
    { name: "drizzle-orm", version: "^0.45.1", status: "current" },
    { name: "@neondatabase/serverless", version: "^1.0.2", status: "current" },
    { name: "zod", version: "^4.3.6", status: "current" },
    { name: "recharts", version: "^3.7.0", status: "current" },
    { name: "redis", version: "^4.7.1", status: "current" },
    { name: "stripe", version: "^20.3.1", status: "current" },
    { name: "xlsx", version: "^0.18.5", status: "advisory" },
    { name: "openai", version: "^6.22.0", status: "current" },
    { name: "lucide-react", version: "^0.575.0", status: "current" },
  ],
  radarData: [
    { subject: "Code Hygiene", score: 68 },
    { subject: "Security", score: 96 },
    { subject: "Documentation", score: 100 },
    { subject: "Dependencies", score: 87 },
    { subject: "Structure", score: 100 },
  ],
};

// ── Color helpers ──────────────────────────────────────────
const C = {
  bg: "#0D1117",
  card: "#161B22",
  card2: "#1C2330",
  border: "#1E293B",
  orange: "#F97316",
  blue: "#6366F1",
  teal: "#22D3EE",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  white: "#F8FAFC",
  muted: "#94A3B8",
};

const SEV_COLOR = { HIGH: C.red, MEDIUM: C.amber, LOW: C.teal };
const STATUS_COLOR = { current: C.green, aging: C.amber, advisory: C.red };
const STATUS_BG = { current: "#052e16", aging: "#451a03", advisory: "#450a0a" };

function healthColor(score) {
  if (score >= 80) return C.green;
  if (score >= 60) return C.amber;
  return C.red;
}

// ── Components ─────────────────────────────────────────────
function Card({ children, style = {} }) {
  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, padding: "16px", ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: C.orange, letterSpacing: 3, marginBottom: 12, textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function Badge({ label, color, bg }) {
  return (
    <span style={{ background: bg || color + "22", color, border: `1px solid ${color}`, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700, letterSpacing: 1 }}>
      {label}
    </span>
  );
}

function ScoreRing({ score }) {
  const color = healthColor(score);
  const r = 52, cx = 68, cy = 68;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - score / 100);
  return (
    <svg width={136} height={136}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.border} strokeWidth={10} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={10}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy - 8} textAnchor="middle" fill={color} fontSize={32} fontWeight="bold">{score}</text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill={C.muted} fontSize={11}>out of 100</text>
      <text x={cx} y={cy + 32} textAnchor="middle" fill={color} fontSize={11} fontWeight="bold" letterSpacing={2}>HEALTHY</text>
    </svg>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px" }}>
      <div style={{ color: C.muted, fontSize: 11 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.white, fontSize: 13, fontWeight: 700 }}>{p.value}{p.name === "pct" ? "%" : `/${p.payload.max}`}</div>
      ))}
    </div>
  );
}

// ── Main App ────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedFinding, setExpandedFinding] = useState(null);

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "architecture", label: "Architecture" },
    { id: "debt", label: "Tech Debt" },
    { id: "findings", label: "Findings" },
    { id: "dependencies", label: "Dependencies" },
  ];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter', 'Segoe UI', sans-serif", color: C.white }}>
      {/* Header */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}`, padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ background: C.orange, borderRadius: 6, padding: "4px 10px", fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>
              DC
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>DashClaw</div>
              <div style={{ color: C.muted, fontSize: 11 }}>Codebase Intelligence Report</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge label="v2.3.2" color={C.blue} />
            <Badge label={`${ANALYSIS.health}/100`} color={healthColor(ANALYSIS.health)} />
            <Badge label="HEALTHY" color={C.green} />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: C.card, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", gap: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{
                background: "transparent", border: "none", padding: "12px 20px",
                color: activeTab === t.id ? C.orange : C.muted,
                borderBottom: activeTab === t.id ? `2px solid ${C.orange}` : "2px solid transparent",
                cursor: "pointer", fontSize: 13, fontWeight: activeTab === t.id ? 700 : 400,
                transition: "all 0.15s"
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 24px" }}>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
              {/* Health ring */}
              <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "24px 16px" }}>
                <SectionTitle>Health Score</SectionTitle>
                <ScoreRing score={ANALYSIS.health} />
              </Card>
              {/* Summary */}
              <Card style={{ gridColumn: "span 2" }}>
                <SectionTitle>Project Summary</SectionTitle>
                <div style={{ fontSize: 14, lineHeight: 1.7, color: C.white, marginBottom: 16 }}>{ANALYSIS.summary}</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {[
                    { label: "Framework", val: "Next.js 15 App Router" },
                    { label: "Language", val: "JavaScript (no TypeScript)" },
                    { label: "API Routes", val: "50+ directories" },
                    { label: "SDK Methods", val: "178+ (Node + Python)" },
                    { label: "Auth", val: "NextAuth v4 + API Keys" },
                    { label: "Database", val: "Neon Postgres + Docker" },
                  ].map(({ label, val }) => (
                    <div key={label} style={{ background: C.card2, borderRadius: 6, padding: "10px 14px" }}>
                      <div style={{ color: C.muted, fontSize: 10, marginBottom: 3 }}>{label}</div>
                      <div style={{ color: C.white, fontSize: 13, fontWeight: 600 }}>{val}</div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Language + Radar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Card>
                <SectionTitle>Language Breakdown</SectionTitle>
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <PieChart width={160} height={160}>
                    <Pie data={ANALYSIS.languages} dataKey="pct" cx={75} cy={75} innerRadius={45} outerRadius={72} paddingAngle={3}>
                      {ANALYSIS.languages.map((l, i) => <Cell key={i} fill={l.color} />)}
                    </Pie>
                  </PieChart>
                  <div style={{ flex: 1 }}>
                    {ANALYSIS.languages.map(l => (
                      <div key={l.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: l.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, color: C.white, fontSize: 13 }}>{l.name}</div>
                        <div style={{ color: l.color, fontWeight: 700, fontSize: 13 }}>{l.pct}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
              <Card>
                <SectionTitle>Health Radar</SectionTitle>
                <RadarChart width={300} height={200} data={ANALYSIS.radarData} cx={150} cy={100}>
                  <PolarGrid stroke={C.border} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: C.muted, fontSize: 10 }} />
                  <Radar name="Score" dataKey="score" stroke={C.orange} fill={C.orange} fillOpacity={0.25} />
                </RadarChart>
              </Card>
            </div>
          </div>
        )}

        {/* ── ARCHITECTURE ── */}
        {activeTab === "architecture" && (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <SectionTitle>System Layers</SectionTitle>
              {[
                { label: "CLIENTS", color: C.teal, items: ["Node.js SDK (npm: dashclaw)", "Python SDK (PyPI: dashclaw)", "Browser (NextAuth cookie)", "agent-tools/ Python CLI"] },
                { label: "EDGE — middleware.js", color: C.orange, items: ["API Key Auth + Rate Limiting", "CORS + x-org-id header injection", "Demo Fixture Proxy (DASHCLAW_MODE=demo)", "Body Size Limits + IP Detection"] },
                { label: "APP LAYER — Next.js 15", color: C.blue, items: ["50+ API Route Dirs · 30+ UI Pages", "22 Repository Files (all SQL here)", "guard · signals · DLP · eval · LLM · webhooks", "SSE Broker: Redis Streams or in-memory"] },
                { label: "DATA LAYER", color: C.green, items: ["Neon Postgres (serverless)", "Local Postgres via Docker (TCP)", "Redis / Upstash (SSE, rate limiting)", "AES-256-GCM for secrets at rest"] },
              ].map((layer, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 4, height: 20, background: layer.color, borderRadius: 2 }} />
                    <span style={{ color: layer.color, fontWeight: 700, fontSize: 12, letterSpacing: 1 }}>{layer.label}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginLeft: 12 }}>
                    {layer.items.map((item, j) => (
                      <div key={j} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 12px", fontSize: 12, color: C.white }}>
                        {item}
                      </div>
                    ))}
                  </div>
                  {i < 3 && <div style={{ display: "flex", justifyContent: "center", marginTop: 6 }}><span style={{ color: C.dim, fontSize: 16 }}>↓</span></div>}
                </div>
              ))}
            </Card>

            <Card>
              <SectionTitle>Directory Map</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {ANALYSIS.structure.map(d => (
                  <div key={d.name} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 14px" }}>
                    <div style={{ fontFamily: "monospace", fontSize: 12, color: C.teal, marginBottom: 4 }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{d.desc}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* ── TECH DEBT ── */}
        {activeTab === "debt" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16, marginBottom: 16 }}>
              <Card style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px" }}>
                <SectionTitle>Overall Score</SectionTitle>
                <ScoreRing score={ANALYSIS.health} />
                <div style={{ marginTop: 12, color: C.muted, fontSize: 12, textAlign: "center", lineHeight: 1.6 }}>
                  Well-engineered for its maturity. Security is exceptional. Primary debt is structural.
                </div>
              </Card>
              <Card>
                <SectionTitle>Category Breakdown</SectionTitle>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ANALYSIS.debtCategories} layout="vertical" margin={{ left: 10, right: 24 }}>
                    <XAxis type="number" domain={[0, 25]} tick={{ fill: C.muted, fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: C.muted, fontSize: 11 }} width={120} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="score" name="score" radius={[0, 3, 3, 0]}>
                      {ANALYSIS.debtCategories.map((d, i) => (
                        <Cell key={i} fill={d.score / d.max >= 0.9 ? C.green : d.score / d.max >= 0.7 ? C.amber : C.red} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <Card>
                <SectionTitle>What's Working Well</SectionTitle>
                {[
                  "Security hardening is exceptional — 4 CRITICAL and 9 HIGH findings resolved in Feb 2026",
                  "Repository pattern consistently applied; CI blocks direct SQL in route handlers",
                  "Documentation suite is best-in-class: PROJECT_DETAILS.md, CHANGELOG, CONTRIBUTING.md",
                  "SDK parity matrix and CI gate prevent Node/Python SDK divergence",
                  "CI guard scripts catch specific regression categories automatically",
                ].map((item, i) => (
                  <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                    <div style={{ color: C.green, fontSize: 16, flexShrink: 0, marginTop: 1 }}>✓</div>
                    <div style={{ fontSize: 13, color: C.white, lineHeight: 1.5 }}>{item}</div>
                  </div>
                ))}
              </Card>
              <Card>
                <SectionTitle>Priority Sprint</SectionTitle>
                {[
                  { n: "01", task: "Extract demo fixture logic from middleware.js", effort: "1–2 days", c: C.green },
                  { n: "02", task: "Add TypeScript to app/lib/ core modules", effort: "1–2 weeks", c: C.amber },
                  { n: "03", task: "Replace xlsx with exceljs", effort: "< 1 day", c: C.green },
                  { n: "04", task: "Make Upstash the production-default", effort: "2–4 hours", c: C.green },
                  { n: "05", task: "Add prompt template regression test suite", effort: "4–8 hours", c: C.green },
                ].map(item => (
                  <div key={item.n} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "center" }}>
                    <div style={{ color: C.orange, fontWeight: 700, fontSize: 12, width: 24, flexShrink: 0 }}>{item.n}</div>
                    <div style={{ flex: 1, fontSize: 13, color: C.white }}>{item.task}</div>
                    <div style={{ background: item.c + "22", color: item.c, border: `1px solid ${item.c}`, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{item.effort}</div>
                  </div>
                ))}
              </Card>
            </div>
          </div>
        )}

        {/* ── FINDINGS ── */}
        {activeTab === "findings" && (
          <div>
            <div style={{ marginBottom: 12, display: "flex", gap: 10 }}>
              {["HIGH", "MEDIUM", "LOW"].map(sev => {
                const count = ANALYSIS.findings.filter(f => f.severity === sev).length;
                return (
                  <div key={sev} style={{ background: SEV_COLOR[sev] + "22", border: `1px solid ${SEV_COLOR[sev]}`, borderRadius: 6, padding: "8px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: SEV_COLOR[sev], fontWeight: 700, fontSize: 18 }}>{count}</span>
                    <span style={{ color: SEV_COLOR[sev], fontSize: 11, fontWeight: 700, letterSpacing: 1 }}>{sev}</span>
                  </div>
                );
              })}
            </div>

            {ANALYSIS.findings.map(f => (
              <Card key={f.id} style={{ marginBottom: 12, cursor: "pointer", borderColor: expandedFinding === f.id ? SEV_COLOR[f.severity] : C.border }}
                onClick={() => setExpandedFinding(expandedFinding === f.id ? null : f.id)}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Badge label={f.severity} color={SEV_COLOR[f.severity]} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: C.white }}>{f.title}</div>
                    <div style={{ color: C.muted, fontSize: 11, fontFamily: "monospace", marginTop: 2 }}>{f.file}</div>
                  </div>
                  <div style={{ color: C.muted, fontSize: 16 }}>{expandedFinding === f.id ? "▲" : "▼"}</div>
                </div>
                {expandedFinding === f.id && (
                  <div style={{ marginTop: 12, padding: "12px 16px", background: C.card2, borderRadius: 6, fontSize: 13, color: C.white, lineHeight: 1.7 }}>
                    {f.detail}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {/* ── DEPENDENCIES ── */}
        {activeTab === "dependencies" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
              {["current", "aging", "advisory"].map(status => {
                const count = ANALYSIS.dependencies.filter(d => d.status === status).length;
                const labels = { current: "Up to Date", aging: "Needs Attention", advisory: "Has Advisory" };
                return (
                  <div key={status} style={{ background: STATUS_BG[status], border: `1px solid ${STATUS_COLOR[status]}`, borderRadius: 8, padding: "12px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ color: STATUS_COLOR[status], fontWeight: 700, fontSize: 24 }}>{count}</span>
                    <span style={{ color: STATUS_COLOR[status], fontSize: 12, fontWeight: 700 }}>{labels[status]}</span>
                  </div>
                );
              })}
            </div>

            <Card>
              <SectionTitle>Dependency List</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {ANALYSIS.dependencies.map(d => (
                  <div key={d.name} style={{ background: C.card2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontFamily: "monospace", fontSize: 13, color: C.white, fontWeight: 600 }}>{d.name}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 11, color: C.muted, marginTop: 2 }}>{d.version}</div>
                    </div>
                    <Badge
                      label={d.status === "current" ? "✓ Current" : d.status === "aging" ? "⚠ Aging" : "⚠ Advisory"}
                      color={STATUS_COLOR[d.status]}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px 24px", marginTop: 32, textAlign: "center", color: C.dim, fontSize: 11 }}>
        Codebase Archaeologist · DashClaw v2.3.2 · Analyzed March 2026 · Built by Practical Systems
      </div>
    </div>
  );
}
