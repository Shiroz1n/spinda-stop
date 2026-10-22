CREATE TABLE users (
  id TEXT PRIMARY KEY CHECK (length(id) = 36 AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  provider TEXT NOT NULL CHECK (provider IN ('github', 'test')),
  provider_subject TEXT NOT NULL,
  handle TEXT NOT NULL CHECK (length(handle) BETWEEN 1 AND 39),
  is_moderator INTEGER NOT NULL DEFAULT 0 CHECK (is_moderator IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  disabled_at TEXT,
  UNIQUE (provider, provider_subject)
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX sessions_user_id_idx ON sessions(user_id);

CREATE TABLE oauth_states (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE teams (
  id TEXT PRIMARY KEY CHECK (length(id) = 36 AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 48),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  data_json TEXT NOT NULL CHECK (json_valid(data_json)),
  schema_version INTEGER NOT NULL CHECK (schema_version = 1),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX teams_owner_updated_idx ON teams(owner_id, updated_at DESC);
CREATE INDEX teams_public_updated_idx ON teams(updated_at DESC) WHERE visibility = 'public';

CREATE TABLE rooms (
  id TEXT PRIMARY KEY CHECK (length(id) = 36 AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  host_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 48),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'in_progress', 'completed', 'cancelled')),
  capacity INTEGER NOT NULL DEFAULT 2 CHECK (capacity = 2),
  invite_hash TEXT NOT NULL UNIQUE CHECK (length(invite_hash) = 64),
  invite_expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  locked_at TEXT,
  finished_at TEXT
);
CREATE INDEX rooms_host_created_idx ON rooms(host_id, created_at DESC);

CREATE TABLE room_members (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'left', 'removed')),
  checked_in_at TEXT,
  friend_code_ciphertext BLOB,
  friend_code_nonce BLOB,
  friend_code_tag BLOB,
  friend_code_created_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (room_id, user_id),
  CHECK ((friend_code_ciphertext IS NULL AND friend_code_nonce IS NULL AND friend_code_tag IS NULL AND friend_code_created_at IS NULL)
      OR (friend_code_ciphertext IS NOT NULL AND friend_code_nonce IS NOT NULL AND friend_code_tag IS NOT NULL AND friend_code_created_at IS NOT NULL))
);
CREATE INDEX room_members_user_idx ON room_members(user_id, created_at DESC);
