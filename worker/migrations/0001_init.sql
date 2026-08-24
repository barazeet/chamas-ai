CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY,
  topic TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  lang TEXT NOT NULL DEFAULT 'en',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
  topic, answer, tags,
  content='entries', content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS entries_ai AFTER INSERT ON entries BEGIN
  INSERT INTO entries_fts(rowid, topic, answer, tags)
  VALUES (new.id, new.topic, new.answer, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS entries_ad AFTER DELETE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, topic, answer, tags)
  VALUES ('delete', old.id, old.topic, old.answer, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS entries_au AFTER UPDATE ON entries BEGIN
  INSERT INTO entries_fts(entries_fts, rowid, topic, answer, tags)
  VALUES ('delete', old.id, old.topic, old.answer, old.tags);
  INSERT INTO entries_fts(rowid, topic, answer, tags)
  VALUES (new.id, new.topic, new.answer, new.tags);
END;

INSERT INTO entries (topic, answer, tags, category) VALUES
  ('Who are you?', 'I am the digital version of the site owner — ask me about his work, projects and experience.', 'about intro who', 'core'),
  ('What does he work on?', 'He builds software. The Projects section has the highlights, or ask me about something specific.', 'work projects career stack', 'career'),
  ('How was this site built?', 'This site is a Three.js scene with a 3D avatar, a Cloudflare Worker, a D1 knowledge base, and an LLM doing the talking.', 'site tech how built meta', 'meta');
