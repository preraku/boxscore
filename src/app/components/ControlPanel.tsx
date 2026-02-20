import type { CSSProperties } from 'react'
import { SCORING_CONFIG } from '../constants'
import type { ActionDefinition, ScoringMode, Team, TeamId } from '../types'
import { playerPoints, teamColorClass } from '../utils/scoring'

type ControlPanelProps = {
  selectedTeamLabel?: string
  selectedPlayerName?: string
  teams: Team[]
  selectedTeamId: TeamId
  selectedPlayerId: string
  gameScoringMode: ScoringMode
  actionButtons: ActionDefinition[]
  onSelectPlayerTarget: (teamId: TeamId, playerId: string) => void
  onLogAction: (action: ActionDefinition) => void
}

export const ControlPanel = ({
  selectedTeamLabel,
  selectedPlayerName,
  teams,
  selectedTeamId,
  selectedPlayerId,
  gameScoringMode,
  actionButtons,
  onSelectPlayerTarget,
  onLogAction,
}: ControlPanelProps) => {
  const currentScoringConfig = SCORING_CONFIG[gameScoringMode]

  return (
    <section className="panel control-panel">
      <div className="active-target">
        <span>Logging for</span>
        <strong>
          {selectedTeamLabel ?? 'Team'} /{' '}
          {selectedPlayerName ?? 'Select a player'}
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
                  onClick={() => onSelectPlayerTarget(team.id, player.id)}
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
            onClick={() => onLogAction(action)}
            disabled={!selectedPlayerId}
          >
            {action.label}
          </button>
        ))}
      </div>
    </section>
  )
}
