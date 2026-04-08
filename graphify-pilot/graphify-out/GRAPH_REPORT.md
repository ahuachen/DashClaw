# Graph Report - .  (2026-04-06)

## Corpus Check
- Large corpus: 566 files · ~418,508 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 1864 nodes · 2875 edges · 128 communities detected
- Extraction: 69% EXTRACTED · 31% INFERRED · 0% AMBIGUOUS · INFERRED: 899 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `DashClaw` - 223 edges
2. `DashClaw` - 198 edges
3. `DashClaw` - 79 edges
4. `POST()` - 31 edges
5. `safeFetch()` - 18 edges
6. `redactText()` - 12 edges
7. `DashClawCallbackHandler` - 12 edges
8. `RedisRealtimeBackend` - 11 edges
9. `DashClawError` - 10 edges
10. `MemoryRealtimeBackend` - 9 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `parseBoundedIntSafe()`  [INFERRED]
  app\api\_archive\workflows\route.js → app\api\learning\recommendations\metrics\route.js
- `GET()` --calls--> `buildResponse()`  [INFERRED]
  app\api\_archive\workflows\route.js → app\api\setup\proof\route.js
- `POST()` --calls--> `generateId()`  [INFERRED]
  app\api\_archive\sync\route.js → app\api\evaluations\scorers\route.js
- `POST()` --calls--> `isPemPublicKey()`  [INFERRED]
  app\api\_archive\sync\route.js → app\api\_archive\pairings\route.js
- `POST()` --calls--> `generateApiKey()`  [INFERRED]
  app\api\_archive\sync\route.js → app\api\_archive\onboarding\api-key\route.js

## Communities

### Community 0 - "Community 0"
Cohesion: 0.01
Nodes (148): ApprovalDeniedError, DashClaw, DashClawError, GuardBlockedError, Get a single message by ID., Get the URL to download an attachment., Download an attachment's binary data., Base error for DashClaw SDK. (+140 more)

### Community 1 - "Community 1"
Cohesion: 0.01
Nodes (11): getGuideBaseUrl(), isMarketingHost(), normalizeHost(), formatDate(), formatRelativeTime(), getMaskedApiKey(), MissionControlPage(), OverviewTab() (+3 more)

### Community 2 - "Community 2"
Cohesion: 0.02
Nodes (1): DashClaw

### Community 3 - "Community 3"
Cohesion: 0.03
Nodes (9): ActivityTimeline(), buildChainRows(), formatLifecycle(), formatTimestamp(), groupByDay(), computePosture(), SystemStatusBar(), attachListeners() (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.04
Nodes (7): DashClawAutoGenIntegration, Registers hooks on an AutoGen agent to log activity.         Works with Convers, Hook called when an agent receives a message.         Logs the turn as an actio, AutoGen Integration for DashClaw.     Automatically logs agent conversations an, ApprovalDeniedError, DashClaw, GuardBlockedError

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (54): buildResponse(), buildSuccessResponse(), DELETE(), generateApiKey(), generateFindings(), generateId(), genId(), GET() (+46 more)

### Community 6 - "Community 6"
Cohesion: 0.05
Nodes (4): demoActionDetail(), demoActionTrace(), demoAgentDetail(), demoAgents()

### Community 7 - "Community 7"
Cohesion: 0.13
Nodes (8): createEventEnvelope(), getRealtimeConfig(), getRealtimeHealth(), MemoryRealtimeBackend, publishOrgEvent(), RedisRealtimeBackend, replayOrgEvents(), subscribeOrgEvents()

### Community 8 - "Community 8"
Cohesion: 0.12
Nodes (15): addDimension(), autoCalibrate(), batchScoreActions(), computeAutoRisk(), computeComposite(), createProfile(), createRiskTemplate(), evaluateCondition() (+7 more)

### Community 9 - "Community 9"
Cohesion: 0.08
Nodes (0): 

### Community 10 - "Community 10"
Cohesion: 0.15
Nodes (10): BaseCallbackHandler, DashClawCallbackHandler, LLMResult, Run when tool starts running., Run when tool ends running., Run when tool errors., LangChain CallbackHandler for DashClaw.     Automatically logs actions, tools,, Initialize the callback handler.                  Args:             client: A (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.11
Nodes (2): buildActionGraph(), getActionTraceData()

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (11): calcMean(), calcPercentile(), calcStats(), calcStddev(), classifySeverity(), computeBaselines(), detectDrift(), getAgentIds() (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.25
Nodes (9): asNumber(), buildActionEvent(), buildAssumptionEvent(), buildGuardEvent(), buildLearningEvent(), buildLoopEvent(), formatMissionStatus(), isRoutineMonitorAction() (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.24
Nodes (12): assertSafeUrl(), checkTimeouts(), completeTask(), dispatchToAgent(), fireCallback(), formatTask(), getTask(), isPrivateIp() (+4 more)

### Community 15 - "Community 15"
Cohesion: 0.15
Nodes (4): activateVersion(), getTemplate(), getVersion(), updateTemplate()

### Community 16 - "Community 16"
Cohesion: 0.2
Nodes (6): createLearningRecommendationEvents(), parseJson(), toBoolean(), updateLearningRecommendationActive(), upsertLearningEpisode(), upsertLearningRecommendations()

### Community 17 - "Community 17"
Cohesion: 0.31
Nodes (9): calcMean(), calcPercentile(), classifyMaturity(), computeLearningCurves(), computeVelocity(), getAgentIds(), getAnalyticsSummary(), linearRegSlope() (+1 more)

### Community 18 - "Community 18"
Cohesion: 0.18
Nodes (3): buildEvidenceSection(), buildTrendSection(), generateExport()

### Community 19 - "Community 19"
Cohesion: 0.15
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.3
Nodes (10): isValidWebhookUrl(), validate(), validateActionOutcome(), validateActionRecord(), validateAssumption(), validateAssumptionUpdate(), validateField(), validateGuardInput() (+2 more)

### Community 21 - "Community 21"
Cohesion: 0.36
Nodes (10): asOutcomeLabel(), average(), buildGuidanceHints(), buildRecommendationsFromEpisodes(), clamp(), quantile(), scoreActionEpisode(), toBool() (+2 more)

### Community 22 - "Community 22"
Cohesion: 0.38
Nodes (9): createWorkflowTemplate(), duplicateWorkflowTemplate(), getWorkflowTemplate(), getWorkflowTemplateBySlug(), launchWorkflowTemplate(), safeJsonParse(), shapeTemplate(), slugify() (+1 more)

### Community 23 - "Community 23"
Cohesion: 0.4
Nodes (9): assertSafeWebhookUrl(), deliverGuardWebhook(), deliverWebhook(), fireWebhooksForApproval(), fireWebhooksForOrg(), isPrivateIp(), redactForStorage(), signGuardWebhookPayload() (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.38
Nodes (7): addCollectionItem(), createCollection(), getCollection(), safeJsonParse(), shapeCollection(), shapeItem(), updateCollection()

### Community 25 - "Community 25"
Cohesion: 0.47
Nodes (6): Agent, DashClawCrewIntegration, CrewAI Integration for DashClaw.     Provides callbacks to automatically log Ta, Callback for CrewAI Task completion.         Logs the finished task as a comple, Experimental: Patch a CrewAI agent to log step-by-step progress., Task

### Community 26 - "Community 26"
Cohesion: 0.42
Nodes (8): _executeContains(), _executeCustomFunction(), executeEvalRun(), _executeLLMJudge(), _executeNumericRange(), _executeRegex(), executeScorer(), generateId()

### Community 27 - "Community 27"
Cohesion: 0.31
Nodes (5): autoTag(), createFeedback(), detectSentiment(), getFeedback(), resolveFeedback()

### Community 28 - "Community 28"
Cohesion: 0.28
Nodes (4): maybeRebuildRecommendations(), rate(), rebuildLearningRecommendations(), summarizeOutcomes()

### Community 29 - "Community 29"
Cohesion: 0.39
Nodes (7): _anthropicComplete(), _detectProvider(), getLLMProviderInfo(), _googleComplete(), isLLMAvailable(), _openaiComplete(), tryLLMComplete()

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (6): checkQuota(), checkQuotaFast(), getCurrentPeriod(), getUsage(), incrementMeter(), seedMeters()

### Community 31 - "Community 31"
Cohesion: 0.44
Nodes (7): createModelStrategy(), deleteModelStrategy(), getModelStrategy(), safeJsonParse(), shapeStrategy(), updateModelStrategy(), validateStrategyConfig()

### Community 32 - "Community 32"
Cohesion: 0.42
Nodes (8): approvePairing(), createPairing(), ensureTable(), expirePairing(), expirePendingByAgent(), getPairing(), listPairings(), updatePairing()

### Community 33 - "Community 33"
Cohesion: 0.25
Nodes (2): getAgent(), unregisterAgent()

### Community 34 - "Community 34"
Cohesion: 0.22
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 0.43
Nodes (7): checkPolicyPattern(), checkToolPatterns(), evaluateControl(), listFrameworks(), loadFramework(), mapPolicies(), policyMatchesMapping()

### Community 36 - "Community 36"
Cohesion: 0.39
Nodes (4): attachAgentConnections(), getAgentDetail(), isMissingTable(), listAgentsForOrg()

### Community 37 - "Community 37"
Cohesion: 0.46
Nodes (6): createCapability(), getCapability(), safeJsonParse(), shapeCapability(), slugify(), updateCapability()

### Community 38 - "Community 38"
Cohesion: 0.25
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 0.38
Nodes (3): deleteNamedLayout(), loadNamedLayouts(), saveNamedLayout()

### Community 40 - "Community 40"
Cohesion: 0.52
Nodes (6): applyResult(), computeRiskScore(), evaluateGuard(), evaluatePolicy(), evaluateWebhookPolicy(), redactAny()

### Community 41 - "Community 41"
Cohesion: 0.57
Nodes (6): chunkText(), fetchSourceContent(), generateEmbeddings(), getEmbeddingApiKey(), searchCollection(), syncCollection()

### Community 42 - "Community 42"
Cohesion: 0.52
Nodes (6): createSession(), ensureTables(), getSession(), getSessionEvents(), listSessions(), updateSession()

### Community 43 - "Community 43"
Cohesion: 0.43
Nodes (4): hashStr(), metadataFor(), pickBlockedType(), reasoningFor()

### Community 44 - "Community 44"
Cohesion: 0.29
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 0.29
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 0.67
Nodes (5): decrypt(), decryptLegacyCbc(), decryptV2(), encrypt(), getKeyBytes()

### Community 47 - "Community 47"
Cohesion: 0.6
Nodes (5): composeMaintenanceMessage(), identifyConflictingDecisions(), identifyStaleAssumptions(), runMemoryMaintenance(), sendSystemMessage()

### Community 48 - "Community 48"
Cohesion: 0.53
Nodes (4): executeCompletion(), getProviderKey(), loadOrgCredentials(), resolveProviderChain()

### Community 49 - "Community 49"
Cohesion: 0.53
Nodes (4): generateControlSection(), generateCoverageBar(), generateMarkdownReport(), getRiskLevel()

### Community 50 - "Community 50"
Cohesion: 0.53
Nodes (4): convertPolicy(), convertRule(), extractAppliesTo(), generatePlaceholderTests()

### Community 51 - "Community 51"
Cohesion: 0.47
Nodes (3): generateJestTests(), generatePolicyTestSuite(), generateTestCase()

### Community 52 - "Community 52"
Cohesion: 0.6
Nodes (5): deleteIdentity(), ensureTable(), getIdentity(), listIdentities(), upsertIdentity()

### Community 53 - "Community 53"
Cohesion: 0.4
Nodes (2): getInviteById(), revokeInvite()

### Community 54 - "Community 54"
Cohesion: 0.4
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 0.4
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 0.7
Nodes (4): getBaseUrl(), getConnectGuideContent(), isMarketingHost(), normalizeHost()

### Community 57 - "Community 57"
Cohesion: 0.7
Nodes (4): _getSql(), isNeonUrl(), parseHostname(), _setSql()

### Community 58 - "Community 58"
Cohesion: 0.5
Nodes (2): downloadBlob(), exportToWord()

### Community 59 - "Community 59"
Cohesion: 0.6
Nodes (3): generateActionEmbedding(), getOpenAI(), isEmbeddingsEnabled()

### Community 60 - "Community 60"
Cohesion: 0.5
Nodes (2): analyzeGaps(), generateRiskAssessment()

### Community 61 - "Community 61"
Cohesion: 0.4
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 0.7
Nodes (4): countTests(), generateJsonReport(), generateMarkdownReport(), generatePolicySection()

### Community 63 - "Community 63"
Cohesion: 0.4
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 0.4
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 0.5
Nodes (2): upsertConnection(), upsertConnections()

### Community 66 - "Community 66"
Cohesion: 0.6
Nodes (3): ensureTable(), getHealthForOrg(), upsertHealth()

### Community 67 - "Community 67"
Cohesion: 0.7
Nodes (4): getAgentLinkMessages(), getSharedActions(), isMissingTable(), resolveAgentIdentifiers()

### Community 68 - "Community 68"
Cohesion: 0.4
Nodes (2): ApprovalDeniedError, GuardBlockedError

### Community 69 - "Community 69"
Cohesion: 0.67
Nodes (2): checkAllIntegrations(), decryptSettings()

### Community 70 - "Community 70"
Cohesion: 0.83
Nodes (3): computeRecommendation(), computeRiskLevel(), scanForPromptInjection()

### Community 71 - "Community 71"
Cohesion: 0.5
Nodes (0): 

### Community 72 - "Community 72"
Cohesion: 0.67
Nodes (2): isMissingTable(), safeQuery()

### Community 73 - "Community 73"
Cohesion: 0.5
Nodes (0): 

### Community 74 - "Community 74"
Cohesion: 0.67
Nodes (2): ConnectNextStepPanel(), getCurlSnippet()

### Community 75 - "Community 75"
Cohesion: 0.5
Nodes (0): 

### Community 76 - "Community 76"
Cohesion: 0.67
Nodes (0): 

### Community 77 - "Community 77"
Cohesion: 1.0
Nodes (2): canonicalize(), canonicalJsonStringify()

### Community 78 - "Community 78"
Cohesion: 1.0
Nodes (2): escapeHtml(), sendSignalAlertEmail()

### Community 79 - "Community 79"
Cohesion: 0.67
Nodes (0): 

### Community 80 - "Community 80"
Cohesion: 1.0
Nodes (2): checkCoreTables(), startupSchemaCheck()

### Community 81 - "Community 81"
Cohesion: 1.0
Nodes (2): formatZodIssues(), parseJsonWithSchema()

### Community 82 - "Community 82"
Cohesion: 1.0
Nodes (2): buildFixtures(), getDemoFixtures()

### Community 83 - "Community 83"
Cohesion: 1.0
Nodes (2): evaluatePolicies(), evaluatePolicy()

### Community 84 - "Community 84"
Cohesion: 0.67
Nodes (0): 

### Community 85 - "Community 85"
Cohesion: 0.67
Nodes (0): 

### Community 86 - "Community 86"
Cohesion: 0.67
Nodes (0): 

### Community 87 - "Community 87"
Cohesion: 1.0
Nodes (2): getRepositoryInterface(), validateRepositoryImplementation()

### Community 88 - "Community 88"
Cohesion: 0.67
Nodes (0): 

### Community 89 - "Community 89"
Cohesion: 0.67
Nodes (0): 

### Community 90 - "Community 90"
Cohesion: 1.0
Nodes (0): 

### Community 91 - "Community 91"
Cohesion: 1.0
Nodes (0): 

### Community 92 - "Community 92"
Cohesion: 1.0
Nodes (0): 

### Community 93 - "Community 93"
Cohesion: 1.0
Nodes (0): 

### Community 94 - "Community 94"
Cohesion: 1.0
Nodes (0): 

### Community 95 - "Community 95"
Cohesion: 1.0
Nodes (0): 

### Community 96 - "Community 96"
Cohesion: 1.0
Nodes (0): 

### Community 97 - "Community 97"
Cohesion: 1.0
Nodes (0): 

### Community 98 - "Community 98"
Cohesion: 1.0
Nodes (0): 

### Community 99 - "Community 99"
Cohesion: 1.0
Nodes (0): 

### Community 100 - "Community 100"
Cohesion: 1.0
Nodes (0): 

### Community 101 - "Community 101"
Cohesion: 1.0
Nodes (0): 

### Community 102 - "Community 102"
Cohesion: 1.0
Nodes (0): 

### Community 103 - "Community 103"
Cohesion: 1.0
Nodes (0): 

### Community 104 - "Community 104"
Cohesion: 1.0
Nodes (0): 

### Community 105 - "Community 105"
Cohesion: 1.0
Nodes (0): 

### Community 106 - "Community 106"
Cohesion: 1.0
Nodes (0): 

### Community 107 - "Community 107"
Cohesion: 1.0
Nodes (0): 

### Community 108 - "Community 108"
Cohesion: 1.0
Nodes (0): 

### Community 109 - "Community 109"
Cohesion: 1.0
Nodes (0): 

### Community 110 - "Community 110"
Cohesion: 1.0
Nodes (0): 

### Community 111 - "Community 111"
Cohesion: 1.0
Nodes (0): 

### Community 112 - "Community 112"
Cohesion: 1.0
Nodes (0): 

### Community 113 - "Community 113"
Cohesion: 1.0
Nodes (0): 

### Community 114 - "Community 114"
Cohesion: 1.0
Nodes (0): 

### Community 115 - "Community 115"
Cohesion: 1.0
Nodes (0): 

### Community 116 - "Community 116"
Cohesion: 1.0
Nodes (0): 

### Community 117 - "Community 117"
Cohesion: 1.0
Nodes (0): 

### Community 118 - "Community 118"
Cohesion: 1.0
Nodes (0): 

### Community 119 - "Community 119"
Cohesion: 1.0
Nodes (0): 

### Community 120 - "Community 120"
Cohesion: 1.0
Nodes (0): 

### Community 121 - "Community 121"
Cohesion: 1.0
Nodes (0): 

### Community 122 - "Community 122"
Cohesion: 1.0
Nodes (0): 

### Community 123 - "Community 123"
Cohesion: 1.0
Nodes (0): 

### Community 124 - "Community 124"
Cohesion: 1.0
Nodes (0): 

### Community 125 - "Community 125"
Cohesion: 1.0
Nodes (0): 

### Community 126 - "Community 126"
Cohesion: 1.0
Nodes (0): 

### Community 127 - "Community 127"
Cohesion: 1.0
Nodes (1): Context manager that auto-tags messages and assumptions with action_id.

## Knowledge Gaps
- **154 isolated node(s):** `Base error for DashClaw SDK.`, `Thrown when behavior guard blocks an action.`, `Thrown when a human operator denies an action.`, `Sign payload using RSASSA-PKCS1-v1_5 (PKCS#1 v1.5) + SHA-256.`, `Record what the agent believed to be true when making a decision.` (+149 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 90`** (2 nodes): `apiErrors.js`, `apiErrorResponse()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 91`** (2 nodes): `audit.js`, `logActivity()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 92`** (2 nodes): `billing.js`, `estimateCost()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 93`** (2 nodes): `globToRegex.js`, `globToRegex()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 94`** (2 nodes): `identity.js`, `verifyAgentSignature()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 95`** (2 nodes): `learning-context.js`, `getLearningContext()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 96`** (2 nodes): `learning-lessons.js`, `consolidateLessons()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 97`** (2 nodes): `pairings.js`, `ensureAgentPairingsTable()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 98`** (2 nodes): `policy-suggestions.js`, `generatePolicySuggestions()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 99`** (2 nodes): `recovery.js`, `evaluateRecoveryRecipes()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 100`** (2 nodes): `signals.js`, `computeSignals()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 101`** (2 nodes): `timing-safe.js`, `timingSafeCompare()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 102`** (2 nodes): `tutorial-assumptions.js`, `agent()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 103`** (2 nodes): `index.js`, `deliverNativeNotifications()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 104`** (2 nodes): `apiKeys.repository.js`, `findActiveKeyByHash()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 105`** (2 nodes): `orgsTeam.repository.js`, `getTeamOrgAndMembers()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 106`** (2 nodes): `prompts.repository.js`, `listPromptRuns()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 107`** (2 nodes): `snippets.repository.js`, `getSnippetById()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 108`** (2 nodes): `composeInstanceStatus.js`, `composeInstanceStatus()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 109`** (2 nodes): `ModelPricingPanel.js`, `ModelPricingPanel()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 110`** (2 nodes): `ProofPanel.js`, `ProofPanel()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 111`** (1 nodes): `validateEnv.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 112`** (1 nodes): `background-agents.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 113`** (1 nodes): `feature-agents.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 114`** (1 nodes): `help-tips.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 115`** (1 nodes): `journey-agents.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 116`** (1 nodes): `persona-agents.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 117`** (1 nodes): `realistic-agents.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 118`** (1 nodes): `tutorial-handoffs.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 119`** (1 nodes): `tutorial-threads.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 120`** (1 nodes): `discord.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 121`** (1 nodes): `linear.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 122`** (1 nodes): `slack.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 123`** (1 nodes): `routing.repository.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 124`** (1 nodes): `dashclaw-demo.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 125`** (1 nodes): `schema.js`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 126`** (1 nodes): `setup.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 127`** (1 nodes): `Context manager that auto-tags messages and assumptions with action_id.`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DashClaw` connect `Community 2` to `Community 68`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Are the 30 inferred relationships involving `POST()` (e.g. with `redactAny()` and `getSql()`) actually correct?**
  _`POST()` has 30 INFERRED edges - model-reasoned connections that need verification._
- **Are the 17 inferred relationships involving `safeFetch()` (e.g. with `isPrivateIP()` and `testNotion()`) actually correct?**
  _`safeFetch()` has 17 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Base error for DashClaw SDK.`, `Thrown when behavior guard blocks an action.`, `Thrown when a human operator denies an action.` to the rest of the system?**
  _154 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.01 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.02 - nodes in this community are weakly interconnected._