import { env } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import { searchKnowledge, toFtsQuery } from '../src/retrieval';

const db = () => (env as { DB: D1Database }).DB;

describe('toFtsQuery', () => {
  it('builds an OR query of quoted terms', () => {
    expect(toFtsQuery('what is he working on?')).toBe(
      '"what" OR "is" OR "he" OR "working" OR "on"',
    );
  });

  it('returns empty string when nothing usable', () => {
    expect(toFtsQuery('a I o')).toBe('');
  });

  it('keeps short high-value terms like AI, 3D, JS', () => {
    const q = toFtsQuery('does he use AI and 3D in JS?');
    expect(q).toContain('"AI"');
    expect(q).toContain('"3D"');
    expect(q).toContain('"JS"');
  });

  it('strips Arabic diacritics without shattering words', () => {
    const q = toFtsQuery('الْمَشَارِيع');
    expect(q).not.toBe('');
    expect(q).toContain('المشاريع');
  });

  it('leaves precomposed accented characters intact', () => {
    expect(toFtsQuery('où travaille-t-il?')).toContain('"où"');
  });

  it('neutralizes FTS5 metacharacters and operators', () => {
    for (const raw of ['" OR "1" OR "', 'NEAR(1 2)', 'work*', 'topic:work']) {
      const q = toFtsQuery(raw);
      expect(q).not.toContain('(');
      expect(q).not.toContain('*');
      expect(q).not.toContain(':');
      expect(q).not.toContain('"1"');
    }
    expect(toFtsQuery('work*')).toBe('"work"');
    expect(toFtsQuery('topic:work')).toBe('"topic" OR "work"');
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

  it('returns empty array when the query sanitizes to nothing', async () => {
    expect(await searchKnowledge(db(), '!!!')).toEqual([]);
  });

  it('does not throw on injection-style input', async () => {
    await expect(searchKnowledge(db(), '" OR "1" OR "')).resolves.toBeDefined();
  });

  it('finds an Arabic entry from a vocalized query', async () => {
    const d = db();
    await d
      .prepare(`INSERT INTO entries (topic, answer, tags, category) VALUES (?, ?, ?, ?)`)
      .bind('ما هي المشاريع؟', 'مشاريعه مذكورة في قسم المشاريع.', 'مشاريع عربي', 'career')
      .run();
    try {
      const rows = await searchKnowledge(d, 'الْمَشَارِيع');
      expect(rows.some((r) => r.topic === 'ما هي المشاريع؟')).toBe(true);
    } finally {
      await d.prepare(`DELETE FROM entries WHERE topic = ?`).bind('ما هي المشاريع؟').run();
    }
  });

  it('FTS index reflects updates and deletes via triggers', async () => {
    const d = db();
    const { meta } = await d
      .prepare(`INSERT INTO entries (topic, answer) VALUES ('trigger probe', 'original text')`)
      .run();
    const id = meta.last_row_id;
    try {
      await d
        .prepare(`UPDATE entries SET answer = 'original text zxqwv' WHERE id = ?`)
        .bind(id)
        .run();
      const afterUpdate = await searchKnowledge(d, 'zxqwv');
      expect(afterUpdate.some((r) => r.id === id)).toBe(true);

      await d.prepare(`DELETE FROM entries WHERE id = ?`).bind(id).run();
      const afterDelete = await searchKnowledge(d, 'zxqwv');
      expect(afterDelete.some((r) => r.id === id)).toBe(false);
    } finally {
      await d.prepare(`DELETE FROM entries WHERE id = ?`).bind(id).run();
    }
  });
});
