import type { ScoringMode, Team, TeamId } from '../types'
import { teamColorClass, teamPoints } from '../utils/scoring'

type ScorePanelProps = {
  teams: Team[]
  selectedTeamId: TeamId
  gameScoringMode: ScoringMode
  historyLength: number
  lastAction: string
  onUndoLastAction: () => void
  onBeginEditNames: () => void
  onBackToSetup: () => void
}

export const ScorePanel = ({
  teams,
  selectedTeamId,
  gameScoringMode,
  historyLength,
  lastAction,
  onUndoLastAction,
  onBeginEditNames,
  onBackToSetup,
}: ScorePanelProps) => {
  return (
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
          onClick={onUndoLastAction}
          disabled={historyLength === 0}
        >
          Undo
        </button>
        <button
          type="button"
          className="small-button"
          onClick={onBeginEditNames}
        >
          Edit Names
        </button>
        <button
          type="button"
          className="small-button danger-text"
          onClick={onBackToSetup}
        >
          Reset
        </button>
      </div>

      <p className="log-line">{lastAction || 'Waiting for first play.'}</p>
    </section>
  )
}
