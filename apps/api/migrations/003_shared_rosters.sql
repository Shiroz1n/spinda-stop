ALTER TABLE room_members ADD COLUMN shared_roster_json TEXT
  CHECK (shared_roster_json IS NULL OR (json_valid(shared_roster_json) AND json_type(shared_roster_json) = 'array' AND json_array_length(shared_roster_json) <= 6));
ALTER TABLE room_members ADD COLUMN shared_roster_updated_at TEXT;

ALTER TABLE tournament_members ADD COLUMN shared_roster_json TEXT
  CHECK (shared_roster_json IS NULL OR (json_valid(shared_roster_json) AND json_type(shared_roster_json) = 'array' AND json_array_length(shared_roster_json) <= 6));
ALTER TABLE tournament_members ADD COLUMN shared_roster_updated_at TEXT;

CREATE TRIGGER rooms_clear_shared_rosters_after_end
AFTER UPDATE OF status ON rooms
WHEN NEW.status IN ('completed', 'cancelled') AND NEW.status <> OLD.status
BEGIN
  UPDATE room_members
     SET shared_roster_json = NULL, shared_roster_updated_at = NULL
   WHERE room_id = NEW.id;
END;

CREATE TRIGGER tournaments_clear_shared_rosters_after_end
AFTER UPDATE OF status ON tournaments
WHEN NEW.status IN ('completed', 'cancelled') AND NEW.status <> OLD.status
BEGIN
  UPDATE tournament_members
     SET shared_roster_json = NULL, shared_roster_updated_at = NULL
   WHERE tournament_id = NEW.id;
END;

CREATE TRIGGER room_members_clear_shared_roster_after_exit
AFTER UPDATE OF status ON room_members
WHEN NEW.status IN ('left', 'removed') AND OLD.status <> NEW.status
BEGIN
  UPDATE room_members
     SET shared_roster_json = NULL, shared_roster_updated_at = NULL
   WHERE room_id = NEW.room_id AND user_id = NEW.user_id;
END;

CREATE TRIGGER tournament_members_clear_shared_roster_after_exit
AFTER UPDATE OF status ON tournament_members
WHEN NEW.status IN ('left', 'removed') AND OLD.status <> NEW.status
BEGIN
  UPDATE tournament_members
     SET shared_roster_json = NULL, shared_roster_updated_at = NULL
   WHERE tournament_id = NEW.tournament_id AND user_id = NEW.user_id;
END;
