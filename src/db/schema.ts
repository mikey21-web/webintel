import { pgTable, uuid, text, boolean, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  plan: text('plan').default('free'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull().unique(),
  keyPrefix: text('key_prefix').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  revoked: boolean('revoked').default(false),
});

export const creditBalances = pgTable('credit_balances', {
  userId: uuid('user_id').primaryKey().references(() => users.id),
  creditsRemaining: integer('credits_remaining').default(500),
  creditsUsedCycle: integer('credits_used_cycle').default(0),
  resetAt: timestamp('reset_at', { withTimezone: true }).default(sql`NOW() + INTERVAL '1 month'`),
});

export const billingPlans = pgTable('billing_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  description: text('description'),
  credits: integer('credits').notNull(),
  priceINR: integer('price_inr').notNull(),
  interval: text('interval').notNull().default('month'),
  razorpayPlanId: text('razorpay_plan_id'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: uuid('plan_id').notNull().references(() => billingPlans.id),
  razorpaySubscriptionId: text('razorpay_subscription_id'),
  razorpayOrderId: text('razorpay_order_id'),
  status: text('status').default('active'),
  creditsGranted: integer('credits_granted').default(0),
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id').references(() => subscriptions.id),
  razorpayPaymentId: text('razorpay_payment_id').unique(),
  razorpayOrderId: text('razorpay_order_id'),
  amountINR: integer('amount_inr').notNull(),
  creditsPurchased: integer('credits_purchased').notNull(),
  status: text('status').default('completed'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const usageLogs = pgTable('usage_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id),
  endpoint: text('endpoint').notNull(),
  credits: integer('credits').notNull(),
  status: integer('status').notNull(),
  durationMs: integer('duration_ms'),
  url: text('url'),
  module: text('module'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const brandCache = pgTable('brand_cache', {
  domain: text('domain').primaryKey(),
  logoUrl: text('logo_url'),
  logoVariants: jsonb('logo_variants').default([]),
  primaryColor: text('primary_color'),
  palette: jsonb('palette').default([]),
  fonts: jsonb('fonts').default([]),
  styleguide: jsonb('styleguide').default({}),
  description: text('description'),
  tagline: text('tagline'),
  category: text('category'),
  industry: text('industry'),
  naicsCode: text('naics_code'),
  eicCode: text('eic_code'),
  eicSubindustry: text('eic_subindustry'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  country: text('country').default('India'),
  pincode: text('pincode'),
  gstNumber: text('gst_number'),
  socials: jsonb('socials').default({}),
  waTheme: jsonb('wa_theme').default({}),
  employeeCount: text('employee_count'),
  foundedYear: integer('founded_year'),
  techStack: jsonb('tech_stack').default([]),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).default(sql`NOW() + INTERVAL '90 days'`),
  fetchErrors: integer('fetch_errors').default(0),
});

export const intelJobs = pgTable('intel_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id),
  module: text('module').notNull(),
  input: jsonb('input').notNull(),
  status: text('status').default('queued'),
  result: jsonb('result'),
  error: text('error'),
  creditsUsed: integer('credits_used').default(0),
  webhookUrl: text('webhook_url'),
  webhookStatus: text('webhook_status'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const monitors = pgTable('monitors', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  name: text('name').notNull(),
  urls: jsonb('urls').default([]).notNull(),
  checkInterval: text('check_interval').default('daily'),
  alertChannel: text('alert_channel').default('dashboard'),
  alertTarget: text('alert_target'),
  active: boolean('active').default(true),
  lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const monitorSnapshots = pgTable('monitor_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  monitorId: uuid('monitor_id').notNull().references(() => monitors.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  contentHash: text('content_hash').notNull(),
  content: text('content').notNull(),
  capturedAt: timestamp('captured_at', { withTimezone: true }).defaultNow(),
});

export const monitorAlerts = pgTable('monitor_alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  monitorId: uuid('monitor_id').notNull().references(() => monitors.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  diffSummary: text('diff_summary').notNull(),
  diffDetail: jsonb('diff_detail').notNull(),
  severity: text('severity').default('medium'),
  seen: boolean('seen').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id),
  intelJobId: uuid('intel_job_id').references(() => intelJobs.id),
  title: text('title').notNull(),
  reportType: text('report_type').notNull(),
  pdfUrl: text('pdf_url'),
  jsonData: jsonb('json_data'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).default(sql`NOW() + INTERVAL '7 days'`),
});

export const crawlJobs = pgTable('crawl_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  apiKeyId: uuid('api_key_id').references(() => apiKeys.id),
  url: text('url').notNull(),
  status: text('status').default('queued'),
  maxPages: integer('max_pages').default(50),
  maxDepth: integer('max_depth').default(3),
  pagesFound: integer('pages_found').default(0),
  pagesCrawled: integer('pages_crawled').default(0),
  result: jsonb('result'),
  error: text('error'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const extractionContracts = pgTable('extraction_contracts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  name: text('name'),
  schema: jsonb('schema').notNull(),
  fingerprint: jsonb('fingerprint').notNull(),
  semanticAnchors: jsonb('semantic_anchors').default([]).notNull(),
  provenance: jsonb('provenance').notNull(),
  lastHealedAt: timestamp('last_healed_at', { withTimezone: true }),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  runCount: integer('run_count').default(0),
  schedule: text('schedule').default('once').notNull(),
  webhookUrl: text('webhook_url'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const extractionRuns = pgTable('extraction_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  contractId: uuid('contract_id').notNull().references(() => extractionContracts.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  contentHash: text('content_hash').notNull(),
  values: jsonb('values'),
  confidence: jsonb('confidence'),
  validationResult: jsonb('validation_result'),
  diffFromContract: jsonb('diff_from_contract'),
  healedFields: jsonb('healed_fields').default([]).notNull(),
  error: text('error'),
  extractedAt: timestamp('extracted_at', { withTimezone: true }).defaultNow(),
});

export const apiKeysUserIdIdx = index('idx_api_keys_user_id').on(apiKeys.userId);
export const subscriptionsUserIdIdx = index('idx_subscriptions_user_id').on(subscriptions.userId);
export const subscriptionsPlanIdIdx = index('idx_subscriptions_plan_id').on(subscriptions.planId);
export const paymentsUserIdIdx = index('idx_payments_user_id').on(payments.userId);
export const paymentsSubscriptionIdIdx = index('idx_payments_subscription_id').on(payments.subscriptionId);
export const usageLogsApiKeyIdIdx = index('idx_usage_logs_api_key_id').on(usageLogs.apiKeyId);
export const intelJobsApiKeyIdIdx = index('idx_intel_jobs_api_key_id').on(intelJobs.apiKeyId);
export const monitorsUserIdIdx = index('idx_monitors_user_id').on(monitors.userId);
export const monitorSnapshotsMonitorIdIdx = index('idx_monitor_snapshots_monitor_id').on(monitorSnapshots.monitorId);
export const monitorAlertsMonitorIdIdx = index('idx_monitor_alerts_monitor_id').on(monitorAlerts.monitorId);
export const reportsUserIdIdx = index('idx_reports_user_id').on(reports.userId);
export const reportsIntelJobIdIdx = index('idx_reports_intel_job_id').on(reports.intelJobId);
export const crawlJobsApiKeyIdIdx = index('idx_crawl_jobs_api_key_id').on(crawlJobs.apiKeyId);
export const creditBalancesUserIdIdx = index('idx_credit_balances_user_id').on(creditBalances.userId);
export const extractionContractsUserIdUrlIdx = index('idx_extraction_contracts_user_url').on(extractionContracts.userId, extractionContracts.url);
export const extractionRunsContractIdIdx = index('idx_extraction_runs_contract_id').on(extractionRuns.contractId);

export type User = typeof users.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type BrandCache = typeof brandCache.$inferSelect;
export type IntelJob = typeof intelJobs.$inferSelect;
export type Monitor = typeof monitors.$inferSelect;
export type MonitorAlert = typeof monitorAlerts.$inferSelect;
export type MonitorSnapshot = typeof monitorSnapshots.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type CrawlJob = typeof crawlJobs.$inferSelect;
export type BillingPlan = typeof billingPlans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type ExtractionContract = typeof extractionContracts.$inferSelect;
export type ExtractionRun = typeof extractionRuns.$inferSelect;
