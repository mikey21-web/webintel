import { ICredentialType, INodeProperties } from 'n8n-workflow';

export class WebIntelApi implements ICredentialType {
  name = 'webIntelApi';
  displayName = 'WebIntel API';
  documentationUrl = 'https://webintel.diyaaaa.in/docs';
  properties: INodeProperties[] = [
    { displayName: 'API Key', name: 'apiKey', type: 'string', typeOptions: { password: true }, default: '' },
    { displayName: 'Base URL', name: 'baseUrl', type: 'string', default: 'https://webintel.diyaaaa.in' },
  ];
}
