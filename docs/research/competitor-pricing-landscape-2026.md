# AI Agent Governance / Observability Platform Pricing Landscape

**Date:** 2026-04-06
**Purpose:** Competitive pricing intelligence for DashClaw positioning

---

## Executive Summary

The AI observability/governance market has converged on a common pricing architecture:
**free tier + usage-based metering + enterprise custom pricing**. The dominant metering
metrics are **traces/events/logs** (not tokens or seats). Most platforms offer generous
free tiers (5K-50K units/month) to drive adoption, with paid tiers starting at $29-$249/month.

Key insight for DashClaw: **No competitor directly prices on governance-specific metrics**
(policy evaluations, HITL approvals, drift detections). This is a differentiation opportunity.

---

## Detailed Competitor Pricing

### 1. AgentOps (agentops.ai) -- AI Agent Observability

| Tier | Price | Metering | Included | Retention |
|------|-------|----------|----------|-----------|
| **Basic** | $0/mo | Events | 5,000 events/mo | Not specified |
| **Pro** | From $40/mo | Events (pay-as-you-go) | Unlimited events, unlimited log retention, session/event export, RBAC, dedicated support | Unlimited |
| **Enterprise** | Custom | Events | SLA, Slack Connect, custom SSO, on-prem (AWS/GCP/Azure), SOC-2/HIPAA/NIST AI RMF | Custom |

- **Metering unit:** Events (any agent action recorded)
- **Notable:** Specifically targets agent frameworks, not just LLM calls. MIT-licensed SDK.

---

### 2. Langfuse (langfuse.com) -- LLM Observability/Tracing

| Tier | Price | Metering | Included | Retention |
|------|-------|----------|----------|-----------|
| **Hobby** | $0/mo | Units (traces + observations + scores) | 50K units/mo, 2 users | 30 days |
| **Core** | $29/mo | Units | 100K units/mo, unlimited users | 90 days |
| **Pro** | $199/mo | Units | 100K units/mo, unlimited users, SOC2/ISO27001/HIPAA | 3 years |
| **Enterprise** | $2,499/mo | Units | Custom rate limits, SLA, dedicated support | Custom |

**Overage pricing (graduated):**
- 0-100K: Included in base
- 100K-1M: $8 per 100K units
- 1M-10M: $7 per 100K units
- 10M-50M: $6.50 per 100K units
- 50M+: $6 per 100K units

- **Metering unit:** 1 unit = 1 trace, observation, or score ingested. A single request with 3 LLM calls and 2 eval scores = 6 units.
- **Notable:** Unlimited users on all paid tiers (no per-seat pricing). Open-source self-hosted option available for free.

---

### 3. LangSmith (smith.langchain.com) -- LangChain Tracing/Eval

| Tier | Price | Metering | Included | Retention |
|------|-------|----------|----------|-----------|
| **Developer** | $0/seat/mo | Traces + seats | 5K traces/mo, 1 seat, 1 workspace | 14 days |
| **Plus** | $39/seat/mo | Traces + seats | 10K traces/mo, unlimited seats, 3 workspaces | 14 days (400-day optional) |
| **Enterprise** | Custom (~$100K+/yr) | Traces + seats | Custom allocation, self-hosting, SSO, RBAC, HIPAA/SOC2 | Custom |

**Trace overage pricing:**
- Base traces (14-day retention): $0.50 per 1,000 traces ($2.50 was also reported -- verify)
- Extended traces (400-day retention): $5.00 per 1,000 traces

**Additional charges:**
- Agent Builder runs: $0.05/run beyond plan
- Dev deployment uptime: $0.0007/min
- Production deployment uptime: $0.0036/min

- **Metering unit:** Traces (per-seat + per-trace hybrid model)
- **Notable:** Per-seat pricing makes it expensive for larger teams. Deeply integrated with LangChain ecosystem.

---

### 4. Guardrails AI (guardrailsai.com) -- AI Guardrails

| Tier | Price | Metering | Included |
|------|-------|----------|----------|
| **Open Source** | $0 (self-hosted) | N/A | Full framework, Apache 2.0, 50+ validators from Hub |
| **Pro (Managed)** | Custom / contract-based | Validation operations | Hosted validation, observability dashboards, enterprise support |
| **Enterprise** | Custom | Custom | On-prem, HIPAA, audit logs, SSO, dedicated CSM |

**Alternative pricing observed (possibly a different product line):**
- Self-service: $0.25 per generated message, first 250 messages free
- Usage examples: 100 scenarios x 4 messages = $100

- **Metering unit:** Validation operations (or generated messages for testing product)
- **Notable:** Open-source core is genuinely free. Pro pricing is opaque/sales-driven. AWS Marketplace available.

---

### 5. Portkey (portkey.ai) -- AI Gateway/Observability

| Tier | Price | Metering | Included | Retention |
|------|-------|----------|----------|-----------|
| **Open Source** | $0 (self-hosted) | N/A | Universal API, retries, routing, guardrails, load balancing | N/A |
| **Developer** | $0/mo | Logged requests | 10K logs/mo (exceeding = logs not recorded, requests unaffected) | 3 days logs, 30 days metrics |
| **Production** | $49/mo | Logged requests | 100K logs/mo | 30 days logs, 90 days metrics |
| **Enterprise** | Custom | Logged requests | 10M+ logs/mo, SSO, VPC, SOC2/GDPR/HIPAA | Custom |

**Overage:** $9 per additional 100K requests (up to 3M/mo on Production)

- **Metering unit:** Logged requests (gateway-level)
- **Notable:** Gateway model means it sits in the request path. Open-source self-hosted option. Very competitive pricing.

---

### 6. Helicone (helicone.ai) -- LLM Observability

| Tier | Price | Metering | Included | Retention |
|------|-------|----------|----------|-----------|
| **Hobby** | $0/mo | Requests + storage | 10K requests, 1GB storage, 1 seat | 7 days |
| **Pro** | $79/mo | Requests + storage | 10K free requests + usage-based, unlimited seats | 1 month |
| **Team** | $799/mo | Requests + storage | 10K free requests + usage-based, SOC-2/HIPAA, 5 orgs | 3 months |
| **Enterprise** | Custom | Requests + storage | Unlimited orgs, SAML SSO, on-prem, bulk discounts | Custom |

**Usage-based example:** 10K requests + 0.30GB storage = ~$0.97/mo

**Special programs:**
- Startups (<2yr, <$5M funding): 50% first-year discount
- Students/educators: Free
- Open-source: $100 annual credit

- **Metering unit:** Requests + storage (GB)
- **Notable:** Proxy-based integration (sits in request path). Generous startup program.

---

### 7. Humanloop (humanloop.com) -- LLM App Platform

| Tier | Price | Metering | Included |
|------|-------|----------|----------|
| **Free** | $0/mo | Logs + eval runs | 10K logs/mo, 50 eval runs, 2 members |
| **Starter** | $100/mo | Datapoints/logs | 1,000 datapoints/mo, additional at $2/1K datapoints |
| **Team** | $1,000/mo | Datapoints/logs | 10,000 datapoints/mo, additional at $2/10K datapoints |
| **Enterprise** | Custom | Datapoints/logs | SSO/SAML, RBAC, VPC, SLA |

- **Metering unit:** Logs/datapoints (each API call to a Prompt, Tool, Evaluator, or Flow = 1 log)
- **Notable:** Expensive relative to competitors. Focused on prompt management and evaluation workflows.

---

### 8. Braintrust (braintrustdata.com) -- AI Eval Platform

| Tier | Price | Metering | Included | Retention |
|------|-------|----------|----------|-----------|
| **Starter** | $0/mo | Processed data (GB) + scores | 1GB data, 10K scores | 14 days |
| **Pro** | $249/mo | Processed data (GB) + scores | 5GB data, 50K scores, custom topics/charts | 30 days |
| **Enterprise** | Custom | Processed data (GB) + scores | Custom retention, RBAC, on-prem/hosted, premium support | Custom |

**Overage:**
- Data: $4/GB (Starter), $3/GB (Pro)
- Scores: $2.50/1K (Starter), $1.50/1K (Pro)

- **Metering unit:** Processed data volume (GB) + LLM-as-judge scores
- **Notable:** Unique metering on data volume rather than request count. Unlimited users, projects, datasets on all tiers.

---

## Comparison Matrix

| Platform | Free Tier | Paid Start | Metering Unit | Per-Seat? | Self-Host? | Enterprise Floor |
|----------|-----------|------------|---------------|-----------|------------|-----------------|
| **AgentOps** | 5K events | $40/mo | Events | No | Yes (Enterprise) | Custom |
| **Langfuse** | 50K units | $29/mo | Traces+obs+scores | No | Yes (free) | ~$2,499/mo |
| **LangSmith** | 5K traces | $39/seat/mo | Traces | Yes | Enterprise only | ~$100K+/yr |
| **Guardrails AI** | OSS (unlimited) | Custom | Validations | No | Yes (free) | Custom |
| **Portkey** | 10K logs | $49/mo | Logged requests | No | Yes (free) | Custom |
| **Helicone** | 10K requests | $79/mo | Requests + GB | No | Enterprise only | Custom |
| **Humanloop** | 10K logs | $100/mo | Logs/datapoints | No | Enterprise only | Custom |
| **Braintrust** | 1GB + 10K scores | $249/mo | GB + scores | No | Enterprise only | Custom |

---

## Key Pricing Patterns

### 1. Metering Metrics
- **Dominant:** Traces / events / logged requests (volume-based)
- **Emerging:** Data volume in GB (Braintrust), validation operations (Guardrails AI)
- **Rare:** Per-seat pricing (only LangSmith uses per-seat as primary model)
- **Nobody meters on:** Tokens, model costs, approval count, policy evaluations

### 2. Free Tier Design
- Range: 1GB/5K events to 50K units/month
- Purpose: Developer adoption + product-led growth
- Typical limits: Short retention (7-30 days), limited users, community support only
- Most generous: Langfuse (50K units), Portkey (10K logs, requests unaffected if exceeded)

### 3. Paid Tier Structure
- **Entry:** $29-$100/mo (individual/small team)
- **Mid:** $199-$799/mo (growth team with compliance needs)
- **Enterprise:** $2,499/mo to $100K+/yr (SSO, RBAC, on-prem, SLAs)

### 4. Common Enterprise Gates
Features consistently gated behind Enterprise:
- SSO / SAML
- RBAC
- On-premise / VPC deployment
- SOC-2 / HIPAA compliance
- Custom data retention
- SLAs with response time guarantees

### 5. Open-Source Strategy
- Langfuse, Portkey, and Guardrails AI offer genuine open-source self-hosted options
- This forces competitors to compete on managed service value, not core functionality
- Open-source + managed cloud is the dominant go-to-market for developer tools

---

## Market Trends (2025-2026)

1. **Hybrid pricing dominance:** 41% of enterprise SaaS companies use hybrid models (base subscription + usage-based overage)
2. **AI cost deflation:** Basic AI agent capabilities that cost $500/mo in 2022 available for under $100 today
3. **Outcome-based pricing retreating:** Vendors pulling back from pure outcome-based models due to measurement complexity
4. **Enterprise AI spend surging:** Average $1.2M on AI-native apps per enterprise (+108% YoY)
5. **Vendor price increases:** Some vendors raising prices 20-30% to cover AI infrastructure costs
6. **No per-seat for infra tools:** The market has clearly rejected per-seat pricing for infrastructure/observability (LangSmith is the outlier)

---

## Implications for DashClaw Pricing

### Whitespace Opportunities
1. **Governance-specific metrics:** No competitor meters on policy evaluations, HITL approvals, or drift detections. DashClaw can own this metering category.
2. **Compliance tier gap:** Most competitors jump straight from basic paid ($29-79/mo) to enterprise ($2,499+/mo). A compliance-ready mid-tier ($199-499/mo) with SOC-2/HIPAA could capture underserved segment.
3. **Agent count metering:** Billing per governed agent (rather than per trace) would align with how buyers think about governance scope.

### Recommended Pricing Architecture
Based on market analysis:

| Tier | Suggested Price | Metering | Rationale |
|------|----------------|----------|-----------|
| **Community** | $0/mo | 3 agents, 10K decisions/mo | Match market free tier generosity |
| **Team** | $99/mo | 10 agents, 100K decisions/mo, 90-day retention | Below Humanloop ($100), above Portkey ($49) |
| **Business** | $499/mo | 50 agents, 1M decisions/mo, 1-year retention, SOC-2 | Fill the compliance gap |
| **Enterprise** | Custom | Unlimited agents, custom retention, on-prem, HIPAA | Standard enterprise model |

### Pricing Principles
- **No per-seat pricing** (market has rejected this for infra tools)
- **Meter on governed decisions** (unique to governance, not commoditized like traces)
- **Unlimited users on all paid tiers** (follow Langfuse's winning model)
- **Open-source core** (table stakes for developer adoption in this market)

---

## Sources

- [AgentOps Pricing](https://www.agentops.ai/) | [AI Tools Atlas](https://aitoolsatlas.ai/tools/agentops/pricing)
- [Langfuse Pricing](https://langfuse.com/pricing) | [Cekura Analysis](https://www.cekura.ai/blogs/langfuse-pricing)
- [LangSmith Pricing](https://www.langchain.com/pricing) | [CheckThat Analysis](https://checkthat.ai/brands/langsmith/pricing)
- [Guardrails AI](https://guardrailsai.com/) | [WorkOS Comparison](https://workos.com/blog/guardrails-ai-vs-workos-safety-validation-enterprise-authentication)
- [Portkey Pricing](https://portkey.ai/pricing)
- [Helicone Pricing](https://www.helicone.ai/pricing)
- [Humanloop Pricing](https://humanloop.com/pricing) | [SaaSWorthy](https://www.saasworthy.com/product/humanloop/pricing)
- [Braintrust Pricing](https://www.braintrust.dev/pricing)
- [2026 Guide to SaaS, AI, and Agentic Pricing Models](https://www.getmonetizely.com/blogs/the-2026-guide-to-saas-ai-and-agentic-pricing-models)
- [Chargebee AI Agent Pricing Playbook](https://www.chargebee.com/blog/pricing-ai-agents-playbook/)
- [LLM Observability Comparison](https://softcery.com/lab/top-8-observability-platforms-for-ai-agents-in-2025)
