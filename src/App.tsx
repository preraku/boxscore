import html2canvas from 'html2canvas'
import { useRef, useState, type CSSProperties } from 'react'
import './App.css'

type TeamSize = 4 | 5
type TeamId = 'A' | 'B'
type ScoringMode = 'twosAndThrees' | 'onesAndTwos'
type StatKey = 'lowPA' | 'lowPM' | 'highPA' | 'highPM' | 'ast' | 'stl' | 'blk'

type StatLine = {
  lowPA: number
  lowPM: number
  highPA: number
  highPM: number
  ast: number
  stl: number
  blk: number
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

const TEAM_IDS: TeamId[] = ['A', 'B']
const STAT_KEYS: StatKey[] = [
  'lowPA',
  'lowPM',
  'highPA',
  'highPM',
  'ast',
  'stl',
  'blk',
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
})

const createSetupTeam = (label: string): SetupTeam => ({
  label,
  names: ['', '', '', '', ''],
})

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

const teamColorClass = (teamId: TeamId): string =>
  teamId === 'A' ? 'team-a' : 'team-b'

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
  const [phase, setPhase] = useState<'setup' | 'game' | 'editNames'>('setup')
  const [playerCount, setPlayerCount] = useState<TeamSize>(5)
  const [setupScoringMode, setSetupScoringMode] =
    useState<ScoringMode>('twosAndThrees')
  const [gameScoringMode, setGameScoringMode] =
    useState<ScoringMode>('twosAndThrees')
  const [setup, setSetup] = useState<Record<TeamId, SetupTeam>>({
    A: createSetupTeam('Team A'),
    B: createSetupTeam('Team B'),
  })
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<TeamId>('A')
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('')
  const [history, setHistory] = useState<LoggedAction[]>([])
  const [lastAction, setLastAction] = useState<string>('')
  const [shareStatus, setShareStatus] = useState<string>('')
  const [isSharing, setIsSharing] = useState(false)
  const sharedBoxScoreRef = useRef<HTMLDivElement | null>(null)

  const selectedTeam = teams.find((team) => team.id === selectedTeamId)
  const selectedPlayer = selectedTeam?.players.find(
    (player) => player.id === selectedPlayerId,
  )
  const currentScoringConfig = SCORING_CONFIG[gameScoringMode]
  const actionButtons = scoringActions(gameScoringMode)

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

  const shareBoxScore = async () => {
    if (teams.length === 0 || !sharedBoxScoreRef.current || isSharing) {
      return
    }

    try {
      setIsSharing(true)
      setShareStatus('')

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

      const matchupLabel = teams
        .map((team) => team.label.trim().replace(/\s+/g, '-').toLowerCase())
        .join('-vs-')
      const filename = `${matchupLabel || 'game'}-box-score.png`
      const imageFile = new File([imageBlob], filename, { type: 'image/png' })
      const sharePayload = {
        title: `${teams.map((team) => team.label).join(' vs ')} Box Score`,
        files: [imageFile],
      }

      if (navigator.share && navigator.canShare?.(sharePayload)) {
        await navigator.share(sharePayload)
        setShareStatus('Shared successfully.')
      } else {
        downloadBlob(imageBlob, filename)
        setShareStatus('Image downloaded. Share it from Photos/Files.')
      }
    } catch {
      setShareStatus('Could not share image. Try again.')
    } finally {
      setIsSharing(false)
    }
  }

  const backToSetup = () => {
    setPhase('setup')
    setLastAction('')
    setHistory([])
    setShareStatus('')
  }

  const showSetup = phase === 'setup' || teams.length === 0
  const showEditNames = phase === 'editNames' && teams.length > 0
  const renderTeamBoxScore = (team: Team) => (
    <article className="team-boxscore" key={team.id}>
      <h3 className={`team-boxscore-title ${teamColorClass(team.id)}`}>
        {team.label} Box Score
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
                      <label
                        className="field-label"
                        htmlFor={`team-label-${teamId}`}
                      >
                        Team Name
                      </label>
                      <input
                        id={`team-label-${teamId}`}
                        className="text-input"
                        value={team.label}
                        onChange={(event) =>
                          updateTeamLabel(teamId, event.target.value)
                        }
                      />
                    </div>

                    <div className="name-grid">
                      {Array.from({ length: playerCount }, (_, index) => (
                        <label className="name-field" key={`${teamId}-${index + 1}`}>
                          <span>P{index + 1}</span>
                          <input
                            className="text-input"
                            placeholder="Optional"
                            value={team.names[index] ?? ''}
                            onChange={(event) =>
                              updatePlayerName(teamId, index, event.target.value)
                            }
                          />
                        </label>
                      ))}
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
              <div className="table-actions">
                <button
                  type="button"
                  className="share-button"
                  onClick={shareBoxScore}
                  disabled={teams.length === 0 || isSharing}
                >
                  {isSharing ? 'Preparing Image...' : 'Share Box Score'}
                </button>
              </div>

              {shareStatus ? <p className="share-status">{shareStatus}</p> : null}

              <div className="onscreen-boxscore">{teams.map(renderTeamBoxScore)}</div>

              <div className="share-capture-root" aria-hidden="true">
                <div className="shared-boxscore" ref={sharedBoxScoreRef}>
                  <div className="game-score-strip">
                    {teams.map((team) => (
                      <div
                        key={team.id}
                        className={`game-score-team ${teamColorClass(team.id)}`}
                      >
                        <span>{team.label}</span>
                        <strong>{teamPoints(team, gameScoringMode)}</strong>
                      </div>
                    ))}
                  </div>
                  {teams.map(renderTeamBoxScore)}
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

export default App
