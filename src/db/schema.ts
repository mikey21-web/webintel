import { pgTable, uuid, text, boolean, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
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

export type User = typeof users.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type BrandCache = typeof brandCache.$inferSelect;
export type IntelJob = typeof intelJobs.$inferSelect;
export type Monitor = typeof monitors.$inferSelect;
export type MonitorAlert = typeof monitorAlerts.$inferSelect;
export type MonitorSnapshot = typeof monitorSnapshots.$inferSelect;
export type Report = typeof reports.$inferSelect;
export type CrawlJob = typeof crawlJobs.$inferSelect;
