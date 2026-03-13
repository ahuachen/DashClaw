# DashClaw Project Context

This file provides high level architectural context for AI coding agents working in the DashClaw repository.

---

# Product Summary

DashClaw is a policy firewall for AI agents.

It sits between AI agents and real world systems to evaluate and govern actions before they execute.

Core decision pipeline:

Agent intent -> policy evaluation -> approval or block -> execution -> evidence recorded

DashClaw enables safe, accountable, permissioned autonomy for AI agents by providing a decision runtime for autonomous systems.

---

# Core Concepts

DashClaw is built around five primitives:

Guard
Action Records
Assumptions
Approvals
Evidence

Together these form a decision runtime that produces audit-ready evidence for every autonomous step.

---

# System Layers

DashClaw has three major components.

Agent SDK (Zero-dependency)
Control Plane (Governance Runtime)
Mission Control Dashboard (Operational Visibility)

---

# Agent SDK

SDK wraps risky agent actions and sends decision requests to DashClaw.

Must remain:

* lightweight
* dependency free
* easy to integrate

Example usage:

const { decision } = await claw.guard({
  action_type: "deploy",
  risk_score: 85
})

---

# Control Plane

The backend evaluates policies and records decision evidence. It acts as the decision runtime.

Responsibilities:

* evaluate guard policies
* manage approval workflows
* store decision trails
* detect integrity signals (autonomy breaches, drift)

---

# Mission Control

The dashboard provides operational visibility for agent fleets.

Displays:

* live actions
* approvals
* policy decisions
* decision signals
* cost tracking
* agent health

---

# Design Philosophy

DashClaw is infrastructure, not a SaaS feature platform.

The system should prioritize:

clarity
stability
developer usability (DX)
transparent governance

Avoid unnecessary complexity.

---

# Agent Editing Rules

When modifying this repository:

* make minimal changes
* preserve existing APIs
* avoid introducing dependencies
* keep architecture modular

Always explain changes before applying them.

---

# Key Principle

DashClaw governs the moment where agent intent becomes real world action.

Everything in the system exists to make that moment observable, controllable, and accountable.