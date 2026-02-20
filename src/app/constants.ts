import type { ScoringMode, StatGlossaryTerm, StatKey, TeamId } from './types'

export const TEAM_IDS: TeamId[] = ['A', 'B']

export const STAT_KEYS: StatKey[] = [
  'lowPA',
  'lowPM',
  'highPA',
  'highPM',
  'ast',
  'stl',
  'blk',
  'reb',
  'tov',
  'tovf',
]

export const SCORING_CONFIG: Record<
  ScoringMode,
  {
    lowLabel: string
    highLabel: string
    lowPoints: number
    highPoints: number
  }
> = {
  twosAndThrees: {
    lowLabel: '2P',
    highLabel: '3P',
    lowPoints: 2,
    highPoints: 3,
  },
  onesAndTwos: {
    lowLabel: '1P',
    highLabel: '2P',
    lowPoints: 1,
    highPoints: 2,
  },
}

export const STORAGE_KEY = 'boxscore:state:v1'
export const MAX_PLAYERS_PER_TEAM = 5

export const BOX_SCORE_STAT_GLOSSARY: StatGlossaryTerm[] = [
  { abbreviation: 'TOVF', definition: 'Turnovers Forced' },
]

export const BOX_SCORE_STAT_DEFINITION_BY_ABBREVIATION = new Map(
  BOX_SCORE_STAT_GLOSSARY.map((term) => [term.abbreviation, term.definition]),
)

export const SHARED_BOX_SCORE_GLOSSARY_LINE = BOX_SCORE_STAT_GLOSSARY.map(
  (term) => `${term.abbreviation} = ${term.definition}`,
).join(' | ')
