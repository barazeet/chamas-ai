import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { searchKnowledge, toFtsQuery } from '../src/retrieval';

const db = () => (env as { DB: D1Database }).DB;

describe('toFtsQuery', () => {
  it('builds an OR query of quoted terms, dropping short words', () => {
    expect(toFtsQuery('what is he working on?')).toBe('"what" OR "working"');
  });

  it('returns empty string when nothing usable', () => {
    expect(toFtsQuery('a an it')).toBe('');
  });
});

describe('searchKnowledge', () => {
  it('finds the tech-stack entry for a site question', async () => {
    const rows = await searchKnowledge(db(), 'how was this site built?');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].topic).toBe('How was this site built?');
  });

  it('finds career info for a projects question', async () => {
    const rows = await searchKnowledge(db(), 'tell me about his projects');
    expect(rows.some((r) => r.category === 'career')).toBe(true);
  });

  it('returns empty array for empty-ish queries', async () => {
    expect(await searchKnowledge(db(), 'hmm')).toEqual([]);
  });
});
