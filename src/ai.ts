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

function extractJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as T;
      } catch {
        throw new Error('AI returned invalid JSON: ' + text.slice(0, 200));
      }
    }
    throw new Error('AI returned invalid JSON: ' + text.slice(0, 200));
  }
}

export async function askAI<T>(system: string, prompt: string, format: 'json' | 'text' = 'json'): Promise<T> {
  const providers: { label: string; fn: () => Promise<T> }[] = [];

  if (openai) {
    providers.push({
      label: 'openai',
      fn: async () => {
        const response = await openai!.chat.completions.create({
          model: config.OPENAI_MODEL || 'gpt-4o',
          max_tokens: 8192,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: prompt },
          ],
          response_format: format === 'json' ? { type: 'json_object' } : undefined,
        });
        const text = response.choices[0]?.message?.content || '';
        if (format === 'json') return extractJson<T>(text);
        return text as unknown as T;
      },
    });
  }

  if (anthropic) {
    providers.push({
      label: 'anthropic',
      fn: async () => {
        const response = await anthropic!.messages.create({
          model: config.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          system,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '';
        if (format === 'json') return extractJson<T>(text);
        return text as unknown as T;
      },
    });
  }

  if (providers.length === 0) {
    throw new Error('No AI provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY');
  }

  const errors: { label: string; error: unknown }[] = [];
  for (const provider of providers) {
    try {
      return await provider.fn();
    } catch (err) {
      errors.push({ label: provider.label, error: err });
    }
  }

  const detail = errors.map(e => `${e.label}: ${e.error instanceof Error ? e.error.message : e.error}`).join('; ');
  throw new Error(`All AI providers failed: ${detail}`);
}
