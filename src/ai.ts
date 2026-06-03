import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { config } from './config';

let anthropic: Anthropic | null = null;
let openai: OpenAI | null = null;

if (config.ANTHROPIC_API_KEY) {
  anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });
}

if (config.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: config.OPENAI_API_KEY });
}

export async function askAI<T>(system: string, prompt: string, format: 'json' | 'text' = 'json'): Promise<T> {
  if (openai) {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4096,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      response_format: format === 'json' ? { type: 'json_object' } : undefined,
    });
    const text = response.choices[0]?.message?.content || '';
    if (format === 'json') return JSON.parse(text) as T;
    return text as unknown as T;
  }

  if (anthropic) {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    if (format === 'json') {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('AI did not return valid JSON');
      return JSON.parse(jsonMatch[0]) as T;
    }
    return text as unknown as T;
  }

  throw new Error('No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
}
