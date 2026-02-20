import type { CSSProperties, RefObject } from 'react'
import { createPortal } from 'react-dom'
import { SCORING_CONFIG, SHARED_BOX_SCORE_GLOSSARY_LINE } from '../constants'
import type { ScoringMode, Team } from '../types'
import { teamColorClass, teamPoints } from '../utils/scoring'
import { TeamBoxScore } from './TeamBoxScore'

type SharedBoxScorePortalProps = {
  shareCapturePortalRoot: HTMLDivElement | null
  sharedBoxScoreRef: RefObject<HTMLDivElement | null>
  shareTeams: Team[]
  playersPerTeam: number
  gameScoringMode: ScoringMode
}

export const SharedBoxScorePortal = ({
  shareCapturePortalRoot,
  sharedBoxScoreRef,
  shareTeams,
  playersPerTeam,
  gameScoringMode,
}: SharedBoxScorePortalProps) => {
  if (!shareCapturePortalRoot) {
    return null
  }

  const currentScoringConfig = SCORING_CONFIG[gameScoringMode]

  return createPortal(
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
        {shareTeams.map((team) => (
          <TeamBoxScore
            key={team.id}
            team={team}
            scoringMode={gameScoringMode}
          />
        ))}
        <div className="shared-boxscore-footer">
          <p className="shared-boxscore-scoring">
            Format: {playersPerTeam}v{playersPerTeam},{' '}
            {currentScoringConfig.lowLabel}/{currentScoringConfig.highLabel}
          </p>
          {SHARED_BOX_SCORE_GLOSSARY_LINE ? (
            <p className="shared-boxscore-definitions">
              Definitions: {SHARED_BOX_SCORE_GLOSSARY_LINE}
            </p>
          ) : null}
        </div>
      </div>
    </div>,
    shareCapturePortalRoot,
  )
}
