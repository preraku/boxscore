import {
  MAX_PLAYERS_PER_TEAM,
  STAT_KEYS,
  STORAGE_KEY,
  TEAM_IDS,
} from './constants'
import type {
  LoggedAction,
  PersistedState,
  Phase,
  Player,
  ScoringMode,
  SetupTeam,
  StatDelta,
  StatLine,
  Team,
  TeamId,
  TeamSize,
} from './types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isPhase = (value: unknown): value is Phase =>
  value === 'setup' || value === 'game' || value === 'editNames'

const isScoringMode = (value: unknown): value is ScoringMode =>
  value === 'twosAndThrees' || value === 'onesAndTwos'

const isTeamId = (value: unknown): value is TeamId =>
  value === 'A' || value === 'B'

const isTeamSize = (value: unknown): value is TeamSize =>
  value === 4 || value === 5

const safeString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const safeNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const clampToZero = (value: number): number => Math.max(0, value)

const normalizeStatLine = (value: unknown): StatLine => {
  const source = isRecord(value) ? value : {}

  return {
    lowPA: clampToZero(safeNumber(source.lowPA)),
    lowPM: clampToZero(safeNumber(source.lowPM)),
    highPA: clampToZero(safeNumber(source.highPA)),
    highPM: clampToZero(safeNumber(source.highPM)),
    ast: clampToZero(safeNumber(source.ast)),
    stl: clampToZero(safeNumber(source.stl)),
    blk: clampToZero(safeNumber(source.blk)),
    reb: clampToZero(safeNumber(source.reb)),
    tov: clampToZero(safeNumber(source.tov)),
    tovf: clampToZero(safeNumber(source.tovf)),
  }
}

const normalizeStatDelta = (value: unknown): StatDelta => {
  if (!isRecord(value)) {
    return {}
  }

  const delta: StatDelta = {}

  for (const statKey of STAT_KEYS) {
    if (typeof value[statKey] === 'number' && Number.isFinite(value[statKey])) {
      delta[statKey] = value[statKey]
    }
  }

  return delta
}

const normalizeSetupTeam = (
  value: unknown,
  fallbackLabel: string,
): SetupTeam => {
  const source = isRecord(value) ? value : {}
  const rawNames = Array.isArray(source.names) ? source.names : []

  return {
    label: safeString(source.label, fallbackLabel),
    names: Array.from({ length: MAX_PLAYERS_PER_TEAM }, (_, index) =>
      safeString(rawNames[index], ''),
    ),
  }
}

const normalizePlayer = (
  value: unknown,
  teamId: TeamId,
  index: number,
): Player => {
  const source = isRecord(value) ? value : {}

  return {
    id: safeString(source.id, `${teamId}-${index + 1}`),
    name: safeString(source.name, `P${index + 1}`),
    stats: normalizeStatLine(source.stats),
  }
}

const normalizeTeam = (value: unknown, fallbackTeamId: TeamId): Team => {
  const source = isRecord(value) ? value : {}
  const id = isTeamId(source.id) ? source.id : fallbackTeamId
  const rawPlayers = Array.isArray(source.players) ? source.players : []

  return {
    id,
    label: safeString(source.label, `Team ${id}`),
    players: rawPlayers.map((player, index) =>
      normalizePlayer(player, id, index),
    ),
  }
}

const normalizeHistory = (value: unknown): LoggedAction[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const entries: LoggedAction[] = []

  for (const item of value) {
    if (!isRecord(item) || !isTeamId(item.teamId)) {
      continue
    }

    entries.push({
      teamId: item.teamId,
      playerId: safeString(item.playerId),
      delta: normalizeStatDelta(item.delta),
      label: safeString(item.label),
    })
  }

  return entries
}

const resolveSelectedPlayerId = (
  teams: Team[],
  selectedTeamId: TeamId,
  selectedPlayerId: string,
): string => {
  const selectedTeam = teams.find((team) => team.id === selectedTeamId)
  if (!selectedTeam || selectedTeam.players.length === 0) {
    return ''
  }

  const matchingPlayer = selectedTeam.players.find(
    (player) => player.id === selectedPlayerId,
  )
  return matchingPlayer?.id ?? selectedTeam.players[0].id
}

export const loadPersistedState = (): PersistedState | null => {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) {
      return null
    }

    const rawSetup = isRecord(parsed.setup) ? parsed.setup : {}
    const setup: Record<TeamId, SetupTeam> = {
      A: normalizeSetupTeam(rawSetup.A, 'Team A'),
      B: normalizeSetupTeam(rawSetup.B, 'Team B'),
    }

    const rawTeams = Array.isArray(parsed.teams) ? parsed.teams : []
    const teamsById = new Map<TeamId, Team>()

    for (const rawTeam of rawTeams) {
      const fallbackTeamId: TeamId = teamsById.has('A') ? 'B' : 'A'
      const normalized = normalizeTeam(rawTeam, fallbackTeamId)
      if (!teamsById.has(normalized.id)) {
        teamsById.set(normalized.id, normalized)
      }
    }

    const teams = TEAM_IDS.flatMap((teamId) => {
      const team = teamsById.get(teamId)
      return team ? [team] : []
    })

    const playerCount: TeamSize = isTeamSize(parsed.playerCount)
      ? parsed.playerCount
      : 5
    const setupScoringMode: ScoringMode = isScoringMode(parsed.setupScoringMode)
      ? parsed.setupScoringMode
      : 'twosAndThrees'
    const gameScoringMode: ScoringMode = isScoringMode(parsed.gameScoringMode)
      ? parsed.gameScoringMode
      : setupScoringMode

    const selectedTeamId: TeamId =
      isTeamId(parsed.selectedTeamId) &&
      teams.some((team) => team.id === parsed.selectedTeamId)
        ? parsed.selectedTeamId
        : (teams[0]?.id ?? 'A')

    const selectedPlayerId = resolveSelectedPlayerId(
      teams,
      selectedTeamId,
      safeString(parsed.selectedPlayerId),
    )

    const initialPhase = isPhase(parsed.phase) ? parsed.phase : 'setup'
    const phase: Phase =
      teams.length === 0 && initialPhase !== 'setup' ? 'setup' : initialPhase

    return {
      phase,
      playerCount,
      setupScoringMode,
      gameScoringMode,
      setup,
      teams,
      selectedTeamId,
      selectedPlayerId,
      history: normalizeHistory(parsed.history),
      lastAction: safeString(parsed.lastAction),
    }
  } catch {
    return null
  }
}

export const persistState = (state: PersistedState) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore quota or serialization issues.
  }
}
