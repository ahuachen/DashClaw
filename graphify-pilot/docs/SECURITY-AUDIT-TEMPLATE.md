# Security Audit Template

> Comprehensive audit methodology for codebases before production release.

---

## How to Use This Template

1. Copy this template for each audit
2. Fill in project-specific details in the bracketed sections
3. Work through each section systematically
4. Document findings in the Output Format at the end

---

## Audit Request Template

```
I need you to perform a comprehensive audit of this [PROJECT_NAME] codebase before release.

Project Description: [Brief description of what the system does, architecture overview]

## What to Audit

### 1. Security Review (CRITICAL)

Examine these specific areas:

**Authentication & Authorization:**
- [ ] API endpoints - check for authentication, rate limiting, input validation
- [ ] Session management - token handling, expiration, secure storage
- [ ] Role-based access control (if applicable)

**Secrets Management:**
- [ ] All database connection strings and credential handling
- [ ] Environment variable handling - ensure .env files are gitignored
- [ ] Hardcoded credentials in any files (search for api_key, Bearer, sk-, password)
- [ ] Secrets in git history (git ls-files check)

**Data Protection:**
- [ ] Sensitive data filtering (API keys, passwords, PII)
- [ ] Session isolation - ensure private context cannot leak to other users/sessions
- [ ] Audit logging - verify all external actions are logged
- [ ] Input sanitization - check for XSS, injection vulnerabilities

**External Connections:**
- [ ] Database connections - verify encryption (SSL/TLS)
- [ ] API calls to external services - credential handling
- [ ] Sync scripts - no hardcoded credentials, proper error handling

### 2. Database Integrity

For each database, check:

**Databases to audit:**
- [ ] [List your databases here]

**For each database verify:**
- [ ] Schema is properly defined with appropriate constraints
- [ ] No SQL injection vulnerabilities in queries (parameterized queries used)
- [ ] Proper error handling for database operations
- [ ] Data types are validated before insertion
- [ ] Sensitive data is encrypted at rest (if required)
- [ ] Backup/recovery procedures exist

### 3. Sync/Integration Architecture

If the system syncs data between components:

- [ ] Does sync handle partial failures gracefully?
- [ ] What happens if sync is interrupted mid-transfer?
- [ ] Is there data deduplication to prevent duplicate entries?
- [ ] Are there race conditions between writes and sync reads?
- [ ] Is the sync interval appropriate or could data be lost?
- [ ] Are there retry mechanisms with exponential backoff?
- [ ] Is there a sync status/health indicator?

### 4. Tool/Module Functionality

For each component/tool directory, verify:

**Components to audit:**
- [ ] [List your tools/modules here]

**For each component check:**
- [ ] Entry points work and are documented
- [ ] Error handling exists and is meaningful (not silent failures)
- [ ] Dependencies are properly declared (requirements.txt, package.json)
- [ ] No orphaned code or unused functions
- [ ] Unit tests exist and pass (if applicable)
- [ ] Edge cases are handled

### 5. Background/Scheduled Process Logic

If the system has background jobs, cron, or heartbeat processes:

- [ ] Is the interval configurable?
- [ ] What happens if a job fails? (retry? alert? skip?)
- [ ] Are there timeout protections?
- [ ] Is there logging for job activities?
- [ ] Are jobs idempotent (safe to run multiple times)?
- [ ] Is there a way to manually trigger jobs?
- [ ] Are there circuit breakers for failing dependencies?

### 6. Frontend/Dashboard Review

If there's a web interface:

- [ ] API endpoint security (authentication required?)
- [ ] CORS configuration (not overly permissive)
- [ ] Error boundaries and graceful degradation
- [ ] localStorage/sessionStorage usage (any XSS concerns?)
- [ ] CSP headers configured
- [ ] No sensitive data in client-side code
- [ ] Form validation (client AND server side)

### 7. Code Quality

- [ ] Look for TODO/FIXME/HACK comments that indicate incomplete work
- [ ] Check for console.log/print statements that should be removed
- [ ] Verify consistent error handling patterns
- [ ] Check for hardcoded values that should be configurable
- [ ] Consistent code style/formatting
- [ ] No commented-out code blocks
- [ ] Functions/methods aren't too long (>50 lines is suspicious)

### 8. Production Readiness

- [ ] Is there a proper logging system (not just print statements)?
- [ ] Are there health check endpoints?
- [ ] Is there documentation for deployment?
- [ ] Are development-only features disabled in production?
- [ ] Are there environment-specific configs (dev/staging/prod)?
- [ ] Is there a rollback procedure?
- [ ] Are dependencies pinned to specific versions?
- [ ] Is there monitoring/alerting configured?

## Output Format

After your review, provide findings in these categories:

### 1. 🚨 Critical Issues
Security vulnerabilities or bugs that MUST be fixed before release.
- **Risk:** Immediate exploitation possible, data breach, system compromise

### 2. ⚠️ High Priority  
Significant problems that could cause failures in production.
- **Risk:** System instability, data loss, significant user impact

### 3. 🔶 Medium Priority
Code quality issues or missing error handling.
- **Risk:** Degraded experience, technical debt, maintenance burden

### 4. 📝 Low Priority
Nice-to-haves and polish items.
- **Risk:** Minor inconvenience, cosmetic issues

### 5. 💡 Recommendations
Architectural suggestions for scaling or improvement.
- **Risk:** None immediate, but valuable for future

### Issue Documentation Format

For each issue found:

| Field | Description |
|-------|-------------|
| **Location** | File path and line number (if applicable) |
| **Description** | What the problem is |
| **Impact** | What could go wrong |
| **Suggested Fix** | How to resolve it |
| **Effort** | Low/Medium/High |

## Audit Process

1. **Map the codebase** - Start by understanding the full directory structure
2. **Identify attack surface** - List all entry points (APIs, files, databases)
3. **Work systematically** - Go through each section in order
4. **Document as you go** - Don't save findings for the end
5. **Verify fixes** - Re-test after issues are addressed
```

---

## Quick Security Scan Commands

```bash
# Check for tracked secrets
git ls-files "*.env*" "*.db" "*secret*" "*password*" "*token*"

# Scan for hardcoded patterns (PowerShell)
Get-ChildItem -Recurse -Include "*.py","*.js","*.ts" -Exclude "node_modules","venv" | 
  Select-String "api_key|Bearer |sk-|DATABASE_URL|password\s*="

# Scan for hardcoded patterns (Bash)
grep -r "api_key\|Bearer \|sk-\|DATABASE_URL\|password=" --include="*.js" --include="*.py" --exclude-dir=node_modules

# Check for TODOs and FIXMEs
grep -r "TODO\|FIXME\|HACK\|XXX" --include="*.js" --include="*.py" --exclude-dir=node_modules

# Check for debug statements
grep -r "console.log\|console.debug\|print(" --include="*.js" --include="*.py" --exclude-dir=node_modules
```

---

## Post-Audit Actions

1. [ ] Create issues/tickets for all findings
2. [ ] Prioritize based on severity
3. [ ] Fix Critical and High Priority before release
4. [ ] Schedule Medium/Low for next sprint
5. [ ] Re-run audit after fixes
6. [ ] Document what was found for future reference
7. [ ] Update this template with any new checks discovered

---

*The cost of a thorough audit is always less than the cost of a security incident.*
