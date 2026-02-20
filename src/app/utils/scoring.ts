import { SCORING_CONFIG, STAT_KEYS } from '../constants'
import type {
  ActionDefinition,
  ScoringMode,
  StatDelta,
  StatKey,
  StatLine,
  Team,
  TeamId,
} from '../types'

export const scoringActions = (mode: ScoringMode): ActionDefinition[] => {
  const config = SCORING_CONFIG[mode]

  return [
    {
      id: 'low-make',
      label: `+${config.lowPoints} Make`,
      short: `${config.lowLabel}M`,
      tone: 'make',
      delta: { lowPA: 1, lowPM: 1 },
    },
    {
      id: 'low-miss',
      label: `${config.lowLabel} Miss`,
      short: `${config.lowLabel}A`,
      tone: 'miss',
      delta: { lowPA: 1 },
    },
    {
      id: 'high-make',
      label: `+${config.highPoints} Make`,
      short: `${config.highLabel}M`,
      tone: 'make',
      delta: { highPA: 1, highPM: 1 },
    },
    {
      id: 'high-miss',
      label: `${config.highLabel} Miss`,
      short: `${config.highLabel}A`,
      tone: 'miss',
      delta: { highPA: 1 },
    },
    { id: 'ast', label: 'AST', short: 'AST', tone: 'event', delta: { ast: 1 } },
    { id: 'stl', label: 'STL', short: 'STL', tone: 'event', delta: { stl: 1 } },
    { id: 'blk', label: 'BLK', short: 'BLK', tone: 'event', delta: { blk: 1 } },
    { id: 'reb', label: 'REB', short: 'REB', tone: 'event', delta: { reb: 1 } },
    { id: 'tov', label: 'TOV', short: 'TOV', tone: 'event', delta: { tov: 1 } },
    {
      id: 'tovf',
      label: 'TOVF',
      short: 'TOVF',
      tone: 'event',
      delta: { tovf: 1 },
    },
  ]
}

export const blankStatLine = (): StatLine => ({
  lowPA: 0,
  lowPM: 0,
  highPA: 0,
  highPM: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  reb: 0,
  tov: 0,
  tovf: 0,
})

export const playerPoints = (
  player: { stats: StatLine },
  scoringMode: ScoringMode,
): number => {
  const config = SCORING_CONFIG[scoringMode]
  return (
    player.stats.lowPM * config.lowPoints +
    player.stats.highPM * config.highPoints
  )
}

export const teamPoints = (team: Team, scoringMode: ScoringMode): number =>
  team.players.reduce(
    (total, player) => total + playerPoints(player, scoringMode),
    0,
  )

export const teamStatTotal = (team: Team, statKey: StatKey): number =>
  team.players.reduce((total, player) => total + player.stats[statKey], 0)

export const shootingLine = (made: number, attempts: number): string =>
  `${made}/${attempts}`

export const playerFieldGoalsLine = (player: { stats: StatLine }): string =>
  shootingLine(
    player.stats.lowPM + player.stats.highPM,
    player.stats.lowPA + player.stats.highPA,
  )

export const teamFieldGoalsLine = (team: Team): string =>
  shootingLine(
    teamStatTotal(team, 'lowPM') + teamStatTotal(team, 'highPM'),
    teamStatTotal(team, 'lowPA') + teamStatTotal(team, 'highPA'),
  )

export const teamColorClass = (teamId: TeamId): string =>
  teamId === 'A' ? 'team-a' : 'team-b'

export const applyDelta = (
  currentStats: StatLine,
  delta: StatDelta,
  direction: 1 | -1 = 1,
): StatLine => {
  const nextStats: StatLine = { ...currentStats }

  for (const statKey of STAT_KEYS) {
    const deltaValue = delta[statKey] ?? 0
    nextStats[statKey] = Math.max(
      0,
      nextStats[statKey] + deltaValue * direction,
    )
  }

  return nextStats
}
