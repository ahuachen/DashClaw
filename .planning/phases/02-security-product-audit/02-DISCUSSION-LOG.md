# Phase 2: Security & Product Audit - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 02-security-product-audit
**Areas discussed:** Fix vs. Report, Security Depth, Product Usefulness, Free-tier Scope

---

## Fix vs. Report

| Option | Description | Selected |
|--------|-------------|----------|
| Fix in-place | Find issue → fix it → commit. Audit produces working code, not a document. | ✓ |
| Report then fix | First pass creates findings doc, second pass fixes. More structured but slower. | |
| Report only | Document everything found, but don't change code. Separate fix phase later. | |

**User's choice:** Fix in-place
**Notes:** None

### Risky Issues Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Flag + defer | Document as 'needs dedicated phase' with risk level. Don't attempt risky refactors during audit. | ✓ |
| Fix everything | Fix all issues regardless of blast radius. | |
| You decide | Claude judges risk per issue. | |

**User's choice:** Flag + defer
**Notes:** None

### Known Bugs Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, fix safe bugs | Fix bugs that are low-risk to patch. Defer SSE/schema-level changes. | ✓ |
| Security only | Stick to security issues. Known bugs are a separate concern. | |
| Fix all bugs | Fix every known bug plus any new ones discovered. | |

**User's choice:** Yes, fix safe bugs
**Notes:** None

---

## Security Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Deep analysis | OWASP Top 10 + auth bypass vectors + header hardening + input validation + SSRF/injection testing across all routes | ✓ |
| OWASP checklist | Systematic check against OWASP Top 10 categories. Thorough but structured. | |
| Surface scan | Quick header check, auth flow review, obvious issues only. | |

**User's choice:** Deep analysis
**Notes:** None

### Starting Point

| Option | Description | Selected |
|--------|-------------|----------|
| Build on CONCERNS.md | Verify flagged items + expand with fresh analysis. Don't duplicate. | ✓ |
| Fresh independent audit | Ignore prior findings. Start from scratch. | |
| CONCERNS.md items only | Just verify and fix the 5 already-flagged items. | |

**User's choice:** Build on CONCERNS.md
**Notes:** None

### Route Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All routes | Canonical + extensions + cron routes. Any exposed endpoint is attack surface. | ✓ |
| Canonical only | Just the 7 core governance routes. | |
| Canonical + cron | Core routes + cron endpoints. | |

**User's choice:** All routes
**Notes:** None

---

## Product Usefulness

| Option | Description | Selected |
|--------|-------------|----------|
| UX narrative walkthrough | Walk through /connect → /mission-control → /decisions as a new developer. | ✓ |
| Code + UX combined | Review code paths AND walk through UX. | |
| Market comparison | Compare against alternatives (Guardrails AI, LangSmith, etc). | |

**User's choice:** UX narrative walkthrough
**Notes:** None

### Persona

| Option | Description | Selected |
|--------|-------------|----------|
| Solo agent builder | Building with LangChain/Claude Code. Wants control. Not enterprise. | |
| Startup CTO | Running 3-5 agents in production. Needs audit trail. Small team. | |
| Enterprise evaluator | Assessing governance tools for a large org. Compliance-first. | |
| All three | Walk through from each perspective. | ✓ |

**User's choice:** All three
**Notes:** None

### Verification Method

| Option | Description | Selected |
|--------|-------------|----------|
| Code path review | Trace governance loop through code. Verify logic correctness. | ✓ |
| Live SDK test | Actually call SDK against running dev server. | |
| Both | Code review first, then verify key paths with live calls. | |

**User's choice:** Code path review
**Notes:** None

---

## Free-tier Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Full stack $0 | Vercel free + Neon free + optional Upstash free. Document limits. | ✓ |
| Vercel free only | Just verify deploy stays free on Vercel. | |
| Cost transparency | Document exact costs at different scales. | |

**User's choice:** Full stack $0
**Notes:** None

### Paid Feature Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Document + degrade gracefully | Paid features fail visibly with 'upgrade to enable' message. | ✓ |
| Remove paid dependencies | Strip anything that doesn't work on free tier. | |
| Just document | List what's free vs paid. Don't change code. | |

**User's choice:** Document + degrade gracefully
**Notes:** None

---

## Claude's Discretion

- Prioritization order of security findings
- Exact wording of graceful degradation messages
- How to structure the product narrative assessment
- Whether to update CONCERNS.md or create a separate audit report

## Deferred Ideas

None — discussion stayed within phase scope.
