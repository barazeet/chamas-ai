export interface KnowledgeEntry {
  id: number;
  topic: string;
  answer: string;
  tags: string;
  category: string;
  lang: string;
}

export function toFtsQuery(raw: string): string {
  const terms = raw
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, 8);
  return terms.map((t) => `"${t.replace(/"/g, '""')}"`).join(' OR ');
}

export async function searchKnowledge(
  db: D1Database,
  query: string,
  limit = 5,
): Promise<KnowledgeEntry[]> {
  const match = toFtsQuery(query);
  if (!match) return [];
  const { results } = await db
    .prepare(
      `SELECT e.id, e.topic, e.answer, e.tags, e.category, e.lang
       FROM entries_fts f
       JOIN entries e ON e.id = f.rowid
       WHERE entries_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
    )
    .bind(match, limit)
    .all<KnowledgeEntry>();
  return results ?? [];
}
