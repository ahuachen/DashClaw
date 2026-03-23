---
phase: 03
slug: integration-guides
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + npm run build |
| **Config file** | vitest.config.js |
| **Quick run command** | `npm run lint && npm run build 2>&1 | tail -10` |
| **Full suite command** | `npm run test -- --run && npm run build` |
| **Estimated runtime** | ~20 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | GUIDE-05 | build | `npm run lint && grep "export default function GuideClient" app/guides/GuideClient.js` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | GUIDE-01 | build | `npm run lint && npm run build 2>&1 | tail -10` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | GUIDE-02, GUIDE-05 | build | `npm run lint && npm run build 2>&1 | tail -10` | ❌ W0 | ⬜ pending |
| 03-02-01 | 02 | 2 | GUIDE-03 | file check | `test -f examples/langgraph-governed/main.py && test -f examples/langgraph-governed/.env.example` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 2 | GUIDE-03, GUIDE-05 | build | `npm run build 2>&1 | tail -10` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | GUIDE-04 | file check | `test -f examples/crewai-governed/main.py && test -f examples/crewai-governed/.env.example` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | GUIDE-04, GUIDE-05 | build | `npm run build 2>&1 | tail -10` | ❌ W0 | ⬜ pending |
| 03-04-01 | 04 | 3 | GUIDE-06 | build | `npm run lint && npm run build 2>&1 | tail -10` | ❌ W0 | ⬜ pending |
| 03-04-02 | 04 | 3 | GUIDE-06 | build | `npm run lint && npm run build 2>&1 | tail -10` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All new files are created during plan execution. No pre-existing test infrastructure needed beyond what exists (vitest, eslint, next build).

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Guide pages render correctly in browser | GUIDE-05 | Visual rendering check | Open /guides/claude-code, /guides/openai-agents-sdk, /guides/langgraph, /guides/crewai in browser |
| Copy-paste code blocks work | GUIDE-05 | Clipboard interaction | Click copy button, paste into editor |
| Framework guide cards on /connect link correctly | GUIDE-06 | Navigation flow | Click each card, verify correct guide loads |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
