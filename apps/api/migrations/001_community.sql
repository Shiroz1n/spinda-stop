CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
  provider VARCHAR(16) NOT NULL,
  provider_subject VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  handle VARCHAR(39) NOT NULL,
  is_moderator BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  disabled_at DATETIME(3) NULL,
  CONSTRAINT users_provider_check CHECK (provider IN ('github', 'test')),
  CONSTRAINT users_moderator_flag_check CHECK (is_moderator IN (0, 1)),
  CONSTRAINT users_handle_length_check CHECK (CHAR_LENGTH(handle) BETWEEN 1 AND 39),
  CONSTRAINT users_provider_subject_unique UNIQUE (provider, provider_subject)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX sessions_user_id_idx (user_id),
  INDEX sessions_expiry_idx (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS oauth_states (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX oauth_states_expiry_idx (expires_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS teams (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
  owner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  name VARCHAR(48) NOT NULL,
  visibility VARCHAR(16) NOT NULL DEFAULT 'private',
  data_json JSON NOT NULL,
  schema_version INT NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX teams_owner_updated_idx (owner_id, updated_at DESC),
  INDEX teams_public_updated_idx (visibility, updated_at DESC),
  CONSTRAINT teams_name_length_check CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 48),
  CONSTRAINT teams_visibility_check CHECK (visibility IN ('private', 'public')),
  CONSTRAINT teams_schema_version_check CHECK (schema_version = 1),
  CONSTRAINT fk_teams_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS rooms (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
  host_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  name VARCHAR(48) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  capacity SMALLINT NOT NULL DEFAULT 2,
  invite_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  invite_expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  locked_at DATETIME(3) NULL,
  finished_at DATETIME(3) NULL,
  INDEX rooms_host_created_idx (host_id, created_at DESC),
  CONSTRAINT rooms_name_length_check CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 48),
  CONSTRAINT rooms_status_check CHECK (status IN ('open', 'locked', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT rooms_capacity_check CHECK (capacity = 2),
  CONSTRAINT fk_rooms_host FOREIGN KEY (host_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS room_members (
  room_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'registered',
  checked_in_at DATETIME(3) NULL,
  friend_code_ciphertext VARBINARY(512) NULL,
  friend_code_nonce VARBINARY(32) NULL,
  friend_code_tag VARBINARY(32) NULL,
  friend_code_created_at DATETIME(3) NULL,
  shared_roster_json JSON NULL,
  shared_roster_updated_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (room_id, user_id),
  INDEX room_members_user_idx (user_id, created_at DESC),
  CONSTRAINT room_members_status_check CHECK (status IN ('registered', 'checked_in', 'left', 'removed')),
  CONSTRAINT room_members_friend_code_check CHECK (
    (friend_code_ciphertext IS NULL AND friend_code_nonce IS NULL AND friend_code_tag IS NULL AND friend_code_created_at IS NULL)
    OR (friend_code_ciphertext IS NOT NULL AND friend_code_nonce IS NOT NULL AND friend_code_tag IS NOT NULL AND friend_code_created_at IS NOT NULL)
  ),
  CONSTRAINT room_members_shared_roster_check CHECK (
    shared_roster_json IS NULL OR (JSON_TYPE(shared_roster_json) = 'ARRAY' AND JSON_LENGTH(shared_roster_json) <= 6)
  ),
  CONSTRAINT fk_room_members_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_room_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS tournaments (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
  host_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  name VARCHAR(48) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  capacity SMALLINT NOT NULL DEFAULT 4,
  invite_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
  invite_expires_at DATETIME(3) NOT NULL,
  bracket_version INT NOT NULL DEFAULT 0,
  champion_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  locked_at DATETIME(3) NULL,
  started_at DATETIME(3) NULL,
  finished_at DATETIME(3) NULL,
  INDEX tournaments_host_created_idx (host_id, created_at DESC),
  CONSTRAINT tournaments_name_length_check CHECK (CHAR_LENGTH(TRIM(name)) BETWEEN 1 AND 48),
  CONSTRAINT tournaments_status_check CHECK (status IN ('open', 'locked', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT tournaments_capacity_check CHECK (capacity = 4),
  CONSTRAINT tournaments_bracket_version_check CHECK (bracket_version >= 0),
  CONSTRAINT fk_tournaments_host FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_tournaments_champion FOREIGN KEY (champion_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS tournament_members (
  tournament_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'registered',
  seed SMALLINT NULL,
  checked_in_at DATETIME(3) NULL,
  friend_code_ciphertext VARBINARY(512) NULL,
  friend_code_nonce VARBINARY(32) NULL,
  friend_code_tag VARBINARY(32) NULL,
  friend_code_created_at DATETIME(3) NULL,
  shared_roster_json JSON NULL,
  shared_roster_updated_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (tournament_id, user_id),
  INDEX tournament_members_user_idx (user_id, created_at DESC),
  CONSTRAINT tournament_members_status_check CHECK (status IN ('registered', 'checked_in', 'left', 'removed')),
  CONSTRAINT tournament_members_seed_check CHECK (seed IS NULL OR seed BETWEEN 1 AND 4),
  CONSTRAINT tournament_members_friend_code_check CHECK (
    (friend_code_ciphertext IS NULL AND friend_code_nonce IS NULL AND friend_code_tag IS NULL AND friend_code_created_at IS NULL)
    OR (friend_code_ciphertext IS NOT NULL AND friend_code_nonce IS NOT NULL AND friend_code_tag IS NOT NULL AND friend_code_created_at IS NOT NULL)
  ),
  CONSTRAINT tournament_members_shared_roster_check CHECK (
    shared_roster_json IS NULL OR (JSON_TYPE(shared_roster_json) = 'ARRAY' AND JSON_LENGTH(shared_roster_json) <= 6)
  ),
  CONSTRAINT fk_tournament_members_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  CONSTRAINT fk_tournament_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS matches (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
  room_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  tournament_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  round_number SMALLINT NOT NULL DEFAULT 1,
  bracket_slot SMALLINT NULL,
  player_a_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  player_b_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'scheduled',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3) NULL,
  UNIQUE INDEX matches_room_pair_unique (room_id, round_number, player_a_id, player_b_id),
  UNIQUE INDEX matches_tournament_slot_unique (tournament_id, round_number, bracket_slot),
  INDEX matches_room_created_idx (room_id, created_at DESC),
  CONSTRAINT matches_round_number_check CHECK (round_number > 0),
  CONSTRAINT matches_bracket_slot_check CHECK (bracket_slot IS NULL OR bracket_slot >= 0),
  CONSTRAINT matches_players_check CHECK (player_a_id <> player_b_id),
  CONSTRAINT matches_event_reference_check CHECK (
    (room_id IS NOT NULL AND tournament_id IS NULL AND bracket_slot IS NULL)
    OR (room_id IS NULL AND tournament_id IS NOT NULL AND bracket_slot IS NOT NULL)
  ),
  CONSTRAINT matches_status_check CHECK (status IN ('scheduled', 'awaiting_confirmation', 'confirmed', 'disputed', 'void')),
  CONSTRAINT fk_matches_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_matches_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  CONSTRAINT fk_matches_player_a FOREIGN KEY (player_a_id) REFERENCES users(id),
  CONSTRAINT fk_matches_player_b FOREIGN KEY (player_b_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS match_reports (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
  match_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL UNIQUE,
  reporter_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  winner_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  note VARCHAR(250) NOT NULL DEFAULT '',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_match_reports_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  CONSTRAINT fk_match_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id),
  CONSTRAINT fk_match_reports_winner FOREIGN KEY (winner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS disputes (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
  match_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL UNIQUE,
  opened_by CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  reason VARCHAR(500) NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'open',
  resolution VARCHAR(500) NULL,
  moderator_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  resolved_at DATETIME(3) NULL,
  CONSTRAINT disputes_reason_length_check CHECK (CHAR_LENGTH(TRIM(reason)) BETWEEN 1 AND 500),
  CONSTRAINT disputes_status_check CHECK (status IN ('open', 'confirmed', 'void')),
  CONSTRAINT fk_disputes_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE,
  CONSTRAINT fk_disputes_opened_by FOREIGN KEY (opened_by) REFERENCES users(id),
  CONSTRAINT fk_disputes_moderator FOREIGN KEY (moderator_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS moderation_events (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci PRIMARY KEY,
  actor_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  room_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  tournament_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  target_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL,
  action VARCHAR(64) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT moderation_events_reason_check CHECK (CHAR_LENGTH(TRIM(reason)) BETWEEN 1 AND 500),
  CONSTRAINT moderation_events_event_reference_check CHECK (
    (room_id IS NOT NULL AND tournament_id IS NULL)
    OR (room_id IS NULL AND tournament_id IS NOT NULL)
  ),
  CONSTRAINT fk_moderation_events_actor FOREIGN KEY (actor_id) REFERENCES users(id),
  CONSTRAINT fk_moderation_events_room FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
  CONSTRAINT fk_moderation_events_tournament FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  CONSTRAINT fk_moderation_events_target FOREIGN KEY (target_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;

CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket_key CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
  bucket_window BIGINT NOT NULL,
  hit_count INT NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  INDEX api_rate_limits_expiry_idx (expires_at),
  CONSTRAINT api_rate_limits_hit_count_check CHECK (hit_count > 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_bin;
