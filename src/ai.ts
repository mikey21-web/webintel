import Anthropic from '@anthropic-ai/sdk';
import { config } from './config';

const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

export async function askClaude<T>(system: string, prompt: string, format: 'json' | 'text' = 'json'): Promise<T> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: prompt }],
  });
  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  if (format === 'json') {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Claude did not return valid JSON');
    return JSON.parse(jsonMatch[0]) as T;
  }
  return text as unknown as T;
}
