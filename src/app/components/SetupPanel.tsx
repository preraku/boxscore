import { TEAM_IDS } from '../constants'
import type { ScoringMode, SetupTeam, TeamId, TeamSize } from '../types'

type SetupPanelProps = {
  showSetup: boolean
  showEditNames: boolean
  playerCount: TeamSize
  setupScoringMode: ScoringMode
  setup: Record<TeamId, SetupTeam>
  onSetPlayerCount: (playerCount: TeamSize) => void
  onSetSetupScoringMode: (mode: ScoringMode) => void
  onUpdateTeamLabel: (teamId: TeamId, label: string) => void
  onUpdatePlayerName: (teamId: TeamId, index: number, name: string) => void
  onStartGame: () => void
  onSaveEditedNames: () => void
  onCancelEditNames: () => void
}

export const SetupPanel = ({
  showSetup,
  showEditNames,
  playerCount,
  setupScoringMode,
  setup,
  onSetPlayerCount,
  onSetSetupScoringMode,
  onUpdateTeamLabel,
  onUpdatePlayerName,
  onStartGame,
  onSaveEditedNames,
  onCancelEditNames,
}: SetupPanelProps) => {
  return (
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
          <div
            className="size-toggle"
            role="group"
            aria-label="Players per team"
          >
            <button
              type="button"
              className={playerCount === 4 ? 'toggle active' : 'toggle'}
              onClick={() => onSetPlayerCount(4)}
            >
              4 Players
            </button>
            <button
              type="button"
              className={playerCount === 5 ? 'toggle active' : 'toggle'}
              onClick={() => onSetPlayerCount(5)}
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
                setupScoringMode === 'twosAndThrees'
                  ? 'toggle active'
                  : 'toggle'
              }
              onClick={() => onSetSetupScoringMode('twosAndThrees')}
            >
              2s & 3s
            </button>
            <button
              type="button"
              className={
                setupScoringMode === 'onesAndTwos' ? 'toggle active' : 'toggle'
              }
              onClick={() => onSetSetupScoringMode('onesAndTwos')}
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
                    onUpdateTeamLabel(teamId, event.target.value)
                  }
                />
              </div>

              <div className="name-grid">
                {Array.from({ length: playerCount }, (_, index) => {
                  const playerName = team.names[index] ?? ''

                  return (
                    <label
                      className="name-field"
                      key={`${teamId}-${index + 1}`}
                    >
                      <span>P{index + 1}</span>
                      <div className="name-input-wrap">
                        <input
                          className="text-input"
                          placeholder="Optional"
                          value={playerName}
                          onChange={(event) =>
                            onUpdatePlayerName(
                              teamId,
                              index,
                              event.target.value,
                            )
                          }
                        />
                        {playerName ? (
                          <button
                            type="button"
                            className="clear-name-button"
                            tabIndex={-1}
                            aria-label={`Clear P${index + 1} name`}
                            onClick={() =>
                              onUpdatePlayerName(teamId, index, '')
                            }
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
        <button type="button" className="primary-button" onClick={onStartGame}>
          Start Tracking
        </button>
      ) : (
        <div className="edit-actions">
          <button
            type="button"
            className="small-button"
            onClick={onSaveEditedNames}
          >
            Save Names
          </button>
          <button
            type="button"
            className="small-button"
            onClick={onCancelEditNames}
          >
            Cancel
          </button>
        </div>
      )}
    </section>
  )
}
