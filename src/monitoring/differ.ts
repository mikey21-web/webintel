import { diffWords, Change } from 'diff';
import { createHash } from 'crypto';
import { askAI } from '../ai';

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function diffContent(oldText: string, newText: string): string {
  const changes = diffWords(oldText, newText);
  return changes.map((c: Change) => {
    if (c.added) return `+${c.value}`;
    if (c.removed) return `-${c.value}`;
    return c.value;
  }).join('');
}

export interface ChangeClassification {
  summary: string;
  severity: 'low' | 'medium' | 'high';
  added: string[];
  removed: string[];
  importantChanges: string[];
}

export async function classifyChange(diff: string, url: string): Promise<ChangeClassification> {
  const result = await askAI<ChangeClassification>(
    'You are a change analyst. Classify content changes and determine their significance. Return ONLY valid JSON.',
    `Classify this content diff for URL "${url}":\n\n${diff.slice(0, 6000)}\n\nReturn JSON with: summary, severity (low/medium/high), added (array of key added items), removed (array of key removed items), importantChanges (array of notable changes).`
  ).catch(() => ({
    summary: 'Content changed on ' + url,
    severity: 'medium' as const,
    added: [],
    removed: [],
    importantChanges: ['Page content was modified'],
  }));
  return result;
}
