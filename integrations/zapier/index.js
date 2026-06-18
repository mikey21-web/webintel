const { createApp } = require('zapier-platform-core');

const App = createApp({
  version: require('./package.json').version,
  platformVersion: require('zapier-platform-core').version,

  authentication: {
    type: 'custom',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'string',
        required: true,
        helpText: 'Your WebIntel API key (starts with wi_)',
      },
    ],
    test: {
      url: 'https://api.webintel.dev/health',
      headers: {
        Authorization: 'Bearer {{bundle.authData.apiKey}}',
      },
    },
  },

  beforeRequest: [
    (request, z, bundle) => {
      request.headers['Authorization'] = `Bearer ${bundle.authData.apiKey}`;
      request.headers['Content-Type'] = 'application/json';
      return request;
    },
  ],

  afterResponse: [
    (response, z, bundle) => {
      if (response.status === 401) {
        throw new z.errors.Error('Invalid API Key', 'AuthenticationError', response.status);
      }
      if (response.status >= 400) {
        throw new z.errors.Error(
          response.content ? JSON.parse(response.content).error : 'Unknown error',
          'APIError',
          response.status,
        );
      }
      return response;
    },
  ],

  searches: {
    brand_profile: {
      key: 'brand_profile',
      noun: 'Brand Profile',
      display: {
        label: 'Lookup Brand',
        description: 'Look up brand intelligence data for a domain.',
      },
      operation: {
        inputFields: [
          { key: 'domain', label: 'Domain', type: 'string', required: true, helpText: 'Domain to look up (e.g. stripe.com)' },
        ],
        perform: (z, bundle) => {
          const url = `https://api.webintel.dev/v1/brand/profile?domain=${encodeURIComponent(bundle.inputData.domain)}`;
          return z.request(url).then(res => {
            const data = JSON.parse(res.content);
            return [data];
          });
        },
      },
    },
  },

  creates: {
    scrape_webpage: {
      key: 'scrape_webpage',
      noun: 'Scraped Page',
      display: {
        label: 'Scrape Webpage',
        description: 'Scrape a URL to clean markdown text.',
      },
      operation: {
        inputFields: [
          { key: 'url', label: 'URL', type: 'string', required: true, helpText: 'URL to scrape' },
        ],
        perform: (z, bundle) => {
          return z.request({
            url: 'https://api.webintel.dev/v1/web/scrape/markdown',
            method: 'POST',
            body: { url: bundle.inputData.url },
          }).then(res => JSON.parse(res.content));
        },
      },
    },
    extract_data: {
      key: 'extract_data',
      noun: 'Extracted Data',
      display: {
        label: 'Extract Data',
        description: 'Extract structured data from a URL using AI.',
      },
      operation: {
        inputFields: [
          { key: 'url', label: 'URL', type: 'string', required: true, helpText: 'URL to extract from' },
          { key: 'schema', label: 'JSON Schema', type: 'text', required: false, helpText: 'Optional JSON Schema defining fields to extract' },
        ],
        perform: (z, bundle) => {
          const body = { url: bundle.inputData.url };
          if (bundle.inputData.schema) {
            try { body.schema = JSON.parse(bundle.inputData.schema); } catch {}
          }
          return z.request({
            url: 'https://api.webintel.dev/v1/web/extract',
            method: 'POST',
            body,
          }).then(res => JSON.parse(res.content));
        },
      },
    },
    crawl_domain: {
      key: 'crawl_domain',
      noun: 'Crawl Job',
      display: {
        label: 'Crawl Domain',
        description: 'Start a crawl of a domain.',
      },
      operation: {
        inputFields: [
          { key: 'url', label: 'URL', type: 'string', required: true, helpText: 'Starting URL' },
          { key: 'maxPages', label: 'Max Pages', type: 'integer', required: false, default: '50' },
        ],
        perform: (z, bundle) => {
          return z.request({
            url: 'https://api.webintel.dev/v1/web/crawl',
            method: 'POST',
            body: { url: bundle.inputData.url, maxPages: bundle.inputData.maxPages || 50 },
          }).then(res => JSON.parse(res.content));
        },
      },
    },
    search_web: {
      key: 'search_web',
      noun: 'Search Results',
      display: {
        label: 'Search Web',
        description: 'Search the web and get results.',
      },
      operation: {
        inputFields: [
          { key: 'query', label: 'Search Query', type: 'string', required: true },
          { key: 'numResults', label: 'Number of Results', type: 'integer', required: false, default: '10' },
        ],
        perform: (z, bundle) => {
          return z.request({
            url: 'https://api.webintel.dev/v1/web/search',
            method: 'POST',
            body: { query: bundle.inputData.query, numResults: bundle.inputData.numResults || 10 },
          }).then(res => JSON.parse(res.content));
        },
      },
    },
    identify_transaction: {
      key: 'identify_transaction',
      noun: 'Transaction',
      display: {
        label: 'Identify Transaction',
        description: 'Identify merchant from a bank transaction descriptor.',
      },
      operation: {
        inputFields: [
          { key: 'descriptor', label: 'Transaction Descriptor', type: 'string', required: true, helpText: 'e.g. "AMZN MKTP US*2K8F7G1"' },
        ],
        perform: (z, bundle) => {
          return z.request({
            url: 'https://api.webintel.dev/v1/brand/transaction',
            method: 'POST',
            body: { descriptor: bundle.inputData.descriptor },
          }).then(res => JSON.parse(res.content));
        },
      },
    },
  },
});

module.exports = App;
