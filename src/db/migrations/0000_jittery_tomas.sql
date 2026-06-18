CREATE TABLE IF NOT EXISTS "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"key_hash" text NOT NULL,
	"key_prefix" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"last_used_at" timestamp with time zone,
	"revoked" boolean DEFAULT false,
	CONSTRAINT "api_keys_key_hash_unique" UNIQUE("key_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "billing_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"credits" integer NOT NULL,
	"price_inr" integer NOT NULL,
	"interval" text DEFAULT 'month' NOT NULL,
	"razorpay_plan_id" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brand_cache" (
	"domain" text PRIMARY KEY NOT NULL,
	"logo_url" text,
	"logo_variants" jsonb DEFAULT '[]'::jsonb,
	"primary_color" text,
	"palette" jsonb DEFAULT '[]'::jsonb,
	"fonts" jsonb DEFAULT '[]'::jsonb,
	"styleguide" jsonb DEFAULT '{}'::jsonb,
	"description" text,
	"tagline" text,
	"category" text,
	"industry" text,
	"naics_code" text,
	"eic_code" text,
	"eic_subindustry" text,
	"address" text,
	"city" text,
	"state" text,
	"country" text DEFAULT 'India',
	"pincode" text,
	"gst_number" text,
	"socials" jsonb DEFAULT '{}'::jsonb,
	"wa_theme" jsonb DEFAULT '{}'::jsonb,
	"employee_count" text,
	"founded_year" integer,
	"tech_stack" jsonb DEFAULT '[]'::jsonb,
	"fetched_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone DEFAULT NOW() + INTERVAL '90 days',
	"fetch_errors" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "crawl_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid,
	"url" text NOT NULL,
	"status" text DEFAULT 'queued',
	"max_pages" integer DEFAULT 50,
	"max_depth" integer DEFAULT 3,
	"pages_found" integer DEFAULT 0,
	"pages_crawled" integer DEFAULT 0,
	"result" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "credit_balances" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"credits_remaining" integer DEFAULT 500,
	"credits_used_cycle" integer DEFAULT 0,
	"reset_at" timestamp with time zone DEFAULT NOW() + INTERVAL '1 month'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "extraction_contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url" text NOT NULL,
	"name" text,
	"schema" jsonb NOT NULL,
	"fingerprint" jsonb NOT NULL,
	"semantic_anchors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provenance" jsonb NOT NULL,
	"last_healed_at" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"run_count" integer DEFAULT 0,
	"schedule" text DEFAULT 'once' NOT NULL,
	"webhook_url" text,
	"active" boolean DEFAULT true,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "extraction_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"status" text NOT NULL,
	"content_hash" text NOT NULL,
	"values" jsonb,
	"confidence" jsonb,
	"validation_result" jsonb,
	"diff_from_contract" jsonb,
	"healed_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"extracted_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "intel_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid,
	"module" text NOT NULL,
	"input" jsonb NOT NULL,
	"status" text DEFAULT 'queued',
	"result" jsonb,
	"error" text,
	"credits_used" integer DEFAULT 0,
	"webhook_url" text,
	"webhook_status" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitor_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"url" text NOT NULL,
	"diff_summary" text NOT NULL,
	"diff_detail" jsonb NOT NULL,
	"severity" text DEFAULT 'medium',
	"seen" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitor_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"url" text NOT NULL,
	"content_hash" text NOT NULL,
	"content" text NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "monitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"check_interval" text DEFAULT 'daily',
	"alert_channel" text DEFAULT 'dashboard',
	"alert_target" text,
	"active" boolean DEFAULT true,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid,
	"razorpay_payment_id" text,
	"razorpay_order_id" text,
	"amount_inr" integer NOT NULL,
	"credits_purchased" integer NOT NULL,
	"status" text DEFAULT 'completed',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "payments_razorpay_payment_id_unique" UNIQUE("razorpay_payment_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"intel_job_id" uuid,
	"title" text NOT NULL,
	"report_type" text NOT NULL,
	"pdf_url" text,
	"json_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"expires_at" timestamp with time zone DEFAULT NOW() + INTERVAL '7 days'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"razorpay_subscription_id" text,
	"razorpay_order_id" text,
	"status" text DEFAULT 'active',
	"credits_granted" integer DEFAULT 0,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "usage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid,
	"endpoint" text NOT NULL,
	"credits" integer NOT NULL,
	"status" integer NOT NULL,
	"duration_ms" integer,
	"url" text,
	"module" text,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"plan" text DEFAULT 'free',
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "crawl_jobs" ADD CONSTRAINT "crawl_jobs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "credit_balances" ADD CONSTRAINT "credit_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extraction_contracts" ADD CONSTRAINT "extraction_contracts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "extraction_runs" ADD CONSTRAINT "extraction_runs_contract_id_extraction_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."extraction_contracts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "intel_jobs" ADD CONSTRAINT "intel_jobs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monitor_alerts" ADD CONSTRAINT "monitor_alerts_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monitor_snapshots" ADD CONSTRAINT "monitor_snapshots_monitor_id_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitors"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "monitors" ADD CONSTRAINT "monitors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reports" ADD CONSTRAINT "reports_intel_job_id_intel_jobs_id_fk" FOREIGN KEY ("intel_job_id") REFERENCES "public"."intel_jobs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_billing_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."billing_plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "usage_logs" ADD CONSTRAINT "usage_logs_api_key_id_api_keys_id_fk" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
