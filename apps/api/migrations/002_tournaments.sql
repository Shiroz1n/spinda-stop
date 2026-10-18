CREATE TABLE tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(48) NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 48),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'locked', 'in_progress', 'completed', 'cancelled')),
  capacity smallint NOT NULL DEFAULT 4 CHECK (capacity = 4),
  invite_hash char(64) NOT NULL UNIQUE,
  invite_expires_at timestamptz NOT NULL,
  bracket_version integer NOT NULL DEFAULT 0 CHECK (bracket_version >= 0),
  champion_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX tournaments_host_created_idx ON tournaments(host_id, created_at DESC);

CREATE TABLE tournament_members (
  tournament_id uuid NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered', 'checked_in', 'left', 'removed')),
  seed smallint CHECK (seed BETWEEN 1 AND 4),
  checked_in_at timestamptz,
  friend_code_ciphertext bytea,
  friend_code_nonce bytea,
  friend_code_tag bytea,
  friend_code_created_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, user_id),
  CHECK ((friend_code_ciphertext IS NULL AND friend_code_nonce IS NULL AND friend_code_tag IS NULL AND friend_code_created_at IS NULL)
      OR (friend_code_ciphertext IS NOT NULL AND friend_code_nonce IS NOT NULL AND friend_code_tag IS NOT NULL AND friend_code_created_at IS NOT NULL))
);
CREATE INDEX tournament_members_user_idx ON tournament_members(user_id, created_at DESC);

ALTER TABLE matches ALTER COLUMN room_id DROP NOT NULL;
ALTER TABLE matches ADD COLUMN tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE matches ADD COLUMN bracket_slot smallint CHECK (bracket_slot >= 0);
ALTER TABLE matches ADD CONSTRAINT matches_event_reference_check CHECK (
  (room_id IS NOT NULL AND tournament_id IS NULL AND bracket_slot IS NULL)
  OR (room_id IS NULL AND tournament_id IS NOT NULL AND bracket_slot IS NOT NULL)
);
CREATE UNIQUE INDEX matches_tournament_slot_idx ON matches(tournament_id, round_number, bracket_slot) WHERE tournament_id IS NOT NULL;

ALTER TABLE moderation_events ALTER COLUMN room_id DROP NOT NULL;
ALTER TABLE moderation_events ADD COLUMN tournament_id uuid REFERENCES tournaments(id) ON DELETE CASCADE;
ALTER TABLE moderation_events ADD CONSTRAINT moderation_events_event_reference_check CHECK (
  (room_id IS NOT NULL AND tournament_id IS NULL)
  OR (room_id IS NULL AND tournament_id IS NOT NULL)
);
