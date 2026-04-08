CREATE TABLE "action_embeddings" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"action_id" text NOT NULL,
	"embedding" vector(1536)
);
--> statement-breakpoint
CREATE TABLE "action_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"action_id" text,
	"org_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"agent_name" text,
	"swarm_id" text,
	"parent_action_id" text,
	"action_type" text NOT NULL,
	"declared_goal" text,
	"reasoning" text,
	"authorization_scope" text,
	"trigger" text,
	"systems_touched" text,
	"input_summary" text,
	"status" text,
	"reversible" integer DEFAULT 1,
	"risk_score" integer DEFAULT 0,
	"confidence" integer DEFAULT 50,
	"recommendation_id" text,
	"recommendation_applied" integer DEFAULT 0,
	"recommendation_override_reason" text,
	"output_summary" text,
	"side_effects" text,
	"artifacts_created" text,
	"error_message" text,
	"timestamp_start" text,
	"timestamp_end" text,
	"duration_ms" integer,
	"cost_estimate" real DEFAULT 0,
	"tokens_in" integer DEFAULT 0,
	"tokens_out" integer DEFAULT 0,
	"signature" text,
	"verified" boolean DEFAULT false,
	"approved_at" timestamp,
	"approved_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "action_records_action_id_unique" UNIQUE("action_id")
);
--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"actor_id" text NOT NULL,
	"actor_type" text DEFAULT 'user' NOT NULL,
	"action" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"details" text,
	"ip_address" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_connections" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"agent_id" text NOT NULL,
	"provider" text NOT NULL,
	"auth_type" text DEFAULT 'api_key' NOT NULL,
	"plan_name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"metadata" text,
	"reported_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"thread_id" text,
	"from_agent_id" text NOT NULL,
	"to_agent_id" text,
	"message_type" text DEFAULT 'info' NOT NULL,
	"subject" text,
	"body" text NOT NULL,
	"urgent" boolean DEFAULT false,
	"status" text DEFAULT 'sent' NOT NULL,
	"doc_ref" text,
	"read_by" text,
	"created_at" text NOT NULL,
	"read_at" text,
	"archived_at" text
);
--> statement-breakpoint
CREATE TABLE "agent_presence" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_name" text,
	"status" text DEFAULT 'online',
	"current_task_id" text,
	"last_heartbeat_at" timestamp DEFAULT now(),
	"metadata" text
);
--> statement-breakpoint
CREATE TABLE "agent_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"name" text NOT NULL,
	"cron_expression" text NOT NULL,
	"description" text,
	"active" boolean DEFAULT true,
	"last_run" timestamp with time zone,
	"next_run" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"label" text DEFAULT 'default',
	"role" text DEFAULT 'member',
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "assumptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"assumption_id" text NOT NULL,
	"org_id" text NOT NULL,
	"action_id" text NOT NULL,
	"assumption" text NOT NULL,
	"basis" text,
	"validated" integer DEFAULT 0,
	"validated_at" timestamp,
	"invalidated" integer DEFAULT 0,
	"invalidated_reason" text,
	"invalidated_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"summary" text NOT NULL,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone,
	"location" text,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "compliance_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"framework" text NOT NULL,
	"total_controls" integer DEFAULT 0 NOT NULL,
	"covered" integer DEFAULT 0 NOT NULL,
	"partial" integer DEFAULT 0 NOT NULL,
	"gaps" integer DEFAULT 0 NOT NULL,
	"coverage_percentage" integer DEFAULT 0 NOT NULL,
	"risk_level" text,
	"full_report" text,
	"created_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text,
	"name" text NOT NULL,
	"platform" text,
	"temperature" text,
	"notes" text,
	"opportunity_type" text,
	"last_contact" text,
	"interaction_count" integer DEFAULT 0,
	"next_followup" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "content" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text,
	"title" text NOT NULL,
	"platform" text,
	"status" text DEFAULT 'draft',
	"url" text,
	"body" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "context_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"content" text NOT NULL,
	"entry_type" text DEFAULT 'note',
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "context_points" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"agent_id" text,
	"content" text NOT NULL,
	"category" text DEFAULT 'general',
	"importance" integer DEFAULT 5,
	"session_date" text NOT NULL,
	"compressed" integer DEFAULT 0,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_totals" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text,
	"date" text NOT NULL,
	"total_tokens_in" integer DEFAULT 0,
	"total_tokens_out" integer DEFAULT 0,
	"total_tokens" integer DEFAULT 0,
	"peak_context_pct" real DEFAULT 0,
	"snapshots_count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "decisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text,
	"decision" text NOT NULL,
	"context" text,
	"reasoning" text,
	"outcome" text DEFAULT 'pending',
	"confidence" integer DEFAULT 50,
	"timestamp" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "drift_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"metric" text NOT NULL,
	"dimension" text DEFAULT 'overall',
	"severity" text DEFAULT 'info',
	"drift_type" text DEFAULT 'shift',
	"baseline_mean" real DEFAULT 0,
	"baseline_stddev" real DEFAULT 0,
	"current_mean" real DEFAULT 0,
	"current_stddev" real DEFAULT 0,
	"z_score" real DEFAULT 0,
	"pct_change" real DEFAULT 0,
	"sample_count" integer DEFAULT 0,
	"direction" text DEFAULT 'unknown',
	"description" text DEFAULT '',
	"acknowledged" boolean DEFAULT false,
	"acknowledged_by" text DEFAULT '',
	"acknowledged_at" timestamp,
	"baseline_id" text DEFAULT '',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "drift_baselines" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"metric" text NOT NULL,
	"dimension" text DEFAULT 'overall',
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"sample_count" integer DEFAULT 0,
	"mean" real DEFAULT 0,
	"stddev" real DEFAULT 0,
	"median" real DEFAULT 0,
	"p5" real DEFAULT 0,
	"p25" real DEFAULT 0,
	"p75" real DEFAULT 0,
	"p95" real DEFAULT 0,
	"min_val" real DEFAULT 0,
	"max_val" real DEFAULT 0,
	"distribution" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "drift_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text DEFAULT '',
	"metric" text NOT NULL,
	"dimension" text DEFAULT 'overall',
	"period" text DEFAULT 'daily',
	"period_start" timestamp NOT NULL,
	"mean" real DEFAULT 0,
	"stddev" real DEFAULT 0,
	"sample_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "entities" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'other',
	"mention_count" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "eval_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"scorer_id" text,
	"status" text DEFAULT 'pending',
	"total_actions" integer,
	"scored_count" integer DEFAULT 0,
	"avg_score" real,
	"summary" text,
	"error_message" text,
	"filter_criteria" text,
	"started_at" text,
	"completed_at" text,
	"created_by" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "eval_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"action_id" text NOT NULL,
	"scorer_name" text NOT NULL,
	"score" real NOT NULL,
	"label" text,
	"reasoning" text,
	"evaluated_by" text,
	"metadata" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "executions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text,
	"workflow_id" integer,
	"status" text DEFAULT 'pending',
	"started_at" timestamp with time zone DEFAULT now(),
	"finished_at" timestamp with time zone,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"action_id" text,
	"agent_id" text,
	"source" text DEFAULT 'user',
	"rating" integer,
	"sentiment" text DEFAULT 'neutral',
	"category" text DEFAULT 'general',
	"comment" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"resolved" boolean DEFAULT false,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text,
	"title" text NOT NULL,
	"category" text,
	"description" text,
	"target_date" text,
	"progress" integer DEFAULT 0,
	"status" text DEFAULT 'active',
	"cost_estimate" real DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "guard_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text,
	"decision" text NOT NULL,
	"reason" text,
	"matched_policies" text,
	"context" text,
	"risk_score" integer,
	"action_type" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guard_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"policy_type" text NOT NULL,
	"rules" text NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"agent_ids" text,
	"created_by" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardrails_test_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"total_policies" integer DEFAULT 0 NOT NULL,
	"total_tests" integer DEFAULT 0 NOT NULL,
	"passed" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"success" integer DEFAULT 0 NOT NULL,
	"details" text,
	"triggered_by" text,
	"created_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"timestamp" text NOT NULL,
	"health_score" integer DEFAULT 0,
	"total_files" integer DEFAULT 0,
	"total_lines" integer DEFAULT 0,
	"total_size_kb" integer DEFAULT 0,
	"memory_md_lines" integer DEFAULT 0,
	"oldest_daily_file" text,
	"newest_daily_file" text,
	"days_with_notes" integer DEFAULT 0,
	"avg_lines_per_day" real DEFAULT 0,
	"potential_duplicates" integer DEFAULT 0,
	"stale_facts_count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "ideas" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"category" text,
	"score" integer DEFAULT 50,
	"status" text DEFAULT 'pending',
	"source" text,
	"captured_at" text
);
--> statement-breakpoint
CREATE TABLE "interactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text,
	"contact_id" integer,
	"direction" text,
	"summary" text,
	"notes" text,
	"type" text,
	"platform" text,
	"date" text,
	"created_at" text
);
--> statement-breakpoint
CREATE TABLE "learning_curves" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"action_type" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"episode_count" integer DEFAULT 0,
	"avg_score" real DEFAULT 0,
	"success_rate" real DEFAULT 0,
	"avg_duration_ms" real DEFAULT 0,
	"avg_cost" real DEFAULT 0,
	"p25_score" real DEFAULT 0,
	"p75_score" real DEFAULT 0,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "learning_episodes" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"action_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"action_type" text NOT NULL,
	"status" text,
	"outcome_label" text DEFAULT 'pending' NOT NULL,
	"risk_score" integer DEFAULT 0,
	"reversible" integer DEFAULT 1,
	"confidence" integer DEFAULT 50,
	"duration_ms" integer,
	"cost_estimate" real DEFAULT 0,
	"invalidated_assumptions" integer DEFAULT 0,
	"open_loops" integer DEFAULT 0,
	"recommendation_id" text,
	"recommendation_applied" integer DEFAULT 0,
	"score" integer NOT NULL,
	"score_breakdown" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_recommendation_events" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"recommendation_id" text,
	"agent_id" text,
	"action_id" text,
	"event_type" text NOT NULL,
	"event_key" text,
	"details" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_recommendations" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"agent_id" text NOT NULL,
	"action_type" text NOT NULL,
	"confidence" integer DEFAULT 50 NOT NULL,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"top_sample_size" integer DEFAULT 0 NOT NULL,
	"success_rate" real DEFAULT 0 NOT NULL,
	"avg_score" real DEFAULT 0 NOT NULL,
	"hints" text NOT NULL,
	"guidance" text,
	"active" integer DEFAULT 1 NOT NULL,
	"computed_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_velocity" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text NOT NULL,
	"period" text DEFAULT 'daily',
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"episode_count" integer DEFAULT 0,
	"avg_score" real DEFAULT 0,
	"success_rate" real DEFAULT 0,
	"score_delta" real DEFAULT 0,
	"velocity" real DEFAULT 0,
	"acceleration" real DEFAULT 0,
	"maturity_score" real DEFAULT 0,
	"maturity_level" text DEFAULT 'novice',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "message_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"participants" text,
	"status" text DEFAULT 'open' NOT NULL,
	"summary" text,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL,
	"resolved_at" text
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"agent_id" text,
	"goal_id" integer,
	"title" text NOT NULL,
	"status" text DEFAULT 'active',
	"progress" integer DEFAULT 0,
	"cost_estimate" real DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"channel" text DEFAULT 'email',
	"enabled" integer DEFAULT 1,
	"signal_types" text DEFAULT '["all"]',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "open_loops" (
	"id" serial PRIMARY KEY NOT NULL,
	"loop_id" text NOT NULL,
	"org_id" text NOT NULL,
	"action_id" text NOT NULL,
	"loop_type" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'open',
	"priority" text DEFAULT 'medium',
	"owner" text,
	"resolution" text,
	"created_at" timestamp DEFAULT now(),
	"resolved_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" text DEFAULT 'free',
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"subscription_status" text DEFAULT 'active',
	"current_period_end" text,
	"trial_ends_at" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "profile_scores" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"action_id" text,
	"agent_id" text,
	"composite_score" real NOT NULL,
	"dimension_scores" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"scored_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prompt_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"template_id" text NOT NULL,
	"version_id" text NOT NULL,
	"action_id" text DEFAULT '',
	"agent_id" text DEFAULT '',
	"input_vars" jsonb DEFAULT '{}'::jsonb,
	"rendered" text DEFAULT '',
	"tokens_used" integer DEFAULT 0,
	"latency_ms" integer DEFAULT 0,
	"outcome" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prompt_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"category" text DEFAULT 'general',
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prompt_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"template_id" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"content" text NOT NULL,
	"model_hint" text DEFAULT '',
	"parameters" jsonb DEFAULT '[]'::jsonb,
	"changelog" text DEFAULT '',
	"is_active" boolean DEFAULT false,
	"created_by" text DEFAULT 'system',
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "risk_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"action_type" text,
	"base_risk" integer DEFAULT 0 NOT NULL,
	"rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'active',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "routing_agent_metrics" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"agent_id" text NOT NULL,
	"skill" text NOT NULL,
	"tasks_completed" integer DEFAULT 0 NOT NULL,
	"tasks_failed" integer DEFAULT 0 NOT NULL,
	"avg_duration_ms" integer,
	"last_completed_at" text,
	"created_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routing_agents" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"name" text NOT NULL,
	"capabilities" text,
	"max_concurrent" integer DEFAULT 3 NOT NULL,
	"current_load" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'available' NOT NULL,
	"endpoint" text,
	"created_at" text DEFAULT 'now()' NOT NULL,
	"updated_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routing_decisions" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"task_id" text NOT NULL,
	"candidates" text,
	"selected_agent_id" text,
	"selected_score" real,
	"reason" text,
	"created_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routing_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"required_skills" text,
	"urgency" text DEFAULT 'normal' NOT NULL,
	"assigned_to" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" text,
	"timeout_seconds" integer DEFAULT 3600 NOT NULL,
	"max_retries" integer DEFAULT 2 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"callback_url" text,
	"created_at" text DEFAULT 'now()' NOT NULL,
	"updated_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"workflow_id" integer,
	"name" text,
	"cron_expression" text,
	"enabled" integer DEFAULT 1,
	"next_run" timestamp with time zone,
	"last_run" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scoring_dimensions" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"profile_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"weight" real DEFAULT 1 NOT NULL,
	"data_source" text NOT NULL,
	"data_config" jsonb DEFAULT '{}'::jsonb,
	"scale" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "scoring_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"action_type" text,
	"status" text DEFAULT 'active',
	"composite_method" text DEFAULT 'weighted_average',
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "shared_docs" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"created_by" text NOT NULL,
	"last_edited_by" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snippets" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"agent_id" text,
	"name" text NOT NULL,
	"description" text,
	"code" text NOT NULL,
	"language" text,
	"tags" text,
	"use_count" integer DEFAULT 0,
	"created_at" text NOT NULL,
	"last_used" text
);
--> statement-breakpoint
CREATE TABLE "token_budgets" (
	"id" text PRIMARY KEY DEFAULT 'gen_random_uuid()' NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text,
	"daily_limit" integer DEFAULT 18000 NOT NULL,
	"weekly_limit" integer DEFAULT 126000 NOT NULL,
	"monthly_limit" integer DEFAULT 540000 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text,
	"timestamp" text NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"context_used" integer,
	"context_max" integer,
	"context_pct" real,
	"hourly_pct_left" real,
	"weekly_pct_left" real,
	"compactions" integer,
	"model" text,
	"session_key" text
);
--> statement-breakpoint
CREATE TABLE "topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"name" text NOT NULL,
	"mention_count" integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"agent_id" text,
	"key" text NOT NULL,
	"value" text,
	"category" text DEFAULT 'general',
	"encrypted" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_meters" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"period" text NOT NULL,
	"resource" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"last_reconciled_at" text,
	"updated_at" text NOT NULL,
	CONSTRAINT "usage_meters_org_period_resource_unique" UNIQUE("org_id", "period", "resource")
);
--> statement-breakpoint
CREATE TABLE "user_approaches" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"user_id" text,
	"agent_id" text,
	"approach" text NOT NULL,
	"context" text,
	"success_count" integer DEFAULT 0,
	"fail_count" integer DEFAULT 0,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_moods" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"user_id" text,
	"agent_id" text,
	"mood" text NOT NULL,
	"energy" text,
	"notes" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_observations" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"user_id" text,
	"agent_id" text,
	"observation" text NOT NULL,
	"category" text,
	"importance" integer DEFAULT 5,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"user_id" text,
	"agent_id" text,
	"preference" text NOT NULL,
	"category" text,
	"confidence" integer DEFAULT 50,
	"last_validated" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"provider" text,
	"provider_account_id" text,
	"role" text DEFAULT 'member',
	"created_at" text,
	"last_login_at" text
);
--> statement-breakpoint
CREATE TABLE "waitlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"signed_up_at" text NOT NULL,
	"signup_count" integer DEFAULT 1,
	"source" text DEFAULT 'landing_page',
	"notes" text,
	CONSTRAINT "waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"org_id" text DEFAULT 'org_default' NOT NULL,
	"url" text NOT NULL,
	"secret" text NOT NULL,
	"events" text DEFAULT '["all"]' NOT NULL,
	"active" integer DEFAULT 1 NOT NULL,
	"created_by" text,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"last_triggered_at" text,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workflows" (
	"id" serial PRIMARY KEY NOT NULL,
	"org_id" text NOT NULL,
	"agent_id" text,
	"name" text NOT NULL,
	"description" text,
	"enabled" integer DEFAULT 1,
	"trigger_type" text,
	"run_count" integer DEFAULT 0,
	"last_run" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "action_embeddings" ADD CONSTRAINT "action_embeddings_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "action_records" ADD CONSTRAINT "action_records_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_messages" ADD CONSTRAINT "agent_messages_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_presence" ADD CONSTRAINT "agent_presence_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assumptions" ADD CONSTRAINT "assumptions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content" ADD CONSTRAINT "content_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_totals" ADD CONSTRAINT "daily_totals_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decisions" ADD CONSTRAINT "decisions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entities" ADD CONSTRAINT "entities_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executions" ADD CONSTRAINT "executions_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guard_decisions" ADD CONSTRAINT "guard_decisions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guard_policies" ADD CONSTRAINT "guard_policies_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "health_snapshots" ADD CONSTRAINT "health_snapshots_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ideas" ADD CONSTRAINT "ideas_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_threads" ADD CONSTRAINT "message_threads_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_goal_id_goals_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."goals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "open_loops" ADD CONSTRAINT "open_loops_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_scores" ADD CONSTRAINT "profile_scores_profile_id_scoring_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."scoring_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_runs" ADD CONSTRAINT "prompt_runs_template_id_prompt_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."prompt_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_runs" ADD CONSTRAINT "prompt_runs_version_id_prompt_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_template_id_prompt_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."prompt_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_jobs" ADD CONSTRAINT "scheduled_jobs_workflow_id_workflows_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."workflows"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_dimensions" ADD CONSTRAINT "scoring_dimensions_profile_id_scoring_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."scoring_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_docs" ADD CONSTRAINT "shared_docs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "token_snapshots" ADD CONSTRAINT "token_snapshots_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topics" ADD CONSTRAINT "topics_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_org_user_channel_unique" ON "notification_preferences" USING btree ("org_id","user_id","channel");--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_account_unique" ON "users" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workflows_org_name_unique" ON "workflows" USING btree ("org_id","name");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "webhook_deliveries" (
  "id" text PRIMARY KEY NOT NULL,
  "webhook_id" text NOT NULL,
  "org_id" text DEFAULT 'org_default' NOT NULL,
  "event_type" text NOT NULL,
  "payload" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "response_status" integer,
  "response_body" text,
  "attempted_at" text DEFAULT now() NOT NULL,
  "duration_ms" integer
);
--> statement-breakpoint
ALTER TABLE "agent_messages" ADD COLUMN IF NOT EXISTS "action_id" text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_agent_messages_action_id" ON "agent_messages" ("action_id");
--> statement-breakpoint
-- ═══════════════════════════════════════════════════════════════════════════
-- Execution Studio — Phase 1 (workflow templates, model strategies,
-- knowledge collections, capability registry). All additive + nullable.
-- auto-migrate.mjs catches "already exists" errors so these are safe on re-run.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS "workflow_templates" (
  "template_id" text PRIMARY KEY NOT NULL,
  "org_id" text DEFAULT 'org_default' NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "objective" text,
  "steps_json" text DEFAULT '[]',
  "model_strategy_id" text,
  "model_strategy_snapshot" text,
  "linked_prompt_template_ids_json" text DEFAULT '[]',
  "linked_policy_ids_json" text DEFAULT '[]',
  "linked_knowledge_collection_ids_json" text DEFAULT '[]',
  "linked_capability_ids_json" text DEFAULT '[]',
  "linked_capability_tags_json" text DEFAULT '[]',
  "version" integer DEFAULT 1 NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "created_by" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "workflow_templates_org_slug_unique" ON "workflow_templates" ("org_id","slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_workflow_templates_org_status" ON "workflow_templates" ("org_id","status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "model_strategies" (
  "strategy_id" text PRIMARY KEY NOT NULL,
  "org_id" text DEFAULT 'org_default' NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "config_json" text NOT NULL,
  "created_by" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_model_strategies_org" ON "model_strategies" ("org_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_collections" (
  "collection_id" text PRIMARY KEY NOT NULL,
  "org_id" text DEFAULT 'org_default' NOT NULL,
  "name" text NOT NULL,
  "description" text,
  "source_type" text DEFAULT 'files' NOT NULL,
  "tags_json" text DEFAULT '[]',
  "ingestion_status" text DEFAULT 'empty' NOT NULL,
  "doc_count" integer DEFAULT 0 NOT NULL,
  "last_synced_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_collections_org" ON "knowledge_collections" ("org_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "knowledge_collection_items" (
  "item_id" text PRIMARY KEY NOT NULL,
  "collection_id" text NOT NULL,
  "org_id" text DEFAULT 'org_default' NOT NULL,
  "source_uri" text NOT NULL,
  "title" text,
  "mime_type" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "metadata_json" text DEFAULT '{}',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_items_collection" ON "knowledge_collection_items" ("collection_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "capabilities" (
  "capability_id" text PRIMARY KEY NOT NULL,
  "org_id" text DEFAULT 'org_default' NOT NULL,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "category" text,
  "source_type" text DEFAULT 'internal_sdk' NOT NULL,
  "auth_type" text DEFAULT 'none',
  "risk_level" text DEFAULT 'medium' NOT NULL,
  "requires_approval" integer DEFAULT 0 NOT NULL,
  "tags_json" text DEFAULT '[]',
  "pricing_json" text DEFAULT '{}',
  "health_status" text DEFAULT 'unknown' NOT NULL,
  "docs_url" text,
  "invocation_schema_json" text DEFAULT '{}',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "capabilities_org_slug_unique" ON "capabilities" ("org_id","slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_capabilities_org_category" ON "capabilities" ("org_id","category");
--> statement-breakpoint
-- Knowledge ingestion: chunked + embedded content for vector retrieval
CREATE TABLE IF NOT EXISTS "knowledge_chunks" (
  "chunk_id" text PRIMARY KEY NOT NULL,
  "item_id" text NOT NULL,
  "collection_id" text NOT NULL,
  "org_id" text DEFAULT 'org_default' NOT NULL,
  "content" text NOT NULL,
  "embedding" vector(1536),
  "position" integer DEFAULT 0 NOT NULL,
  "token_count" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_collection" ON "knowledge_chunks" ("collection_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_knowledge_chunks_item" ON "knowledge_chunks" ("item_id");
--> statement-breakpoint
-- Predictive risk: fast historical action lookups by (org, agent, action_type)
CREATE INDEX IF NOT EXISTS idx_action_records_predictive
ON action_records (org_id, agent_id, action_type, timestamp_start DESC);
--> statement-breakpoint
-- Workflow step results: full input/output for each step execution
CREATE TABLE IF NOT EXISTS workflow_step_results (
  id SERIAL PRIMARY KEY,
  step_result_id TEXT UNIQUE NOT NULL,
  run_action_id TEXT NOT NULL,
  org_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  step_id TEXT NOT NULL,
  step_index INTEGER NOT NULL,
  step_type TEXT NOT NULL,
  step_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  input_json TEXT,
  output_json TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  duration_ms INTEGER,
  started_at TEXT,
  finished_at TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);