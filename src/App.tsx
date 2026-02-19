import html2canvas from 'html2canvas'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import './App.css'

type TeamSize = 4 | 5
type TeamId = 'A' | 'B'
type ScoringMode = 'twosAndThrees' | 'onesAndTwos'
type Phase = 'setup' | 'game' | 'editNames'
type StatKey =
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

type StatLine = {
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

type StatDelta = Partial<Record<StatKey, number>>

type Player = {
  id: string
  name: string
  stats: StatLine
}

type Team = {
  id: TeamId
  label: string
  players: Player[]
}

type SetupTeam = {
  label: string
  names: string[]
}

type ActionTone = 'make' | 'miss' | 'event'

type ActionDefinition = {
  id: string
  label: string
  short: string
  tone: ActionTone
  delta: StatDelta
}

type LoggedAction = {
  teamId: TeamId
  playerId: string
  delta: StatDelta
  label: string
}

type PersistedState = {
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

type PreparedShareImage = {
  signature: string
  file: File
}

type StatGlossaryTerm = {
  abbreviation: string
  definition: string
}

const TEAM_IDS: TeamId[] = ['A', 'B']
const STAT_KEYS: StatKey[] = [
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

const SCORING_CONFIG: Record<
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

const STORAGE_KEY = 'boxscore:state:v1'
const MAX_PLAYERS_PER_TEAM = 5
const BOX_SCORE_STAT_GLOSSARY: StatGlossaryTerm[] = [
  { abbreviation: 'TOVF', definition: 'Turnovers Forced' },
]
const BOX_SCORE_STAT_DEFINITION_BY_ABBREVIATION = new Map(
  BOX_SCORE_STAT_GLOSSARY.map((term) => [term.abbreviation, term.definition]),
)
const SHARED_BOX_SCORE_GLOSSARY_LINE = BOX_SCORE_STAT_GLOSSARY.map(
  (term) => `${term.abbreviation} = ${term.definition}`,
).join(' | ')

type StatHeaderTermProps = {
  abbreviation: string
  definition: string
}

const StatHeaderTerm = ({ abbreviation, definition }: StatHeaderTermProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const termRef = useRef<HTMLSpanElement | null>(null)
  const tooltipId = useId()

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const targetNode = event.target as Node | null
      if (!termRef.current || (targetNode && termRef.current.contains(targetNode))) {
        return
      }

      setIsOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <span className={`stat-term${isOpen ? ' open' : ''}`} ref={termRef}>
      <button
        type="button"
        className="stat-term-trigger"
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        aria-label={`${abbreviation}: ${definition}`}
        onClick={() => setIsOpen((current) => !current)}
      >
        {abbreviation}
      </button>
      <span id={tooltipId} role="tooltip" className="stat-term-tooltip">
        {abbreviation} = {definition}
      </span>
    </span>
  )
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isPhase = (value: unknown): value is Phase =>
  value === 'setup' || value === 'game' || value === 'editNames'

const isScoringMode = (value: unknown): value is ScoringMode =>
  value === 'twosAndThrees' || value === 'onesAndTwos'

const isTeamId = (value: unknown): value is TeamId => value === 'A' || value === 'B'

const isTeamSize = (value: unknown): value is TeamSize => value === 4 || value === 5

const safeString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const safeNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const clampToZero = (value: number): number => Math.max(0, value)

const scoringActions = (mode: ScoringMode): ActionDefinition[] => {
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
    { id: 'tovf', label: 'TOVF', short: 'TOVF', tone: 'event', delta: { tovf: 1 } },
  ]
}

const blankStatLine = (): StatLine => ({
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

const createSetupTeam = (label: string): SetupTeam => ({
  label,
  names: ['', '', '', '', ''],
})

const defaultSetup = (): Record<TeamId, SetupTeam> => ({
  A: createSetupTeam('Team A'),
  B: createSetupTeam('Team B'),
})

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

const normalizeSetupTeam = (value: unknown, fallbackLabel: string): SetupTeam => {
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
    players: rawPlayers.map((player, index) => normalizePlayer(player, id, index)),
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

const loadPersistedState = (): PersistedState | null => {
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
      isTeamId(parsed.selectedTeamId) && teams.some((team) => team.id === parsed.selectedTeamId)
        ? parsed.selectedTeamId
        : teams[0]?.id ?? 'A'

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

const persistState = (state: PersistedState) => {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore quota or serialization issues.
  }
}

const playerPoints = (player: Player, scoringMode: ScoringMode): number => {
  const config = SCORING_CONFIG[scoringMode]
  return player.stats.lowPM * config.lowPoints + player.stats.highPM * config.highPoints
}

const teamPoints = (team: Team, scoringMode: ScoringMode): number =>
  team.players.reduce((total, player) => total + playerPoints(player, scoringMode), 0)

const teamStatTotal = (team: Team, statKey: StatKey): number =>
  team.players.reduce((total, player) => total + player.stats[statKey], 0)

const shootingLine = (made: number, attempts: number): string =>
  `${made}/${attempts}`

const playerFieldGoalsLine = (player: Player): string =>
  shootingLine(
    player.stats.lowPM + player.stats.highPM,
    player.stats.lowPA + player.stats.highPA,
  )

const teamFieldGoalsLine = (team: Team): string =>
  shootingLine(
    teamStatTotal(team, 'lowPM') + teamStatTotal(team, 'highPM'),
    teamStatTotal(team, 'lowPA') + teamStatTotal(team, 'highPA'),
  )

const teamColorClass = (teamId: TeamId): string =>
  teamId === 'A' ? 'team-a' : 'team-b'

const shareCaptureSignature = (teams: Team[], scoringMode: ScoringMode): string =>
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

const buildDefaultShareSelection = (teams: Team[]): Record<string, boolean> => {
  const selection: Record<string, boolean> = {}

  for (const team of teams) {
    for (const player of team.players) {
      selection[player.id] = true
    }
  }

  return selection
}

const syncShareSelection = (
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

const applyDelta = (
  currentStats: StatLine,
  delta: StatDelta,
  direction: 1 | -1 = 1,
): StatLine => {
  const nextStats: StatLine = { ...currentStats }

  for (const statKey of STAT_KEYS) {
    const deltaValue = delta[statKey] ?? 0
    nextStats[statKey] = Math.max(0, nextStats[statKey] + deltaValue * direction)
  }

  return nextStats
}

function App() {
  const [persistedState] = useState<PersistedState | null>(() => loadPersistedState())
  const [phase, setPhase] = useState<Phase>(() => persistedState?.phase ?? 'setup')
  const [playerCount, setPlayerCount] = useState<TeamSize>(
    () => persistedState?.playerCount ?? 5,
  )
  const [setupScoringMode, setSetupScoringMode] = useState<ScoringMode>(
    () => persistedState?.setupScoringMode ?? 'twosAndThrees',
  )
  const [gameScoringMode, setGameScoringMode] = useState<ScoringMode>(
    () => persistedState?.gameScoringMode ?? 'twosAndThrees',
  )
  const [setup, setSetup] = useState<Record<TeamId, SetupTeam>>(
    () => persistedState?.setup ?? defaultSetup(),
  )
  const [teams, setTeams] = useState<Team[]>(() => persistedState?.teams ?? [])
  const [selectedTeamId, setSelectedTeamId] = useState<TeamId>(
    () => persistedState?.selectedTeamId ?? 'A',
  )
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>(
    () => persistedState?.selectedPlayerId ?? '',
  )
  const [history, setHistory] = useState<LoggedAction[]>(
    () => persistedState?.history ?? [],
  )
  const [lastAction, setLastAction] = useState<string>(
    () => persistedState?.lastAction ?? '',
  )
  const [shareStatus, setShareStatus] = useState<string>('')
  const [preparedShareImage, setPreparedShareImage] = useState<PreparedShareImage | null>(
    null,
  )
  const [isSharing, setIsSharing] = useState(false)
  const [isPreparingShareImage, setIsPreparingShareImage] = useState(false)
  const [hasSharePrepareError, setHasSharePrepareError] = useState(false)
  const [shareSelectionByPlayerId, setShareSelectionByPlayerId] = useState<
    Record<string, boolean>
  >(() => buildDefaultShareSelection(persistedState?.teams ?? []))
  const [isShareOptionsOpen, setIsShareOptionsOpen] = useState(false)
  const [shareSheetDragOffset, setShareSheetDragOffset] = useState(0)
  const [isShareSheetDragging, setIsShareSheetDragging] = useState(false)
  const [shareSheetTransitionMs, setShareSheetTransitionMs] = useState(220)
  const [isShareSheetClosing, setIsShareSheetClosing] = useState(false)
  const sharedBoxScoreRef = useRef<HTMLDivElement | null>(null)
  const shareSheetTeamListRef = useRef<HTMLDivElement | null>(null)
  const shareSheetTouchStartYRef = useRef<number | null>(null)
  const shareSheetTouchStartTimeRef = useRef<number | null>(null)
  const shareSheetDismissTimeoutRef = useRef<number | null>(null)
  const sharePrepareJobIdRef = useRef(0)
  const shareSheetDragOffsetRef = useRef(0)
  const shareSheetCanDragRef = useRef(false)
  const shareSheetTouchStartedInListRef = useRef(false)

  const selectedTeam = teams.find((team) => team.id === selectedTeamId)
  const selectedPlayer = selectedTeam?.players.find(
    (player) => player.id === selectedPlayerId,
  )
  const currentScoringConfig = SCORING_CONFIG[gameScoringMode]
  const actionButtons = scoringActions(gameScoringMode)
  const shareTeams = useMemo(
    () =>
      teams
        .map((team) => ({
          ...team,
          players: team.players.filter(
            (player) => shareSelectionByPlayerId[player.id] !== false,
          ),
        }))
        .filter((team) => team.players.length > 0),
    [teams, shareSelectionByPlayerId],
  )
  const totalSharePlayers = teams.reduce((total, team) => total + team.players.length, 0)
  const selectedSharePlayers = shareTeams.reduce(
    (total, team) => total + team.players.length,
    0,
  )
  const currentShareSignature = useMemo(
    () => shareCaptureSignature(shareTeams, gameScoringMode),
    [shareTeams, gameScoringMode],
  )
  const isShareImageReady =
    preparedShareImage?.signature === currentShareSignature
  const isSheetShareReady =
    selectedSharePlayers > 0 &&
    !isPreparingShareImage &&
    !isSharing &&
    (isShareImageReady || hasSharePrepareError)
  const shareStatusMessage =
    teams.length > 0 && selectedSharePlayers === 0
      ? 'Select at least one player in Share options.'
      : shareStatus

  const resetShareSheetDrag = () => {
    if (shareSheetDismissTimeoutRef.current !== null) {
      window.clearTimeout(shareSheetDismissTimeoutRef.current)
      shareSheetDismissTimeoutRef.current = null
    }
    shareSheetTouchStartYRef.current = null
    shareSheetTouchStartTimeRef.current = null
    shareSheetCanDragRef.current = false
    shareSheetTouchStartedInListRef.current = false
    shareSheetDragOffsetRef.current = 0
    setShareSheetTransitionMs(220)
    setIsShareSheetClosing(false)
    setShareSheetDragOffset(0)
    setIsShareSheetDragging(false)
  }

  useEffect(() => {
    return () => {
      if (shareSheetDismissTimeoutRef.current !== null) {
        window.clearTimeout(shareSheetDismissTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    persistState({
      phase,
      playerCount,
      setupScoringMode,
      gameScoringMode,
      setup,
      teams,
      selectedTeamId,
      selectedPlayerId,
      history,
      lastAction,
    })
  }, [
    phase,
    playerCount,
    setupScoringMode,
    gameScoringMode,
    setup,
    teams,
    selectedTeamId,
    selectedPlayerId,
    history,
    lastAction,
  ])

  useEffect(() => {
    setPreparedShareImage(null)
    setHasSharePrepareError(false)
  }, [teams, gameScoringMode, shareSelectionByPlayerId])

  useEffect(() => {
    setShareSelectionByPlayerId((currentSelection) =>
      syncShareSelection(currentSelection, teams),
    )
  }, [teams])

  useEffect(() => {
    if (!isShareOptionsOpen) {
      shareSheetTouchStartYRef.current = null
      shareSheetTouchStartTimeRef.current = null
      shareSheetCanDragRef.current = false
      shareSheetTouchStartedInListRef.current = false
      shareSheetDragOffsetRef.current = 0
      setShareSheetDragOffset(0)
      setIsShareSheetDragging(false)
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsShareOptionsOpen(false)
      }
    }

    const scrollY = window.scrollY
    const originalBodyOverflow = document.body.style.overflow
    const originalBodyPosition = document.body.style.position
    const originalBodyTop = document.body.style.top
    const originalBodyLeft = document.body.style.left
    const originalBodyRight = document.body.style.right
    const originalBodyWidth = document.body.style.width
    const originalHtmlOverflow = document.documentElement.style.overflow

    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.width = '100%'
    document.documentElement.style.overflow = 'hidden'

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalBodyOverflow
      document.body.style.position = originalBodyPosition
      document.body.style.top = originalBodyTop
      document.body.style.left = originalBodyLeft
      document.body.style.right = originalBodyRight
      document.body.style.width = originalBodyWidth
      document.documentElement.style.overflow = originalHtmlOverflow
      window.scrollTo(0, scrollY)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isShareOptionsOpen])

  const updateTeamLabel = (teamId: TeamId, label: string) => {
    setSetup((currentSetup) => ({
      ...currentSetup,
      [teamId]: {
        ...currentSetup[teamId],
        label,
      },
    }))
  }

  const updatePlayerName = (teamId: TeamId, index: number, name: string) => {
    setSetup((currentSetup) => {
      const nextNames = [...currentSetup[teamId].names]
      nextNames[index] = name

      return {
        ...currentSetup,
        [teamId]: {
          ...currentSetup[teamId],
          names: nextNames,
        },
      }
    })
  }

  const startGame = () => {
    setGameScoringMode(setupScoringMode)

    const seededTeams: Team[] = TEAM_IDS.map((teamId) => {
      const teamSetup = setup[teamId]
      const teamLabel = teamSetup.label.trim() || `Team ${teamId}`

      return {
        id: teamId,
        label: teamLabel,
        players: Array.from({ length: playerCount }, (_, index) => ({
          id: `${teamId}-${index + 1}`,
          name: teamSetup.names[index]?.trim() || `P${index + 1}`,
          stats: blankStatLine(),
        })),
      }
    })

    setTeams(seededTeams)
    setSelectedTeamId(seededTeams[0].id)
    setSelectedPlayerId(seededTeams[0].players[0]?.id ?? '')
    setShareSelectionByPlayerId(buildDefaultShareSelection(seededTeams))
    closeShareOptions()
    setHistory([])
    setLastAction('Game started.')
    setPhase('game')
  }

  const beginEditNames = () => {
    if (teams.length === 0) {
      return
    }

    const nextPlayerCount: TeamSize = teams[0]?.players.length === 4 ? 4 : 5

    setPlayerCount(nextPlayerCount)
    setSetup((currentSetup) => {
      const nextSetup: Record<TeamId, SetupTeam> = { ...currentSetup }

      for (const teamId of TEAM_IDS) {
        const currentTeam = teams.find((team) => team.id === teamId)
        if (!currentTeam) {
          continue
        }

        const currentNames = currentTeam.players.map((player) => player.name)
        const paddedNames = [...currentNames]
        while (paddedNames.length < 5) {
          paddedNames.push('')
        }

        nextSetup[teamId] = {
          label: currentTeam.label,
          names: paddedNames,
        }
      }

      return nextSetup
    })

    setShareStatus('')
    closeShareOptions()
    setPhase('editNames')
  }

  const saveEditedNames = () => {
    setTeams((currentTeams) =>
      currentTeams.map((team) => {
        const teamSetup = setup[team.id]
        const nextTeamLabel = teamSetup.label.trim() || team.label

        return {
          ...team,
          label: nextTeamLabel,
          players: team.players.map((player, index) => ({
            ...player,
            name: teamSetup.names[index]?.trim() || `P${index + 1}`,
          })),
        }
      }),
    )

    setLastAction('Names updated.')
    setShareStatus('')
    setPhase('game')
  }

  const cancelEditNames = () => {
    setPhase('game')
  }

  const openShareOptions = () => {
    if (teams.length === 0) {
      return
    }

    resetShareSheetDrag()
    setShareStatus('')
    setHasSharePrepareError(false)
    setShareSheetTransitionMs(220)
    setIsShareOptionsOpen(true)
  }

  const closeShareOptions = () => {
    sharePrepareJobIdRef.current += 1
    setIsPreparingShareImage(false)
    setHasSharePrepareError(false)
    resetShareSheetDrag()
    setIsShareOptionsOpen(false)
  }

  const handleShareSheetTouchStart = (event: ReactTouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) {
      return
    }

    const touchStartY = event.touches[0].clientY
    const teamListElement = shareSheetTeamListRef.current
    const targetNode = event.target as Node | null
    const startedInList =
      !!teamListElement && !!targetNode && teamListElement.contains(targetNode)

    shareSheetTouchStartYRef.current = touchStartY
    shareSheetTouchStartTimeRef.current = Date.now()
    shareSheetTouchStartedInListRef.current = startedInList
    shareSheetCanDragRef.current =
      !startedInList || (teamListElement?.scrollTop ?? 0) <= 0
  }

  const handleShareSheetTouchMove = (event: ReactTouchEvent<HTMLElement>) => {
    const touchStartY = shareSheetTouchStartYRef.current
    if (touchStartY === null || event.touches.length !== 1) {
      return
    }

    const nextOffset = Math.max(0, event.touches[0].clientY - touchStartY)
    const teamListElement = shareSheetTeamListRef.current
    if (
      shareSheetTouchStartedInListRef.current &&
      teamListElement &&
      teamListElement.scrollTop > 0
    ) {
      shareSheetCanDragRef.current = false
      return
    }

    shareSheetCanDragRef.current = true
    if (nextOffset <= 0) {
      return
    }

    if (event.cancelable) {
      event.preventDefault()
    }

    if (!isShareSheetDragging) {
      setIsShareSheetDragging(true)
    }

    shareSheetDragOffsetRef.current = nextOffset
    setShareSheetDragOffset(nextOffset)
  }

  const handleShareSheetTouchEnd = () => {
    if (shareSheetTouchStartYRef.current === null) {
      return
    }

    const elapsedMs =
      shareSheetTouchStartTimeRef.current === null
        ? Number.POSITIVE_INFINITY
        : Date.now() - shareSheetTouchStartTimeRef.current
    const dragDistance = shareSheetDragOffsetRef.current
    const shouldDismiss = dragDistance > 64 || (dragDistance > 28 && elapsedMs < 220)
    if (shouldDismiss) {
      const exitOffset = Math.max(window.innerHeight + 64, dragDistance + 220)
      const remainingDistance = Math.max(0, exitOffset - dragDistance)
      const dismissDurationMs = Math.min(
        1020,
        Math.max(540, Math.round(remainingDistance / 0.8)),
      )
      setIsShareSheetDragging(false)
      setIsShareSheetClosing(true)
      setShareSheetTransitionMs(dismissDurationMs)
      shareSheetDragOffsetRef.current = exitOffset
      setShareSheetDragOffset(exitOffset)
      shareSheetDismissTimeoutRef.current = window.setTimeout(() => {
        shareSheetDismissTimeoutRef.current = null
        setIsShareOptionsOpen(false)
      }, dismissDurationMs)
      return
    }

    resetShareSheetDrag()
  }

  const toggleSharePlayer = (playerId: string) => {
    setShareStatus('')
    setShareSelectionByPlayerId((currentSelection) => {
      const currentlySelected = currentSelection[playerId] !== false
      return {
        ...currentSelection,
        [playerId]: !currentlySelected,
      }
    })
  }

  const setShareSelectionForAllPlayers = (isSelected: boolean) => {
    setShareStatus('')
    setShareSelectionByPlayerId((currentSelection) => {
      const nextSelection = { ...currentSelection }

      for (const team of teams) {
        for (const player of team.players) {
          nextSelection[player.id] = isSelected
        }
      }

      return nextSelection
    })
  }

  const setShareSelectionForTeamOnly = (teamId: TeamId) => {
    setShareStatus('')
    setShareSelectionByPlayerId((currentSelection) => {
      const nextSelection = { ...currentSelection }

      for (const team of teams) {
        for (const player of team.players) {
          nextSelection[player.id] = team.id === teamId
        }
      }

      return nextSelection
    })
  }

  const selectPlayerTarget = (teamId: TeamId, playerId: string) => {
    setSelectedTeamId(teamId)
    setSelectedPlayerId(playerId)
  }

  const logAction = (action: ActionDefinition) => {
    if (!selectedTeam || !selectedPlayer) {
      return
    }

    const entry: LoggedAction = {
      teamId: selectedTeam.id,
      playerId: selectedPlayer.id,
      delta: action.delta,
      label: `${selectedTeam.label} | ${selectedPlayer.name} | ${action.short}`,
    }

    setTeams((currentTeams) =>
      currentTeams.map((team) =>
        team.id !== selectedTeam.id
          ? team
          : {
              ...team,
              players: team.players.map((player) =>
                player.id !== selectedPlayer.id
                  ? player
                  : {
                      ...player,
                      stats: applyDelta(player.stats, action.delta, 1),
                    },
              ),
            },
      ),
    )

    setHistory((currentHistory) => [...currentHistory, entry])
    setLastAction(entry.label)
  }

  const undoLastAction = () => {
    const lastEntry = history[history.length - 1]
    if (!lastEntry) {
      return
    }

    setTeams((currentTeams) =>
      currentTeams.map((team) =>
        team.id !== lastEntry.teamId
          ? team
          : {
              ...team,
              players: team.players.map((player) =>
                player.id !== lastEntry.playerId
                  ? player
                  : {
                      ...player,
                      stats: applyDelta(player.stats, lastEntry.delta, -1),
                    },
              ),
            },
      ),
    )

    setHistory((currentHistory) => currentHistory.slice(0, -1))
    setLastAction(`Undo: ${lastEntry.label}`)
  }

  const downloadBlob = (blob: Blob, filename: string) => {
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.append(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(blobUrl)
  }

  const prepareShareImage = useCallback(
    async (): Promise<{
      imageFile: File
      signature: string
      usedPreparedImage: boolean
    }> => {
      if (!sharedBoxScoreRef.current) {
        throw new Error('Could not prepare share image.')
      }

      const signature = currentShareSignature
      if (preparedShareImage?.signature === signature) {
        return {
          imageFile: preparedShareImage.file,
          signature,
          usedPreparedImage: true,
        }
      }

      const canvas = await html2canvas(sharedBoxScoreRef.current, {
        backgroundColor: '#ffffff',
        scale: Math.max(window.devicePixelRatio || 1, 2),
      })

      const imageBlob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/png')
      })

      if (!imageBlob) {
        throw new Error('Could not generate screenshot image.')
      }

      const matchupLabel = shareTeams
        .map((team) => team.label.trim().replace(/\s+/g, '-').toLowerCase())
        .join('-vs-')
      const filename = `${matchupLabel || 'game'}-box-score.png`
      const imageFile = new File([imageBlob], filename, { type: 'image/png' })
      return {
        imageFile,
        signature,
        usedPreparedImage: false,
      }
    },
    [currentShareSignature, preparedShareImage, shareTeams],
  )

  useEffect(() => {
    if (!isShareOptionsOpen || shareTeams.length === 0) {
      setIsPreparingShareImage(false)
      if (!isShareOptionsOpen) {
        setHasSharePrepareError(false)
      }
      return
    }

    if (preparedShareImage?.signature === currentShareSignature) {
      setIsPreparingShareImage(false)
      setHasSharePrepareError(false)
      return
    }

    const prepareJobId = ++sharePrepareJobIdRef.current

    const prepareInBackground = async () => {
      try {
        setIsPreparingShareImage(true)
        setHasSharePrepareError(false)
        const preparedImage = await prepareShareImage()
        if (sharePrepareJobIdRef.current !== prepareJobId) {
          return
        }

        if (!preparedImage.usedPreparedImage) {
          setPreparedShareImage({
            signature: preparedImage.signature,
            file: preparedImage.imageFile,
          })
        }
        setHasSharePrepareError(false)
      } catch (error) {
        if (sharePrepareJobIdRef.current !== prepareJobId) {
          return
        }

        setHasSharePrepareError(true)
        const normalizedError =
          error instanceof Error
            ? {
                name: error.name,
                message: error.message,
                stack: error.stack,
              }
            : { value: error }
        console.error('[prepareShareImage] Background preparation failed.', {
          error: normalizedError,
          secureContext: window.isSecureContext,
          visibilityState: document.visibilityState,
        })
      } finally {
        if (sharePrepareJobIdRef.current === prepareJobId) {
          setIsPreparingShareImage(false)
        }
      }
    }

    void prepareInBackground()
  }, [
    isShareOptionsOpen,
    shareTeams.length,
    currentShareSignature,
    preparedShareImage?.signature,
    prepareShareImage,
  ])

  const shareBoxScore = async () => {
    if (teams.length === 0 || !sharedBoxScoreRef.current || isSharing) {
      return
    }

    if (shareTeams.length === 0) {
      setShareStatus('Select at least one player to share.')
      return
    }

    let shareDebugContext: Record<string, unknown> | undefined
    let imageFile: File | null = null
    let usedPreparedImage = false

    try {
      setIsSharing(true)
      setShareStatus('')
      setHasSharePrepareError(false)

      const preparedImage = await prepareShareImage()
      imageFile = preparedImage.imageFile
      usedPreparedImage = preparedImage.usedPreparedImage
      if (!preparedImage.usedPreparedImage) {
        setPreparedShareImage({
          signature: preparedImage.signature,
          file: preparedImage.imageFile,
        })
      }

      if (!imageFile) {
        throw new Error('Could not prepare share image.')
      }

      const sharePayload = {
        title: `${shareTeams.map((team) => team.label).join(' vs ')} Box Score`,
        files: [imageFile],
      }
      const canSharePayload = navigator.canShare?.(sharePayload) ?? false
      shareDebugContext = {
        secureContext: window.isSecureContext,
        visibilityState: document.visibilityState,
        supportsShare: typeof navigator.share === 'function',
        supportsCanShare: typeof navigator.canShare === 'function',
        canSharePayload,
        usedPreparedImage,
        userActivation: {
          isActive: navigator.userActivation?.isActive ?? null,
          hasBeenActive: navigator.userActivation?.hasBeenActive ?? null,
        },
        sharePayload: {
          title: sharePayload.title,
          fileCount: sharePayload.files.length,
          files: sharePayload.files.map((file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
          })),
        },
      }

      if (navigator.share && canSharePayload) {
        await navigator.share(sharePayload)
        setShareStatus('Shared successfully.')
      } else {
        console.info('[shareBoxScore] Falling back to download.', shareDebugContext)
        downloadBlob(imageFile, imageFile.name)
        setShareStatus('Image downloaded. Share it from Photos/Files.')
      }
    } catch (error) {
      const errorName = error instanceof Error ? error.name : ''
      if (imageFile === null) {
        setHasSharePrepareError(true)
      }
      const normalizedError =
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : { value: error }
      console.error('[shareBoxScore] Share failed.', {
        error: normalizedError,
        secureContext: window.isSecureContext,
        visibilityState: document.visibilityState,
        userActivation: {
          isActive: navigator.userActivation?.isActive ?? null,
          hasBeenActive: navigator.userActivation?.hasBeenActive ?? null,
        },
        shareDebugContext,
      })
      const lostTransientActivation =
        errorName === 'NotAllowedError' &&
        navigator.userActivation?.isActive === false &&
        !usedPreparedImage &&
        imageFile !== null
      if (lostTransientActivation) {
        console.warn(
          '[shareBoxScore] Share blocked due to transient activation. Reusing prepared image on next tap.',
          { shareDebugContext },
        )
        setShareStatus('Image ready. Tap Share Box Score again.')
        return
      }
      setShareStatus('Could not share image. Try again.')
    } finally {
      setIsSharing(false)
    }
  }

  const shareFromShareOptions = () => {
    if (!isSheetShareReady) {
      return
    }

    closeShareOptions()
    void shareBoxScore()
  }

  const backToSetup = () => {
    setPhase('setup')
    setLastAction('')
    setHistory([])
    setShareStatus('')
    closeShareOptions()
  }

  const showSetup = phase === 'setup' || teams.length === 0
  const showEditNames = phase === 'editNames' && teams.length > 0
  const renderStatHeaderLabel = (abbreviation: string) => {
    const definition = BOX_SCORE_STAT_DEFINITION_BY_ABBREVIATION.get(abbreviation)
    if (!definition) {
      return abbreviation
    }

    return <StatHeaderTerm abbreviation={abbreviation} definition={definition} />
  }

  const renderTeamBoxScore = (team: Team) => (
    <article className="team-boxscore" key={team.id}>
      <h3 className={`team-boxscore-title ${teamColorClass(team.id)}`}>
        {team.label}
      </h3>
      <div className="table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>PTS</th>
              <th>{currentScoringConfig.lowLabel}</th>
              <th>{currentScoringConfig.highLabel}</th>
              <th>AST</th>
              <th>STL</th>
              <th>BLK</th>
              <th>REB</th>
              <th>TOV</th>
              <th>{renderStatHeaderLabel('TOVF')}</th>
              <th>FG</th>
            </tr>
          </thead>
          <tbody>
            {team.players.map((player) => (
              <tr key={player.id}>
                <td>{player.name}</td>
                <td>{playerPoints(player, gameScoringMode)}</td>
                <td>{shootingLine(player.stats.lowPM, player.stats.lowPA)}</td>
                <td>{shootingLine(player.stats.highPM, player.stats.highPA)}</td>
                <td>{player.stats.ast}</td>
                <td>{player.stats.stl}</td>
                <td>{player.stats.blk}</td>
                <td>{player.stats.reb}</td>
                <td>{player.stats.tov}</td>
                <td>{player.stats.tovf}</td>
                <td>{playerFieldGoalsLine(player)}</td>
              </tr>
            ))}
            <tr className="total-row">
              <td>Team</td>
              <td>{teamPoints(team, gameScoringMode)}</td>
              <td>
                {shootingLine(
                  teamStatTotal(team, 'lowPM'),
                  teamStatTotal(team, 'lowPA'),
                )}
              </td>
              <td>
                {shootingLine(
                  teamStatTotal(team, 'highPM'),
                  teamStatTotal(team, 'highPA'),
                )}
              </td>
              <td>{teamStatTotal(team, 'ast')}</td>
              <td>{teamStatTotal(team, 'stl')}</td>
              <td>{teamStatTotal(team, 'blk')}</td>
              <td>{teamStatTotal(team, 'reb')}</td>
              <td>{teamStatTotal(team, 'tov')}</td>
              <td>{teamStatTotal(team, 'tovf')}</td>
              <td>{teamFieldGoalsLine(team)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  )

  return (
    <main className="app">
      <div className="app-shell">
        {showSetup || showEditNames ? (
          <section className="panel">
            <h2 className="panel-title">
              {showEditNames ? 'Edit Names' : 'Game Setup'}
            </h2>
            <p className="panel-copy">
              {showEditNames
                ? 'Update team and player names without resetting game stats.'
                : 'Set players and scoring once for both teams. First names are optional.'}
            </p>

            {showSetup ? (
              <div className="shared-size-control">
                <label className="field-label">Players Per Team</label>
                <div className="size-toggle" role="group" aria-label="Players per team">
                  <button
                    type="button"
                    className={playerCount === 4 ? 'toggle active' : 'toggle'}
                    onClick={() => setPlayerCount(4)}
                  >
                    4 Players
                  </button>
                  <button
                    type="button"
                    className={playerCount === 5 ? 'toggle active' : 'toggle'}
                    onClick={() => setPlayerCount(5)}
                  >
                    5 Players
                  </button>
                </div>
              </div>
            ) : null}

            {showSetup ? (
              <div className="shared-size-control">
                <label className="field-label">Scoring Style</label>
                <div className="size-toggle" role="group" aria-label="Scoring style">
                  <button
                    type="button"
                    className={
                      setupScoringMode === 'twosAndThrees' ? 'toggle active' : 'toggle'
                    }
                    onClick={() => setSetupScoringMode('twosAndThrees')}
                  >
                    2s & 3s
                  </button>
                  <button
                    type="button"
                    className={
                      setupScoringMode === 'onesAndTwos' ? 'toggle active' : 'toggle'
                    }
                    onClick={() => setSetupScoringMode('onesAndTwos')}
                  >
                    1s & 2s
                  </button>
                </div>
              </div>
            ) : null}

            <div className="setup-stack">
              {TEAM_IDS.map((teamId) => {
                const team = setup[teamId]
                return (
                  <article className="team-card" key={teamId}>
                    <div className="team-top-row">
                      <input
                        className="text-input"
                        aria-label="Team Name"
                        placeholder="Team Name"
                        value={team.label}
                        onChange={(event) =>
                          updateTeamLabel(teamId, event.target.value)
                        }
                      />
                    </div>

                    <div className="name-grid">
                      {Array.from({ length: playerCount }, (_, index) => {
                        const playerName = team.names[index] ?? ''

                        return (
                          <label className="name-field" key={`${teamId}-${index + 1}`}>
                            <span>P{index + 1}</span>
                            <div className="name-input-wrap">
                              <input
                                className="text-input"
                                placeholder="Optional"
                                value={playerName}
                                onChange={(event) =>
                                  updatePlayerName(teamId, index, event.target.value)
                                }
                              />
                              {playerName ? (
                                <button
                                  type="button"
                                  className="clear-name-button"
                                  aria-label={`Clear P${index + 1} name`}
                                  onClick={() => updatePlayerName(teamId, index, '')}
                                >
                                  X
                                </button>
                              ) : null}
                            </div>
                          </label>
                        )
                      })}
                    </div>
                  </article>
                )
              })}
            </div>

            {showSetup ? (
              <button type="button" className="primary-button" onClick={startGame}>
                Start Tracking
              </button>
            ) : (
              <div className="edit-actions">
                <button type="button" className="small-button" onClick={saveEditedNames}>
                  Save Names
                </button>
                <button
                  type="button"
                  className="small-button"
                  onClick={cancelEditNames}
                >
                  Cancel
                </button>
              </div>
            )}
          </section>
        ) : (
          <>
            <section className="panel score-panel">
              <div className="score-strip">
                {teams.map((team) => (
                  <article
                    key={team.id}
                    className={`team-score ${teamColorClass(team.id)}${
                      team.id === selectedTeamId ? ' active' : ''
                    }`}
                  >
                    <span>{team.label}</span>
                    <strong>{teamPoints(team, gameScoringMode)}</strong>
                  </article>
                ))}
              </div>

              <div className="meta-row">
                <button
                  type="button"
                  className="small-button"
                  onClick={undoLastAction}
                  disabled={history.length === 0}
                >
                  Undo
                </button>
                <button type="button" className="small-button" onClick={beginEditNames}>
                  Edit Names
                </button>
                <button
                  type="button"
                  className="small-button danger-text"
                  onClick={backToSetup}
                >
                  Reset
                </button>
              </div>

              <p className="log-line">{lastAction || 'Waiting for first play.'}</p>
            </section>

            <section className="panel control-panel">
              <div className="active-target">
                <span>Logging for</span>
                <strong>
                  {selectedTeam?.label ?? 'Team'} /{' '}
                  {selectedPlayer?.name ?? 'Select a player'}
                </strong>
                <small>
                  Scoring: {currentScoringConfig.lowLabel} /{' '}
                  {currentScoringConfig.highLabel}
                </small>
              </div>

              <div className="player-board">
                {teams.map((team) => (
                  <div className="team-player-column" key={team.id}>
                    <p className="team-player-label">{team.label}</p>
                    <div
                      className="team-player-list"
                      style={{ '--player-count': team.players.length } as CSSProperties}
                    >
                      {team.players.map((player) => (
                        <button
                          type="button"
                          key={player.id}
                          className={`player-pill ${teamColorClass(team.id)}${
                            team.id === selectedTeamId && player.id === selectedPlayerId
                              ? ' active'
                              : ''
                          }`}
                          onClick={() => selectPlayerTarget(team.id, player.id)}
                        >
                          <span>{player.name}</span>
                          <small>{playerPoints(player, gameScoringMode)} pts</small>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="action-grid">
                {actionButtons.map((action) => (
                  <button
                    type="button"
                    key={action.id}
                    className={`action-button ${action.tone}`}
                    onClick={() => logAction(action)}
                    disabled={!selectedPlayerId}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="panel table-panel">
              <div className="onscreen-boxscore">{teams.map(renderTeamBoxScore)}</div>

              <div className="table-actions">
                <div className="share-action-row">
                  <button
                    type="button"
                    className="share-button"
                    onClick={openShareOptions}
                    disabled={teams.length === 0}
                  >
                    Share Box Score
                  </button>
                </div>
                {totalSharePlayers > 0 ? (
                  <p className="share-selection-copy">
                    {selectedSharePlayers} of {totalSharePlayers} players selected
                  </p>
                ) : null}
              </div>

              {shareStatusMessage ? <p className="share-status">{shareStatusMessage}</p> : null}

              <div className="share-capture-root" aria-hidden="true">
                <div className="shared-boxscore" ref={sharedBoxScoreRef}>
                  <div
                    className="game-score-strip"
                    style={
                      {
                        '--team-count': Math.max(shareTeams.length, 1),
                      } as CSSProperties
                    }
                  >
                    {shareTeams.map((team) => (
                      <div
                        key={team.id}
                        className={`game-score-team ${teamColorClass(team.id)}`}
                      >
                        <span>{team.label}</span>
                        <strong>{teamPoints(team, gameScoringMode)}</strong>
                      </div>
                    ))}
                  </div>
                  {shareTeams.map(renderTeamBoxScore)}
                  <div className="shared-boxscore-footer">
                    <p className="shared-boxscore-scoring">
                      Scoring: {currentScoringConfig.lowLabel}/{currentScoringConfig.highLabel}
                    </p>
                    {SHARED_BOX_SCORE_GLOSSARY_LINE ? (
                      <p className="shared-boxscore-definitions">
                        Definitions: {SHARED_BOX_SCORE_GLOSSARY_LINE}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {isShareOptionsOpen ? (
              <div
                className="share-sheet-backdrop"
                role="presentation"
                onClick={closeShareOptions}
              >
                <section
                  className="share-sheet"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Share options"
                  style={
                    shareSheetDragOffset > 0
                      ? {
                          transform: `translateY(${shareSheetDragOffset}px)`,
                          transition: isShareSheetDragging
                            ? 'none'
                            : isShareSheetClosing
                              ? `transform ${shareSheetTransitionMs}ms ease-out`
                              : `transform ${shareSheetTransitionMs}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                        }
                      : undefined
                  }
                  onClick={(event) => event.stopPropagation()}
                  onTouchStart={handleShareSheetTouchStart}
                  onTouchMove={handleShareSheetTouchMove}
                  onTouchEnd={handleShareSheetTouchEnd}
                  onTouchCancel={handleShareSheetTouchEnd}
                >
                  <div className="share-sheet-handle" />
                  <header className="share-sheet-header">
                    <h3>Share options</h3>
                    <button
                      type="button"
                      className="share-sheet-close"
                      onClick={closeShareOptions}
                    >
                      Close
                    </button>
                  </header>
                  <p className="share-sheet-count">
                    {selectedSharePlayers} of {totalSharePlayers} players selected
                  </p>

                  <div className="share-sheet-quick-actions">
                    <button
                      type="button"
                      className="share-chip"
                      onClick={() => setShareSelectionForAllPlayers(true)}
                    >
                      All
                    </button>
                    <button
                      type="button"
                      className="share-chip"
                      onClick={() => setShareSelectionForAllPlayers(false)}
                    >
                      None
                    </button>
                    {teams.map((team) => (
                      <button
                        key={team.id}
                        type="button"
                        className="share-chip"
                        onClick={() => setShareSelectionForTeamOnly(team.id)}
                      >
                        {team.label}
                      </button>
                    ))}
                  </div>

                  <div className="share-sheet-team-list" ref={shareSheetTeamListRef}>
                    {teams.map((team) => (
                      <section className="share-team-group" key={team.id}>
                        <p className="share-team-heading">{team.label}</p>
                        <div className="share-player-checklist">
                          {team.players.map((player) => (
                            <label className="share-player-option" key={player.id}>
                              <input
                                type="checkbox"
                                checked={shareSelectionByPlayerId[player.id] !== false}
                                onChange={() => toggleSharePlayer(player.id)}
                              />
                              <span>{player.name}</span>
                              <small>{playerPoints(player, gameScoringMode)} pts</small>
                            </label>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>

                  <div className="share-sheet-footer">
                    <button
                      type="button"
                      className={`primary-button share-apply-button share-sheet-share-button${
                        isSheetShareReady ? ' ready' : ''
                      }`}
                      onClick={shareFromShareOptions}
                      disabled={!isSheetShareReady}
                    >
                      {selectedSharePlayers > 0 && isPreparingShareImage ? (
                        <>
                          <span className="share-spinner" aria-hidden="true" />
                          <span>Preparing</span>
                        </>
                      ) : (
                        'Share'
                      )}
                    </button>
                  </div>
                </section>
              </div>
            ) : null}
          </>
        )}
      </div>
    </main>
  )
}

export default App
