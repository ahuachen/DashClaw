# DashClaw Full Bootstrap — Agent Self-Service

> Paste this entire prompt to an agent that has the DashClaw SDK installed. The agent will scan its own workspace, build a sync payload, and push it — no operator intervention required.

---

## Your task

Your operator uses **DashClaw** to track your state. You need to do two things:

1. **Scan your own workspace** — read your files and extract structured data
2. **Push everything via `syncState()`** — one SDK call with the full payload

You already have the DashClaw SDK installed. Use it.

**Critical rules:**
- NEVER include secrets, API keys, passwords, or tokens in any field value
- When scanning `.env` files, only extract key NAMES, never values
- Be honest and specific — generic filler is useless
- Omit any category you have no real data for
- Truncate strings to the max lengths specified

---

## Part 1: Scan your workspace

Read the files listed below. Not all will exist — skip missing ones silently.

### 1a. Connections (from `.env` key names + `package.json` deps)

Read `.env`, `.env.local`, `.env.example`, and `package.json`. Extract only key NAMES to detect providers:

| Env key prefix | Provider | Auth type |
|---|---|---|
| `GITHUB_` | github | oauth |
| `GOOGLE_` | google | oauth |
| `OPENAI_` | openai | api_key |
| `ANTHROPIC_` | anthropic | api_key |
| `STRIPE_` | stripe | api_key |
| `AWS_` | aws | api_key |
| `DATABASE_URL` (contains "neon") | neon | api_key |
| `DATABASE_URL` (other) | postgresql | api_key |
| `RESEND_` | resend | api_key |
| `SLACK_` | slack | api_key |
| `VERCEL_` | vercel | api_key |
| `REDIS_` | redis | api_key |
| `SENTRY_` | sentry | api_key |
| `SUPABASE_` | supabase | api_key |

Also check `package.json` dependencies: `stripe`, `openai`, `@anthropic-ai/sdk`, `@neondatabase/serverless`, `redis`, `ioredis`, `@slack/web-api`, `discord.js`, `dashclaw`, etc.

**Output shape:**
```json
"connections": [{ "provider": "github", "auth_type": "oauth", "status": "active" }]
```

### 1b. Memory health (from file stats)

Scan your memory/workspace markdown files. Count total files, lines, and size. Extract entities (bold terms, backtick terms) and topics (## headings).

**Health score heuristic:** Start at 50. +15 if `MEMORY.md` exists. +10 if total lines > 100. +10 if > 5 markdown files. +10 if `memory/` directory exists. +5 if > 5 topics. Cap at 100.

**Output shape:**
```json
"memory": {
  "health": { "score": 75, "total_files": 8, "total_lines": 450, "total_size_kb": 12 },
  "entities": [{ "name": "NextAuth", "type": "code", "mentions": 5 }],
  "topics": [{ "name": "Architecture", "mentions": 2 }]
}
```
Max 100 entities, 100 topics.

### 1c. Goals (from task/project files)

Read `tasks/todo.md`, `TODO.md`, `projects.md`, `CLAUDE.md` (goal/todo sections), and `memory/pending-tasks.md`.

- `- [ ] text` → status `"active"`
- `- [x] text` → status `"completed"`, progress 100
- Bullet under "Goals"/"Next Steps" heading → status `"active"`

**Output shape:**
```json
"goals": [{ "title": "Deploy v2", "status": "active", "category": "project", "progress": 30 }]
```
Max 500 chars per title. Max 2000 goals.

### 1d. Learning (from lessons/decisions)

Read `tasks/lessons.md`, `memory/decisions/*.md`, and `CLAUDE.md` (lesson/pattern/convention sections).

- Bullet items from lessons files → decisions with outcome `"success"`, confidence 70
- Decision table rows (`| Decision | Why | Outcome |`) → parse each column

**Output shape:**
```json
"learning": [{ "decision": "Used JWT for edge compat", "reasoning": "NextAuth on Vercel Edge", "outcome": "success", "confidence": 75 }]
```
Max 2000 chars per decision. Max 2000 entries.

### 1e. Context points (from CLAUDE.md and MEMORY.md sections)

Each `## heading` section becomes a context point. Categorize:
- Architecture/tech stack sections → `"insight"`, importance 8
- Pattern/convention sections → `"insight"`, importance 7
- Decision/choice sections → `"decision"`, importance 7
- Command/deploy sections → `"general"`, importance 6
- Everything else → `"general"`, importance 5

**Output shape:**
```json
"context_points": [{ "content": "[Architecture] Next.js 16 App Router...", "category": "insight", "importance": 8 }]
```
Max 2000 chars per content. Max 5000 points.

### 1f. Context threads (from CLAUDE.md sections)

Each `## heading` with 3+ lines of body becomes a thread.

**Output shape:**
```json
"context_threads": [{ "name": "Authentication", "summary": "NextAuth v4 with GitHub + Google OAuth..." }]
```
Max 255 chars per name, 500 chars per summary. Max 1000 threads.

### 1g. Snippets (fenced code blocks from docs)

Scan `CLAUDE.md`, `TOOLS*.md`, `projects.md`, `MEMORY.md` for fenced code blocks (` ```lang ... ``` `). Skip blocks < 2 lines.

**Output shape:**
```json
"snippets": [{ "name": "api-route-pattern", "description": "From CLAUDE.md: API Handlers", "code": "...", "language": "javascript" }]
```
Max 10000 chars per code block. Max 1000 snippets.

### 1h. Handoffs (from daily log files)

Read daily log files matching `YYYY-MM-DD*.md` in `memory/` or `Memory/` directories. Each file = one handoff. Parse:
- Summary: first non-heading paragraph (max 4000 chars)
- `session_date`: from filename
- `key_decisions`: bullets under headings containing "decision"/"decided"/"chose"
- `open_tasks`: bullets under headings containing "todo"/"next"/"open"/"pending"
- `mood_notes`: text under headings containing "mood"/"energy"/"feeling"/"reflection"
- `next_priorities`: bullets under headings containing "priority"/"tomorrow"/"next session"

**Output shape:**
```json
"handoffs": [{
  "session_date": "2026-02-14",
  "summary": "Worked on auth system...",
  "key_decisions": ["Chose JWT over sessions"],
  "open_tasks": ["Add webhook handler"],
  "mood_notes": "Productive, high energy",
  "next_priorities": ["Finish billing"]
}]
```
Max 100 handoffs (most recent). Max 1000 allowed.

### 1i. Inspiration (from idea/bookmark files)

Read `inspiration.md`, `ideas.md`, `bookmarks.md`, `reading-list.md`, `references.md` at root or in `memory/`. Each bullet = one item.

- Extract URLs from text if present
- `[x]` prefix → status `"completed"`, otherwise `"pending"`
- Parent heading → category

**Output shape:**
```json
"inspiration": [{ "title": "Real-time WebSocket updates", "category": "features", "source": "https://...", "status": "pending" }]
```
Max 500 chars per title. Max 200 items.

### 1j. Preferences (from MEMORY.md, CLAUDE.md, tasks/lessons.md, daily logs)

**preferences**: bullets under "Active Preferences" heading in `MEMORY.md`
```json
{ "preference": "Always use TypeScript strict mode", "category": "technical", "confidence": 85 }
```

**observations**: bullets under headings containing "observation"/"noticed"/"pattern"
```json
{ "observation": "User prefers minimal commit messages", "category": "user", "importance": 7 }
```

**approaches**: bullets under headings containing "approach"/"strategy"/"technique"/"method"/"workflow"
```json
{ "approach": "Code-first prototyping", "context": "Feature development", "success": true }
```

**moods**: from daily logs, text under "mood"/"energy"/"feeling" headings
```json
{ "mood": "Focused and productive", "energy": "high", "notes": "Deep work session" }
```

**Output shape:**
```json
"preferences": {
  "preferences": [...],
  "observations": [...],
  "approaches": [...],
  "moods": [...]
}
```
Max 1000 per sub-category.

### 1k. Relationships (from people/relationship files)

Read `people/`, `relationships.json`, or individual `.md` files about people/contacts. Also use your own knowledge — who do you interact with?

**Output shape:**
```json
"relationships": [{ "name": "Alex", "relationship_type": "operator", "description": "Primary user, prefers concise output" }]
```
Max 255 chars per name. Max 1000.

---

## Part 2: Self-reported semantic data

After scanning files, add data the scanner can't extract — things you know from your operational context:

- **Relationships** you know about but aren't documented in files
- **Reasoning** behind decisions (the "why" behind lessons)
- **Observations** about your operator's preferences and work style
- **Your own communication preferences** and personality traits
- **Session handoffs** from recent memory (if no daily log files exist)
- **Context points** — architectural insights you carry but aren't written down

Add these to the same payload — they merge with the file-scanned data.

---

## Part 3: Push via SDK

You already have the DashClaw SDK. Initialize it and call `syncState()`:

### Node.js
```javascript
import { DashClaw } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'YOUR_AGENT_ID',  // Use your actual agent ID
});

const result = await claw.syncState(payload);
console.log(`Synced ${result.total_synced} items in ${result.duration_ms}ms`);
if (result.total_errors > 0) {
  console.error('Errors:', JSON.stringify(result.results, null, 2));
}
```

### Python
```python
from dashclaw import DashClaw

claw = DashClaw(
    base_url=os.environ.get("DASHCLAW_BASE_URL", "http://localhost:3000"),
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="YOUR_AGENT_ID",  # Use your actual agent ID
)

result = claw.sync_state(payload)
print(f"Synced {result['total_synced']} items in {result['duration_ms']}ms")
```

---

## Checklist before pushing

- [ ] No secrets, API keys, or passwords in any field
- [ ] All strings within max length limits
- [ ] agent_id matches your registered ID in DashClaw
- [ ] Omitted categories you have no data for (don't send empty arrays)
- [ ] File-scanned data and self-reported data merged into one payload
