CREATE TABLE tournaments (
  id TEXT PRIMARY KEY CHECK (length(id) = 36 AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  host_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 48),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'in_progress', 'completed', 'cancelled')),
  capacity INTEGER NOT NULL DEFAULT 4 CHECK (capacity = 4),
  invite_hash TEXT NOT NULL UNIQUE CHECK (length(invite_hash) = 64),
  invite_expires_at TEXT NOT NULL,
  bracket_version INTEGER NOT NULL DEFAULT 0 CHECK (bracket_version >= 0),
  champion_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  locked_at TEXT,
  started_at TEXT,
  finished_at TEXT
);
CREATE INDEX tournaments_host_created_idx ON tournaments(host_id, created_at DESC);

CREATE TABLE tournament_members (
  tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'left', 'removed')),
  seed INTEGER CHECK (seed BETWEEN 1 AND 4),
  checked_in_at TEXT,
  friend_code_ciphertext BLOB,
  friend_code_nonce BLOB,
  friend_code_tag BLOB,
  friend_code_created_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (tournament_id, user_id),
  CHECK ((friend_code_ciphertext IS NULL AND friend_code_nonce IS NULL AND friend_code_tag IS NULL AND friend_code_created_at IS NULL)
      OR (friend_code_ciphertext IS NOT NULL AND friend_code_nonce IS NOT NULL AND friend_code_tag IS NOT NULL AND friend_code_created_at IS NOT NULL))
);
CREATE INDEX tournament_members_user_idx ON tournament_members(user_id, created_at DESC);

CREATE TABLE matches (
  id TEXT PRIMARY KEY CHECK (length(id) = 36 AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  tournament_id TEXT REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL DEFAULT 1 CHECK (round_number > 0),
  bracket_slot INTEGER CHECK (bracket_slot >= 0),
  player_a_id TEXT NOT NULL REFERENCES users(id),
  player_b_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'awaiting_confirmation', 'confirmed', 'disputed', 'void')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at TEXT,
  CHECK (player_a_id <> player_b_id),
  CHECK ((room_id IS NOT NULL AND tournament_id IS NULL AND bracket_slot IS NULL)
      OR (room_id IS NULL AND tournament_id IS NOT NULL AND bracket_slot IS NOT NULL)),
  UNIQUE (room_id, round_number, player_a_id, player_b_id)
);
CREATE UNIQUE INDEX matches_tournament_slot_idx ON matches(tournament_id, round_number, bracket_slot) WHERE tournament_id IS NOT NULL;

CREATE TABLE match_reports (
  id TEXT PRIMARY KEY CHECK (length(id) = 36 AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  match_id TEXT NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES users(id),
  winner_id TEXT NOT NULL REFERENCES users(id),
  note TEXT NOT NULL DEFAULT '' CHECK (length(note) <= 250),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE disputes (
  id TEXT PRIMARY KEY CHECK (length(id) = 36 AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  match_id TEXT NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
  opened_by TEXT NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 500),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'void')),
  resolution TEXT CHECK (resolution IS NULL OR length(resolution) <= 500),
  moderator_id TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolved_at TEXT
);

CREATE TABLE moderation_events (
  id TEXT PRIMARY KEY CHECK (length(id) = 36 AND substr(id, 9, 1) = '-' AND substr(id, 14, 1) = '-' AND substr(id, 19, 1) = '-' AND substr(id, 24, 1) = '-' AND length(replace(id, '-', '')) = 32 AND lower(replace(id, '-', '')) NOT GLOB '*[^0-9a-f]*'),
  actor_id TEXT NOT NULL REFERENCES users(id),
  room_id TEXT REFERENCES rooms(id) ON DELETE CASCADE,
  tournament_id TEXT REFERENCES tournaments(id) ON DELETE CASCADE,
  target_user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((room_id IS NOT NULL AND tournament_id IS NULL) OR (room_id IS NULL AND tournament_id IS NOT NULL))
);
