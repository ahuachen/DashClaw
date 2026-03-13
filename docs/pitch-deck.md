# DashClaw: Agent Decision Infrastructure

---

## Slide 1: Title
**DashClaw**
**Agent Decision Infrastructure**

*Prove what your AI agents decided, why they decided it, and that it was safe.*

---

## Slide 2: The Shift
**The Runtime Has Changed**

*   **Yesterday:** Deterministic Code.
    *   Logic is hard-coded.
    *   "If X, then Y."
    *   Failures are bugs.

*   **Today:** Probabilistic Agents.
    *   Logic is inferred.
    *   "Given Goal G, figure out steps X, Y, Z."
    *   Failures are *choices*.

**The Problem:** You cannot debug a choice with a stack trace. You need a **Decision Trail**.

---

## Slide 3: The "Black Box" Barrier
**Why Enterprises Are Stuck in "Pilot Purgatory"**

Companies are ready to deploy agents, but Legal & Security are blocking them. Why?

1.  **No Accountability:** "Who approved this action?"
2.  **No Predictability:** "Why did the agent think this was okay?"
3.  **No Governance:** "How do we stop it *before* it breaks production?"

Current "Observability" tools (Datadog, LangSmith) are just **logs**. They tell you *what* happened after the fact. They don't control *why* it happened or stop it.

---

## Slide 4: The Solution
**DashClaw: The Decision Control Plane**

DashClaw is not just a logger. It is **infrastructure for autonomous governance**.

It sits between your agent and the world, enforcing rules, tracking assumptions, and proving compliance.

*   **Govern:** Semantic policies intercept actions *before* execution.
*   **Trace:** Track the *assumptions* that led to a decision, not just the code.
*   **Prove:** Generate audit-ready evidence for every autonomous step.

---

## Slide 5: Core Capabilities

### 1. Semantic Governance (The Guard)
*   **Problem:** You can't write `if (action == "bad")` for an LLM.
*   **DashClaw:** Natural language policies ("Do not modify production databases without approval") evaluated in real-time.
*   **Result:** Agents request permission, not forgiveness.

### 2. Assumption Tracking
*   **Problem:** Agents hallucinate context ("I thought the user was an admin").
*   **DashClaw:** Explicitly logs assumptions alongside actions. Detects **Assumption Drift** when reality contradicts the agent's belief.
*   **Result:** Catch logic errors before they compound.

### 3. Compliance Engine
*   **Problem:** Mapping agent logs to SOC 2 or NIST AI RMF is a manual nightmare.
*   **DashClaw:** Automatically maps guard decisions to compliance controls.
*   **Result:** One-click audit reports.

---

## Slide 6: Architecture
**Drop-In Infrastructure**

*   **The Agent:** Uses our zero-dependency SDK (Node.js or Python).
*   **The SDK:** `claw.guard()` checks policies. `claw.createAction()` logs intent.
*   **The Control Plane:** Hosted or Self-Hosted. Manages policies, approvals, and identity.
*   **The Evidence:** stored in your own Postgres database.

*Works with any framework: LangChain, CrewAI, AutoGen, or vanilla code.*

---

## Slide 7: Why Now? (The Positioning Shift)

The market is flooded with "Agent Observability" tools fighting for developer attention.

**DashClaw is different.** We are defining **Decision Infrastructure**.

| Feature | Observability Tools | DashClaw |
| :--- | :--- | :--- |
| **Primary Unit** | Spans / Traces | Decisions / Actions |
| **Role** | Passive Monitoring | Active Governance |
| **Goal** | Debugging Performance | Enforcing Safety |
| **Value** | Developer Efficiency | Business Accountability |

---

## Slide 8: Traction & Readiness

*   **Open Source:** MIT Licensed core.
*   **Production Ready:**
    *   Full RBAC & Team Management.
    *   High-scale ingestion pipeline.
    *   SOC 2 / NIST mapping out of the box.
*   **Developer Experience:**
    *   Local-first CLI tools.
    *   Instant setup (5 minutes to first governed action).

---

## Slide 9: The Team
**Built by Practical Systems**

**Practical Systems** is the product engineering studio behind DashClaw.

We build infrastructure for the autonomous future. DashClaw is our flagship platform, designed to bridge the gap between "cool demo" and "enterprise reality."

*(Note: Clarifying the distinction — Practical Systems is the company/creator, DashClaw is the product.)*

---

## Slide 10: The Ask

**Join us in defining the standard for Agent Governance.**

[ Link to Deck / Demo ]
[ Contact Info ]
