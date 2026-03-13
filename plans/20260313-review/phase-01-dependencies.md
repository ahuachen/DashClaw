# Phase 01: Dependency Updates

## Objective
Remediate the 11 High severity and 3 Medium severity vulnerabilities found by OSV Scanner in `package-lock.json`.

## Targets
- `dompurify` (Cross-site Scripting vulnerability) -> upgrade to `3.3.2`
- `jspdf` (Denial of Service & Injection vulnerabilities) -> upgrade to `4.2.0`
- `minimatch` (ReDoS vulnerabilities) -> upgrade to `3.1.4` and `9.0.7`
- `ajv` (ReDoS) -> upgrade to `6.14.0`
- `next` (Unbounded Memory Consumption) -> upgrade to `15.6.0-canary.61` or latest stable patch.

## Execution
Run `npm audit fix` or manually update `package.json` and reinstall.
