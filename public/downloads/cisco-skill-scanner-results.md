# Agent Skill Security Scan Report

**Skill:** dashclaw-platform-intelligence
**Directory:** C:\Projects\DashClaw\public\downloads\dashclaw-platform-intelligence\dashclaw-platform-intelligence
**Status:** [FAIL] ISSUES FOUND
**Max Severity:** CRITICAL
**Scan Duration:** 0.38s
**Timestamp:** 2026-03-10T14:52:55.025908+00:00

## Summary

- **Total Findings:** 6
- **Critical:** 1
- **High:** 1
- **Medium:** 3
- **Low:** 0
- **Info:** 1

## Findings

### CRITICAL Severity

#### [CRITICAL] Node.js child_process module usage for shell command execution

**Severity:** CRITICAL
**Category:** command_injection
**Rule ID:** COMMAND_INJECTION_JS_CHILD_PROCESS
**Location:** scripts\bootstrap-agent-quick.mjs:27

**Description:** Pattern detected: from 'child_process'

### HIGH Severity

#### [HIGH] Critically low analyzability score

**Severity:** HIGH
**Category:** policy_violation
**Rule ID:** LOW_ANALYZABILITY

**Description:** Only 59% of skill content could be analyzed. 3 of 7 files are opaque to the scanner. The safety assessment has low confidence.

### MEDIUM Severity

#### [MEDIUM] Outbound network request primitives in JavaScript/TypeScript

**Severity:** MEDIUM
**Category:** data_exfiltration
**Rule ID:** DATA_EXFIL_JS_NETWORK
**Location:** scripts\bootstrap-agent-quick.mjs:76

**Description:** Pattern detected: fetch(

#### [MEDIUM] Outbound network request primitives in JavaScript/TypeScript

**Severity:** MEDIUM
**Category:** data_exfiltration
**Rule ID:** DATA_EXFIL_JS_NETWORK
**Location:** scripts\diagnose.mjs:64

**Description:** Pattern detected: fetch(

#### [MEDIUM] Outbound network request primitives in JavaScript/TypeScript

**Severity:** MEDIUM
**Category:** data_exfiltration
**Rule ID:** DATA_EXFIL_JS_NETWORK
**Location:** scripts\validate-integration.mjs:68

**Description:** Pattern detected: fetch(

### INFO Severity

#### [INFO] Skill does not specify a license

**Severity:** INFO
**Category:** policy_violation
**Rule ID:** MANIFEST_MISSING_LICENSE
**Location:** SKILL.md

**Description:** Skill manifest does not include a 'license' field. Specifying a license helps users understand usage terms.

## Analyzers

The following analyzers were used:

- static_analyzer
- bytecode
- pipeline
- behavioral_analyzer
