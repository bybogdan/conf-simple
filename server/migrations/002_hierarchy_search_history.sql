CREATE TABLE page_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_json TEXT NOT NULL,
  author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('created', 'save', 'restore')),
  created_at TEXT NOT NULL
);

CREATE INDEX page_revisions_page_created_idx
  ON page_revisions(page_id, created_at DESC, id DESC);

INSERT INTO page_revisions (page_id, title, content_json, author_id, reason, created_at)
SELECT id, title, content_json, created_by, 'created', created_at FROM pages;

CREATE VIRTUAL TABLE page_search USING fts5(
  page_id UNINDEXED,
  workspace_id UNINDEXED,
  title,
  content,
  tokenize = 'unicode61'
);

INSERT INTO page_search (page_id, workspace_id, title, content)
SELECT id, workspace_id, title, content_json FROM pages;
