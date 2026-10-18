CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('github', 'test')),
  provider_subject text NOT NULL,
  handle text NOT NULL CHECK (length(handle) BETWEEN 1 AND 39),
  is_moderator boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  UNIQUE (provider, provider_subject)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash char(64) PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS oauth_states (
  token_hash char(64) PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(48) NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 48),
  visibility text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  data_json jsonb NOT NULL,
  schema_version integer NOT NULL CHECK (schema_version = 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS teams_owner_updated_idx ON teams(owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS teams_public_updated_idx ON teams(updated_at DESC) WHERE visibility = 'public';

CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES users(id),
  name varchar(48) NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 48),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'in_progress', 'completed', 'cancelled')),
  capacity smallint NOT NULL DEFAULT 2 CHECK (capacity = 2),
  invite_hash char(64) NOT NULL UNIQUE,
  invite_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS rooms_host_created_idx ON rooms(host_id, created_at DESC);

CREATE TABLE IF NOT EXISTS room_members (
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'left', 'removed')),
  checked_in_at timestamptz,
  friend_code_ciphertext bytea,
  friend_code_nonce bytea,
  friend_code_tag bytea,
  friend_code_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, user_id),
  CHECK ((friend_code_ciphertext IS NULL AND friend_code_nonce IS NULL AND friend_code_tag IS NULL AND friend_code_created_at IS NULL)
      OR (friend_code_ciphertext IS NOT NULL AND friend_code_nonce IS NOT NULL AND friend_code_tag IS NOT NULL AND friend_code_created_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS room_members_user_idx ON room_members(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  round_number smallint NOT NULL DEFAULT 1 CHECK (round_number > 0),
  player_a_id uuid NOT NULL REFERENCES users(id),
  player_b_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'awaiting_confirmation', 'confirmed', 'disputed', 'void')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (player_a_id <> player_b_id),
  UNIQUE (room_id, round_number, player_a_id, player_b_id)
);

CREATE TABLE IF NOT EXISTS match_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES users(id),
  winner_id uuid NOT NULL REFERENCES users(id),
  note varchar(250) NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL UNIQUE REFERENCES matches(id) ON DELETE CASCADE,
  opened_by uuid NOT NULL REFERENCES users(id),
  reason varchar(500) NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'confirmed', 'void')),
  resolution varchar(500),
  moderator_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE TABLE IF NOT EXISTS moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES users(id),
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  target_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  reason varchar(500) NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
