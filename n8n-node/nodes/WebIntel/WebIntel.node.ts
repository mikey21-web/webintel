import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

export class WebIntel implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'WebIntel',
    name: 'webIntel',
    icon: 'file:webintel.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: 'Interact with WebIntel API for web intelligence',
    defaults: { name: 'WebIntel' },
    inputs: ['main'],
    outputs: ['main'],
    credentials: [{ name: 'webIntelApi', required: true }],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Scrape Markdown', value: 'scrapeMarkdown', description: 'Scrape a URL and return markdown' },
          { name: 'Scrape HTML', value: 'scrapeHtml', description: 'Scrape a URL and return raw HTML' },
          { name: 'Brand Profile', value: 'brandProfile', description: 'Get brand profile for a domain' },
          { name: 'Brand Colors', value: 'brandColors', description: 'Extract brand colors from a domain' },
          { name: 'Brand Tech Stack', value: 'brandTechStack', description: 'Detect technology stack of a domain' },
          { name: 'Competitor Intel', value: 'competitorIntel', description: 'Get competitive intelligence' },
          { name: 'Market Map', value: 'marketMap', description: 'Map market landscape by keyword' },
          { name: 'Lead Intel', value: 'leadIntel', description: 'Research leads/companies' },
          { name: 'Sales Brief', value: 'salesBrief', description: 'Generate a sales brief' },
          { name: 'Pricing Intel', value: 'pricingIntel', description: 'Extract pricing information' },
          { name: 'Poll Job', value: 'pollJob', description: 'Poll an async job for results' },
          { name: 'Create Monitor', value: 'createMonitor', description: 'Create a website monitor' },
          { name: 'Generate Report', value: 'generateReport', description: 'Generate a PDF report' },
        ],
        default: 'scrapeMarkdown',
      },
      {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: ['scrapeMarkdown', 'scrapeHtml'],
          },
        },
        description: 'The URL to scrape',
      },
      {
        displayName: 'Wait For (ms)',
        name: 'waitFor',
        type: 'number',
        default: 0,
        displayOptions: {
          show: { operation: ['scrapeMarkdown'] },
        },
        description: 'Milliseconds to wait after page load for JavaScript rendering',
      },
      {
        displayName: 'Screenshot',
        name: 'screenshot',
        type: 'boolean',
        default: false,
        displayOptions: {
          show: { operation: ['scrapeMarkdown'] },
        },
        description: 'Whether to capture a screenshot',
      },
      {
        displayName: 'Domain',
        name: 'domain',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: ['brandProfile', 'brandColors', 'brandTechStack'],
          },
        },
        description: 'The domain to analyze (e.g. example.com)',
      },
      {
        displayName: 'Domain',
        name: 'domain',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { operation: ['competitorIntel', 'pricingIntel'] },
        },
        description: 'The target domain',
      },
      {
        displayName: 'Depth',
        name: 'depth',
        type: 'number',
        default: 1,
        displayOptions: {
          show: { operation: ['competitorIntel'] },
        },
        description: 'Analysis depth (1-3)',
      },
      {
        displayName: 'Keyword',
        name: 'keyword',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { operation: ['marketMap'] },
        },
        description: 'Keyword or industry to map',
      },
      {
        displayName: 'Location',
        name: 'location',
        type: 'string',
        default: '',
        displayOptions: {
          show: { operation: ['marketMap'] },
        },
        description: 'Geographic location filter',
      },
      {
        displayName: 'Domains',
        name: 'domains',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { operation: ['leadIntel'] },
        },
        description: 'Comma-separated list of domains to research',
      },
      {
        displayName: 'Context',
        name: 'context',
        type: 'string',
        default: '',
        displayOptions: {
          show: { operation: ['leadIntel'] },
        },
        description: 'Additional context for lead research',
      },
      {
        displayName: 'Target Domain',
        name: 'targetDomain',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { operation: ['salesBrief'] },
        },
        description: 'The domain of the target company',
      },
      {
        displayName: 'Your Product',
        name: 'yourProduct',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { operation: ['salesBrief'] },
        },
        description: 'Describe your product or service',
      },
      {
        displayName: 'Job ID',
        name: 'jobId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { operation: ['pollJob'] },
        },
        description: 'The job ID to poll',
      },
      {
        displayName: 'Monitor Name',
        name: 'monitorName',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { operation: ['createMonitor'] },
        },
      },
      {
        displayName: 'URLs',
        name: 'monitorUrls',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { operation: ['createMonitor'] },
        },
        description: 'Comma-separated list of URLs to monitor',
      },
      {
        displayName: 'Interval (minutes)',
        name: 'interval',
        type: 'number',
        default: 60,
        displayOptions: {
          show: { operation: ['createMonitor'] },
        },
      },
      {
        displayName: 'Alert Channel',
        name: 'alertChannel',
        type: 'options',
        options: [
          { name: 'Email', value: 'email' },
          { name: 'Webhook', value: 'webhook' },
          { name: 'Slack', value: 'slack' },
        ],
        default: 'email',
        displayOptions: {
          show: { operation: ['createMonitor'] },
        },
      },
      {
        displayName: 'Job ID (for report)',
        name: 'reportJobId',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: { operation: ['generateReport'] },
        },
      },
      {
        displayName: 'Format',
        name: 'format',
        type: 'options',
        options: [
          { name: 'PDF', value: 'pdf' },
          { name: 'Markdown', value: 'markdown' },
          { name: 'HTML', value: 'html' },
        ],
        default: 'pdf',
        displayOptions: {
          show: { operation: ['generateReport'] },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const credentials = await this.getCredentials('webIntelApi');
    const baseUrl = credentials.baseUrl as string;
    const apiKey = credentials.apiKey as string;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
    };

    for (let i = 0; i < items.length; i++) {
      try {
        const operation = this.getNodeParameter('operation', i) as string;
        let method = 'GET';
        let endpoint = '';
        let body: object | undefined;

        switch (operation) {
          case 'scrapeMarkdown': {
            method = 'POST';
            endpoint = '/v1/web/scrape/markdown';
            body = {
              url: this.getNodeParameter('url', i) as string,
              waitFor: this.getNodeParameter('waitFor', i) as number,
              screenshot: this.getNodeParameter('screenshot', i) as boolean,
            };
            break;
          }
          case 'scrapeHtml': {
            method = 'POST';
            endpoint = '/v1/web/scrape/html';
            body = { url: this.getNodeParameter('url', i) as string };
            break;
          }
          case 'brandProfile': {
            method = 'GET';
            endpoint = `/v1/brand/profile?domain=${encodeURIComponent(this.getNodeParameter('domain', i) as string)}`;
            break;
          }
          case 'brandColors': {
            method = 'GET';
            endpoint = `/v1/brand/colors?domain=${encodeURIComponent(this.getNodeParameter('domain', i) as string)}`;
            break;
          }
          case 'brandTechStack': {
            method = 'GET';
            endpoint = `/v1/brand/techstack?domain=${encodeURIComponent(this.getNodeParameter('domain', i) as string)}`;
            break;
          }
          case 'competitorIntel': {
            method = 'POST';
            endpoint = '/v1/intel/competitor';
            body = {
              domain: this.getNodeParameter('domain', i) as string,
              depth: this.getNodeParameter('depth', i) as number,
            };
            break;
          }
          case 'marketMap': {
            method = 'POST';
            endpoint = '/v1/intel/market-map';
            body = {
              keyword: this.getNodeParameter('keyword', i) as string,
              location: this.getNodeParameter('location', i) as string,
            };
            break;
          }
          case 'leadIntel': {
            method = 'POST';
            endpoint = '/v1/intel/lead';
            const domainsStr = this.getNodeParameter('domains', i) as string;
            body = {
              domains: domainsStr.split(',').map((d) => d.trim()),
              context: this.getNodeParameter('context', i) as string,
            };
            break;
          }
          case 'salesBrief': {
            method = 'POST';
            endpoint = '/v1/intel/sales-brief';
            body = {
              targetDomain: this.getNodeParameter('targetDomain', i) as string,
              yourProduct: this.getNodeParameter('yourProduct', i) as string,
            };
            break;
          }
          case 'pricingIntel': {
            method = 'POST';
            endpoint = '/v1/intel/pricing';
            body = { domain: this.getNodeParameter('domain', i) as string };
            break;
          }
          case 'pollJob': {
            method = 'GET';
            const jobId = this.getNodeParameter('jobId', i) as string;
            endpoint = `/v1/intel/${encodeURIComponent(jobId)}`;
            break;
          }
          case 'createMonitor': {
            method = 'POST';
            endpoint = '/v1/monitor';
            const urlsStr = this.getNodeParameter('monitorUrls', i) as string;
            body = {
              name: this.getNodeParameter('monitorName', i) as string,
              urls: urlsStr.split(',').map((u) => u.trim()),
              interval: this.getNodeParameter('interval', i) as number,
              alertChannel: this.getNodeParameter('alertChannel', i) as string,
            };
            break;
          }
          case 'generateReport': {
            method = 'POST';
            endpoint = '/v1/reports/generate';
            body = {
              jobId: this.getNodeParameter('reportJobId', i) as string,
              format: this.getNodeParameter('format', i) as string,
            };
            break;
          }
          default:
            throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
        }

        const options: any = {
          method,
          headers,
          uri: `${baseUrl}${endpoint}`,
          json: true,
        };

        if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
          options.body = body;
        }

        const response = await this.helpers.request(options);
        returnData.push({ json: response as any });
      } catch (error: any) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: error.message } });
          continue;
        }
        throw error;
      }
    }

    return this.prepareOutputData(returnData);
  }
}
