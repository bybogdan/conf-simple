CREATE TABLE workspace_invitations (
  token_hash TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')),
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (workspace_id, email)
);

CREATE INDEX workspace_invitations_expires_at_idx
  ON workspace_invitations(expires_at);

CREATE INDEX workspace_members_user_id_idx
  ON workspace_members(user_id);
