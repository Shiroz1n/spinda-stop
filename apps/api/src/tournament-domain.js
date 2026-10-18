import { randomInt } from "node:crypto";

export const TOURNAMENT_CAPACITY = 4;

export function validateTournamentName(value) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 1 && name.length <= 48 ? name : null;
}

export function canLockTournament(status, memberCount, checkedInCount) {
  return status === "open" && memberCount === TOURNAMENT_CAPACITY && checkedInCount === TOURNAMENT_CAPACITY;
}

export function canStartTournament(status, checkedInCount) {
  return status === "locked" && checkedInCount === TOURNAMENT_CAPACITY;
}

export function shuffleTournamentSeeds(userIds, randomIndex = randomInt) {
  const players = [...userIds];
  for (let index = players.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [players[index], players[swapIndex]] = [players[swapIndex], players[index]];
  }
  return players.map((userId, index) => ({ userId, seed: index + 1 }));
}

export function semifinalPairings(seededPlayers) {
  if (seededPlayers.length !== TOURNAMENT_CAPACITY || seededPlayers.some((player) => !Number.isInteger(player.seed))) return null;
  const ordered = [...seededPlayers].sort((left, right) => left.seed - right.seed);
  if (ordered.some((player, index) => player.seed !== index + 1)) return null;
  return [
    [ordered[0].userId, ordered[3].userId],
    [ordered[1].userId, ordered[2].userId],
  ];
}
