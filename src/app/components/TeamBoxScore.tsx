import {
  BOX_SCORE_STAT_DEFINITION_BY_ABBREVIATION,
  SCORING_CONFIG,
} from '../constants'
import type { ScoringMode, Team } from '../types'
import {
  playerFieldGoalsLine,
  playerPoints,
  shootingLine,
  teamColorClass,
  teamFieldGoalsLine,
  teamPoints,
  teamStatTotal,
} from '../utils/scoring'
import { StatHeaderTerm } from './StatHeaderTerm'

type TeamBoxScoreProps = {
  team: Team
  scoringMode: ScoringMode
}

export const TeamBoxScore = ({ team, scoringMode }: TeamBoxScoreProps) => {
  const scoringConfig = SCORING_CONFIG[scoringMode]
  const renderStatHeaderLabel = (abbreviation: string) => {
    const definition =
      BOX_SCORE_STAT_DEFINITION_BY_ABBREVIATION.get(abbreviation)
    if (!definition) {
      return abbreviation
    }

    return (
      <StatHeaderTerm abbreviation={abbreviation} definition={definition} />
    )
  }

  return (
    <article className="team-boxscore">
      <h3 className={`team-boxscore-title ${teamColorClass(team.id)}`}>
        {team.label}
      </h3>
      <div className="table-wrap">
        <table className="stats-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>PTS</th>
              <th>{scoringConfig.lowLabel}</th>
              <th>{scoringConfig.highLabel}</th>
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
                <td>{playerPoints(player, scoringMode)}</td>
                <td>{shootingLine(player.stats.lowPM, player.stats.lowPA)}</td>
                <td>
                  {shootingLine(player.stats.highPM, player.stats.highPA)}
                </td>
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
              <td>{teamPoints(team, scoringMode)}</td>
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
}
