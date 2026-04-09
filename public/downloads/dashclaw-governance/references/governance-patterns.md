# DashClaw Governance Patterns

Concrete tool call sequences for common governance scenarios. Load this reference when
you need implementation examples.

## Guard-Before-Invoke Pattern

The standard pattern for governed capability invocations:

```
Step 1: Guard the action
  dashclaw_guard(action_type="api_call", declared_goal="Send Slack notification",
                 risk_score=45, systems_touched=["slack"])

Step 2: Check the decision
  If "allow" or "warn" → proceed to step 3
  If "block" → stop, inform user
  If "require_approval" → go to Approval Wait Pattern

Step 3: Invoke the capability
  dashclaw_invoke(capability_id="cap_slack_notify",
                  declared_goal="Send deployment notification to #ops",
                  payload={"channel": "#ops", "message": "Deployed v2.3.1"})

Step 4: Record the outcome
  (dashclaw_invoke records automatically, but add extra context if needed)
  dashclaw_record(action_type="notification", declared_goal="Sent deploy notification",
                  status="completed", output_summary="Slack message sent to #ops")
```

## Approval Wait Pattern

When a guard decision requires human approval:

```
Step 1: Guard returns require_approval
  result = dashclaw_guard(action_type="deploy", declared_goal="Deploy to production",
                          risk_score=85, systems_touched=["production"])
  result.decision == "require_approval"

Step 2: Record the pending action
  dashclaw_record(action_type="deploy", declared_goal="Deploy v2.3.1 to production",
                  status="pending_approval", risk_score=85,
                  reasoning="All tests passed, staging verified")

Step 3: Inform the user
  "This deployment requires human approval. An operator can approve or deny
   this action in DashClaw Mission Control."

Step 4: Wait for the decision
  dashclaw_wait_for_approval(action_id="act_xxx")

Step 5: Handle the result
  If approved → proceed with the deploy, record outcome
  If denied → dashclaw_record(status="failed", output_summary="Denied by operator: [reason]")
  If timed_out → dashclaw_record(status="failed", output_summary="Approval timed out after 5 minutes")
```

## Session Lifecycle Pattern

Clean session boundaries for long-running tasks:

```
Step 1: Start session
  dashclaw_session_start(agent_id="research-agent", workspace="market-analysis")
  → session_id = "sess_xxx"

Step 2: Execute governed work
  ... (guard, act, record for each action) ...

Step 3: End session
  dashclaw_session_end(session_id="sess_xxx", status="completed",
                       summary="Analyzed 5 market segments, produced comparison report")
```

## Multi-Step Task Pattern

Governing a sequence of dependent actions:

```
Step 1: Start session
  dashclaw_session_start(agent_id="deploy-agent", workspace="release-v2.3.1")

Step 2: Guard the overall plan (low risk — just planning)
  dashclaw_guard(action_type="planning", declared_goal="Plan v2.3.1 release",
                 risk_score=10)

Step 3: Run tests (moderate risk)
  dashclaw_guard(action_type="test_execution", declared_goal="Run full test suite",
                 risk_score=35, systems_touched=["ci"])
  ... run tests ...
  dashclaw_record(action_type="test_execution", status="completed",
                  output_summary="847/847 tests passed")

Step 4: Deploy to staging (high risk)
  dashclaw_guard(action_type="deploy", declared_goal="Deploy to staging",
                 risk_score=70, systems_touched=["staging"])
  dashclaw_invoke(capability_id="cap_deploy", payload={"env": "staging"})

Step 5: Deploy to production (very high risk — expect approval)
  dashclaw_guard(action_type="deploy", declared_goal="Deploy to production",
                 risk_score=90, systems_touched=["production"])
  → require_approval → wait → approved
  dashclaw_invoke(capability_id="cap_deploy", payload={"env": "production"})

Step 6: End session
  dashclaw_session_end(session_id="sess_xxx", status="completed",
                       summary="Released v2.3.1: tests passed, staged, deployed to production")
```

## Error/Failure Recording Pattern

Always record failures — silent failures are governance gaps:

```
Step 1: Attempt the action
  result = dashclaw_invoke(capability_id="cap_api", payload={...})

Step 2: Check for failure
  If result.success == false:
    dashclaw_record(action_type="api_call", declared_goal="Fetch user data",
                    status="failed", risk_score=40,
                    output_summary="HTTP 503: Service temporarily unavailable")

Step 3: Do NOT silently retry
  If you want to retry, record the retry as a new action:
    dashclaw_guard(action_type="api_call", declared_goal="Retry: Fetch user data",
                   risk_score=40)
    dashclaw_invoke(capability_id="cap_api", payload={...})
```

## Discovery Pattern

Finding and using capabilities you haven't used before:

```
Step 1: List available capabilities
  dashclaw_capabilities_list(search="slack")
  → [{id: "cap_slack_notify", name: "Slack Notifications", health: "healthy", risk: "medium"}]

Step 2: Check the capability's health
  If health == "degraded" or "failing" → inform user, consider alternatives

Step 3: Guard the invocation
  dashclaw_guard(action_type="api_call", declared_goal="Send Slack message",
                 risk_score=45)

Step 4: Invoke
  dashclaw_invoke(capability_id="cap_slack_notify",
                  declared_goal="Notify team of completed analysis",
                  payload={"channel": "#team", "message": "Analysis complete"})
```
