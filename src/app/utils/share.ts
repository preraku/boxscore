import { MAX_PLAYERS_PER_TEAM } from '../constants'
import type { ScoringMode, Team } from '../types'

export const isDefaultPlayerName = (name: string): boolean => {
  const trimmedName = name.trim()

  for (let index = 1; index <= MAX_PLAYERS_PER_TEAM; index += 1) {
    if (trimmedName === `P${index}`) {
      return true
    }
  }

  return false
}

export const shareCaptureSignature = (
  teams: Team[],
  scoringMode: ScoringMode,
): string =>
  JSON.stringify({
    scoringMode,
    teams: teams.map((team) => ({
      id: team.id,
      label: team.label,
      players: team.players.map((player) => ({
        id: player.id,
        name: player.name,
        stats: player.stats,
      })),
    })),
  })

export const buildDefaultShareSelection = (
  teams: Team[],
): Record<string, boolean> => {
  const selection: Record<string, boolean> = {}

  for (const team of teams) {
    for (const player of team.players) {
      selection[player.id] = true
    }
  }

  return selection
}

export const syncShareSelection = (
  currentSelection: Record<string, boolean>,
  teams: Team[],
): Record<string, boolean> => {
  const nextSelection: Record<string, boolean> = {}
  let changed = false

  for (const team of teams) {
    for (const player of team.players) {
      if (player.id in currentSelection) {
        nextSelection[player.id] = currentSelection[player.id]
      } else {
        nextSelection[player.id] = true
        changed = true
      }
    }
  }

  if (!changed) {
    const currentIds = Object.keys(currentSelection)
    const nextIds = Object.keys(nextSelection)

    if (currentIds.length !== nextIds.length) {
      changed = true
    } else {
      for (const playerId of currentIds) {
        if (!(playerId in nextSelection)) {
          changed = true
          break
        }
      }
    }
  }

  return changed ? nextSelection : currentSelection
}
