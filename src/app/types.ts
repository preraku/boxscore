export type TeamSize = 4 | 5
export type TeamId = 'A' | 'B'
export type ScoringMode = 'twosAndThrees' | 'onesAndTwos'
export type Phase = 'setup' | 'game' | 'editNames'
export type StatKey =
  | 'lowPA'
  | 'lowPM'
  | 'highPA'
  | 'highPM'
  | 'ast'
  | 'stl'
  | 'blk'
  | 'reb'
  | 'tov'
  | 'tovf'

export type StatLine = {
  lowPA: number
  lowPM: number
  highPA: number
  highPM: number
  ast: number
  stl: number
  blk: number
  reb: number
  tov: number
  tovf: number
}

export type StatDelta = Partial<Record<StatKey, number>>

export type Player = {
  id: string
  name: string
  stats: StatLine
}

export type Team = {
  id: TeamId
  label: string
  players: Player[]
}

export type SetupTeam = {
  label: string
  names: string[]
}

export type ActionTone = 'make' | 'miss' | 'event'

export type ActionDefinition = {
  id: string
  label: string
  short: string
  tone: ActionTone
  delta: StatDelta
}

export type LoggedAction = {
  teamId: TeamId
  playerId: string
  delta: StatDelta
  label: string
}

export type PersistedState = {
  phase: Phase
  playerCount: TeamSize
  setupScoringMode: ScoringMode
  gameScoringMode: ScoringMode
  setup: Record<TeamId, SetupTeam>
  teams: Team[]
  selectedTeamId: TeamId
  selectedPlayerId: string
  history: LoggedAction[]
  lastAction: string
}

export type PreparedShareImage = {
  signature: string
  file: File
}

export type StatGlossaryTerm = {
  abbreviation: string
  definition: string
}
