#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CONFIG_DIR = join(homedir(), '.webintel');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');
const DEFAULT_BASE_URL = 'https://webintel.diyaaaa.in';

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
}

function loadConfig() {
  ensureConfigDir();
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { apiKey: '', baseUrl: DEFAULT_BASE_URL };
  }
}

function saveConfig(config) {
  ensureConfigDir();
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

async function apiFetch(path, options = {}) {
  const config = loadConfig();
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const url = `${baseUrl}${path}`;
  const spinner = ora(options.label || 'Fetching...').start();
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      method: options.method || 'GET',
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    if (!res.ok) {
      const text = await res.text();
      spinner.fail(`Request failed (${res.status}): ${text}`);
      process.exit(1);
    }
    const data = await res.json();
    spinner.succeed(options.successLabel || 'Done');
    return data;
  } catch (err) {
    spinner.fail(`Error: ${err.message}`);
    process.exit(1);
  }
}

function printJson(data) {
  console.log(JSON.stringify(data, null, 2));
}

// --- config ---
const configCmd = program.command('config').description('Manage WebIntel configuration');

configCmd.command('set-key')
  .description('Set your WebIntel API key')
  .argument('<key>', 'API key (sk-...)')
  .action((key) => {
    const config = loadConfig();
    config.apiKey = key;
    saveConfig(config);
    console.log(chalk.green('API key saved to ~/.webintel/config.json'));
  });

configCmd.command('show')
  .description('Show current configuration')
  .action(() => {
    const config = loadConfig();
    console.log(chalk.bold('WebIntel Configuration'));
    console.log(chalk.dim('────────────────────────'));
    console.log(`  ${chalk.cyan('Base URL:')}  ${config.baseUrl || DEFAULT_BASE_URL}`);
    console.log(`  ${chalk.cyan('API Key:')}   ${config.apiKey ? chalk.green(config.apiKey.substring(0, 8) + '...') : chalk.red('Not set')}`);
  });

// --- analyze ---
program.command('analyze')
  .description('Analyze a domain for competitor intelligence')
  .argument('<domain>', 'Domain to analyze (e.g. 99acres.com)')
  .option('-j, --json', 'Output as JSON')
  .action(async (domain, opts) => {
    const data = await apiFetch(`/v1/brand/profile?domain=${domain}`, { label: `Analyzing ${domain}...` });
    if (opts.json) return printJson(data);
    console.log(`\n${chalk.bold.hex('#6366f1')(data.name || domain)}`);
    console.log(chalk.dim(data.oneLiner || ''));
    console.log(`  ${chalk.cyan('Score:')}     ${formatScore(data.score)}`);
    console.log(`  ${chalk.cyan('Industry:')}  ${data.industry || 'N/A'}`);
    if (data.keyFeatures?.length) {
      console.log(`\n${chalk.bold('Key Features:')}`);
      data.keyFeatures.forEach(f => console.log(`  ${chalk.green('✓')} ${f}`));
    }
    if (data.swot) {
      console.log(`\n${chalk.bold('SWOT Analysis:')}`);
      if (data.swot.strengths) console.log(`  ${chalk.green('S:')} ${data.swot.strengths}`);
      if (data.swot.weaknesses) console.log(`  ${chalk.red('W:')} ${data.swot.weaknesses}`);
      if (data.swot.opportunities) console.log(`  ${chalk.blue('O:')} ${data.swot.opportunities}`);
      if (data.swot.threats) console.log(`  ${chalk.yellow('T:')} ${data.swot.threats}`);
    }
  });

// --- brand ---
program.command('brand')
  .description('Get full brand profile for a domain')
  .argument('<domain>', 'Domain to look up')
  .option('-j, --json', 'Output as JSON')
  .action(async (domain, opts) => {
    const data = await apiFetch(`/v1/brand/profile?domain=${domain}`, { label: `Fetching brand profile for ${domain}...` });
    if (opts.json) return printJson(data);
    console.log(`\n${chalk.bold.hex('#6366f1')(data.name || domain)}`);
    if (data.logo) console.log(`  ${chalk.cyan('Logo:')}     ${data.logo}`);
    if (data.oneLiner) console.log(`  ${chalk.cyan('Tagline:')}  ${data.oneLiner}`);
    if (data.description) console.log(`  ${chalk.cyan('About:')}    ${data.description}`);
    if (data.industry) console.log(`  ${chalk.cyan('Industry:')} ${data.industry}`);
    if (data.foundedYear) console.log(`  ${chalk.cyan('Founded:')}  ${data.foundedYear}`);
    if (data.headquarters) console.log(`  ${chalk.cyan('HQ:')}       ${data.headquarters}`);
    if (data.employeeCount) console.log(`  ${chalk.cyan('Employees:')} ${data.employeeCount}`);
    if (data.colors?.length) console.log(`  ${chalk.cyan('Colors:')}   ${data.colors.map(c => chalk.hex(c)(c)).join(' ')}`);
    if (data.fonts?.length) console.log(`  ${chalk.cyan('Fonts:')}    ${data.fonts.join(', ')}`);
    if (data.techStack?.length) {
      console.log(`\n${chalk.bold('Tech Stack:')}`);
      data.techStack.forEach(t => {
        const name = typeof t === 'string' ? t : (t.name || t.category || '');
        const cat = typeof t === 'string' ? '' : (t.category || '');
        console.log(`  ${cat ? chalk.dim(`[${cat}]`) + ' ' : ''}${name}`);
      });
    }
    if (data.socials && Object.keys(data.socials).length) {
      console.log(`\n${chalk.bold('Socials:')}`);
      Object.entries(data.socials).forEach(([k, v]) => console.log(`  ${chalk.cyan(k + ':')} ${v}`));
    }
    if (data.address) console.log(`\n${chalk.cyan('Address:')} ${data.address}`);
  });

// --- compare ---
program.command('compare')
  .description('Compare multiple domains side by side')
  .argument('<domains...>', 'Domains to compare (space-separated)')
  .option('-j, --json', 'Output as JSON')
  .action(async (domains, opts) => {
    const results = [];
    for (const domain of domains) {
      const data = await apiFetch(`/v1/brand/profile?domain=${domain}`, { label: `Fetching ${domain}...` });
      results.push(data);
    }
    if (opts.json) return printJson(results);

    const rows = ['Name', 'Score', 'Industry', 'Founded', 'Employees', 'Tech Count', 'Socials Count'];
    const table = new Table({
      head: [chalk.bold('Metric'), ...results.map(r => chalk.bold.hex('#6366f1')(r.name || r.domain || '?'))],
      style: { head: [], border: ['dim'] }
    });
    rows.forEach(row => {
      const vals = results.map(r => {
        switch (row) {
          case 'Name': return r.name || 'N/A';
          case 'Score': return formatScore(r.score);
          case 'Industry': return r.industry || '-';
          case 'Founded': return r.foundedYear || '-';
          case 'Employees': return r.employeeCount || '-';
          case 'Tech Count': return String(r.techStack?.length ?? 0);
          case 'Socials Count': return String(r.socials ? Object.keys(r.socials).length : 0);
          default: return '-';
        }
      });
      table.push([row, ...vals]);
    });
    console.log(`\n${chalk.bold('Domain Comparison')}`);
    console.log(table.toString());
  });

// --- monitor ---
const monitorCmd = program.command('monitor').description('Manage domain monitors');

monitorCmd.command('add')
  .description('Add a URL to monitor for changes')
  .argument('<url>', 'URL to monitor')
  .option('-i, --interval <interval>', 'Check interval (daily, hourly, weekly)', 'daily')
  .action(async (url, opts) => {
    await apiFetch('/v1/monitor', {
      method: 'POST',
      body: { url, interval: opts.interval },
      label: `Adding monitor for ${url}...`,
      successLabel: 'Monitor added'
    });
  });

monitorCmd.command('list')
  .description('List all active monitors')
  .option('-j, --json', 'Output as JSON')
  .action(async (opts) => {
    const data = await apiFetch('/v1/monitor', { label: 'Fetching monitors...' });
    if (opts.json) return printJson(data);
    const monitors = Array.isArray(data) ? data : (data.monitors || []);
    if (!monitors.length) {
      console.log(chalk.yellow('No active monitors.'));
      return;
    }
    const table = new Table({
      head: [chalk.bold('ID'), chalk.bold('URL'), chalk.bold('Interval'), chalk.bold('Status')],
      style: { head: [], border: ['dim'] }
    });
    monitors.forEach(m => {
      table.push([m.id || m._id, m.url, m.interval || 'daily', m.status || 'active']);
    });
    console.log(table.toString());
  });

monitorCmd.command('remove')
  .description('Remove a monitor')
  .argument('<id>', 'Monitor ID to remove')
  .action(async (id) => {
    await apiFetch(`/v1/monitor/${id}`, {
      method: 'DELETE',
      label: 'Removing monitor...',
      successLabel: 'Monitor removed'
    });
  });

// --- market ---
program.command('market')
  .description('Get market map for a sector/location')
  .argument('<query>', 'Market description (e.g. "Indian real estate CRM")')
  .option('-l, --location <location>', 'Filter by location')
  .option('-j, --json', 'Output as JSON')
  .action(async (query, opts) => {
    const params = new URLSearchParams({ query });
    if (opts.location) params.set('location', opts.location);
    const data = await apiFetch(`/v1/market?${params}`, { label: 'Mapping market...' });
    if (opts.json) return printJson(data);
    console.log(`\n${chalk.bold.hex('#6366f1')('Market Map')}: ${query}${opts.location ? ` in ${opts.location}` : ''}`);
    if (data.competitors?.length) {
      console.log(`\n${chalk.bold('Competitors:')}`);
      data.competitors.forEach(c => console.log(`  ${chalk.cyan(c.name || c.domain)} ${c.score ? `(${formatScore(c.score)})` : ''}`));
    }
    if (data.insights) {
      console.log(`\n${chalk.bold('Insights:')}\n  ${data.insights}`);
    }
  });

// --- brief ---
program.command('brief')
  .description('Generate a pre-call sales brief for a domain')
  .argument('<domain>', 'Domain to research')
  .option('-p, --product <product>', 'Your product name for context')
  .option('-j, --json', 'Output as JSON')
  .action(async (domain, opts) => {
    const params = new URLSearchParams({ domain });
    if (opts.product) params.set('product', opts.product);
    const data = await apiFetch(`/v1/brief?${params}`, { label: 'Generating sales brief...' });
    if (opts.json) return printJson(data);
    console.log(`\n${chalk.bold.hex('#6366f1')('Sales Brief')}: ${domain}`);
    if (data.companyName) console.log(`  ${chalk.cyan('Company:')}  ${data.companyName}`);
    if (data.oneLiner) console.log(`  ${chalk.cyan('About:')}     ${data.oneLiner}`);
    if (data.recommendedAngle) console.log(`\n  ${chalk.bold('Recommended Angle:')}\n  ${data.recommendedAngle}`);
    if (data.talkingPoints?.length) {
      console.log(`\n  ${chalk.bold('Talking Points:')}`);
      data.talkingPoints.forEach(p => console.log(`  ${chalk.green('•')} ${p}`));
    }
    if (data.painPoints?.length) {
      console.log(`\n  ${chalk.bold('Pain Points:')}`);
      data.painPoints.forEach(p => console.log(`  ${chalk.yellow('•')} ${p}`));
    }
  });

// --- export ---
program.command('export')
  .description('Export all data in a format')
  .option('-f, --format <format>', 'Export format (json, csv)', 'json')
  .action(async (opts) => {
    const data = await apiFetch('/v1/export', { label: 'Exporting data...' });
    if (opts.format === 'json') {
      printJson(data);
    } else {
      console.log(data);
    }
  });

// --- credits ---
program.command('credits')
  .description('Check your WebIntel credit balance')
  .action(async () => {
    const data = await apiFetch('/v1/credits', { label: 'Checking credits...' });
    console.log(`\n${chalk.bold('Credit Balance')}`);
    console.log(`  ${chalk.cyan('Remaining:')} ${chalk.bold(String(data.credits ?? data.remaining ?? 0))}`);
    if (data.total) console.log(`  ${chalk.cyan('Total:')}    ${data.total}`);
    if (data.used) console.log(`  ${chalk.cyan('Used:')}     ${data.used}`);
  });

function formatScore(score) {
  if (score == null) return chalk.dim('--');
  if (score >= 7) return chalk.green(String(score));
  if (score >= 4) return chalk.yellow(String(score));
  return chalk.red(String(score));
}

program
  .name('webintel')
  .description('WebIntel CLI — domain intelligence from your terminal')
  .version('1.0.0');

program.parse(process.argv);
