ALTER TABLE room_members
  ADD COLUMN shared_roster_json jsonb,
  ADD COLUMN shared_roster_updated_at timestamptz,
  ADD CONSTRAINT room_members_shared_roster_check
    CHECK (shared_roster_json IS NULL OR (jsonb_typeof(shared_roster_json) = 'array' AND jsonb_array_length(shared_roster_json) <= 6));

ALTER TABLE tournament_members
  ADD COLUMN shared_roster_json jsonb,
  ADD COLUMN shared_roster_updated_at timestamptz,
  ADD CONSTRAINT tournament_members_shared_roster_check
    CHECK (shared_roster_json IS NULL OR (jsonb_typeof(shared_roster_json) = 'array' AND jsonb_array_length(shared_roster_json) <= 6));

CREATE FUNCTION clear_room_rosters_after_event_end() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE room_members SET shared_roster_json = NULL, shared_roster_updated_at = NULL WHERE room_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER rooms_clear_shared_rosters_after_end
  AFTER UPDATE OF status ON rooms
  FOR EACH ROW EXECUTE FUNCTION clear_room_rosters_after_event_end();

CREATE FUNCTION clear_tournament_rosters_after_event_end() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled') AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE tournament_members SET shared_roster_json = NULL, shared_roster_updated_at = NULL WHERE tournament_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tournaments_clear_shared_rosters_after_end
  AFTER UPDATE OF status ON tournaments
  FOR EACH ROW EXECUTE FUNCTION clear_tournament_rosters_after_end();

CREATE FUNCTION clear_room_roster_after_member_exit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('left', 'removed') THEN
    NEW.shared_roster_json := NULL;
    NEW.shared_roster_updated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER room_members_clear_shared_roster_after_exit
  BEFORE UPDATE OF status ON room_members
  FOR EACH ROW EXECUTE FUNCTION clear_room_roster_after_member_exit();

CREATE FUNCTION clear_tournament_roster_after_member_exit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('left', 'removed') THEN
    NEW.shared_roster_json := NULL;
    NEW.shared_roster_updated_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tournament_members_clear_shared_roster_after_exit
  BEFORE UPDATE OF status ON tournament_members
  FOR EACH ROW EXECUTE FUNCTION clear_tournament_roster_after_member_exit();
