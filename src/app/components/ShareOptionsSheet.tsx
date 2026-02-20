import type { TouchEvent as ReactTouchEvent, RefObject } from 'react'
import type { ScoringMode, Team, TeamId } from '../types'
import { playerPoints } from '../utils/scoring'

type ShareOptionsSheetProps = {
  isOpen: boolean
  shareSheetDragOffset: number
  isShareSheetDragging: boolean
  isShareSheetClosing: boolean
  shareSheetTransitionMs: number
  selectedSharePlayers: number
  totalSharePlayers: number
  teams: Team[]
  shareSelectionByPlayerId: Record<string, boolean>
  gameScoringMode: ScoringMode
  isPreparingShareImage: boolean
  isSheetShareReady: boolean
  shareSheetTeamListRef: RefObject<HTMLDivElement | null>
  onClose: () => void
  onTouchStart: (event: ReactTouchEvent<HTMLElement>) => void
  onTouchMove: (event: ReactTouchEvent<HTMLElement>) => void
  onTouchEnd: () => void
  onSetShareSelectionForAllPlayers: (isSelected: boolean) => void
  onSetShareSelectionForNamedPlayersOnly: () => void
  onSetShareSelectionForTeamOnly: (teamId: TeamId) => void
  onToggleSharePlayer: (playerId: string) => void
  onShare: () => void
}

export const ShareOptionsSheet = ({
  isOpen,
  shareSheetDragOffset,
  isShareSheetDragging,
  isShareSheetClosing,
  shareSheetTransitionMs,
  selectedSharePlayers,
  totalSharePlayers,
  teams,
  shareSelectionByPlayerId,
  gameScoringMode,
  isPreparingShareImage,
  isSheetShareReady,
  shareSheetTeamListRef,
  onClose,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onSetShareSelectionForAllPlayers,
  onSetShareSelectionForNamedPlayersOnly,
  onSetShareSelectionForTeamOnly,
  onToggleSharePlayer,
  onShare,
}: ShareOptionsSheetProps) => {
  if (!isOpen) {
    return null
  }

  return (
    <div className="share-sheet-backdrop" role="presentation" onClick={onClose}>
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
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div className="share-sheet-handle" />
        <header className="share-sheet-header">
          <h3>Share options</h3>
          <button type="button" className="share-sheet-close" onClick={onClose}>
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
            onClick={() => onSetShareSelectionForAllPlayers(true)}
          >
            All
          </button>
          <button
            type="button"
            className="share-chip"
            onClick={() => onSetShareSelectionForAllPlayers(false)}
          >
            None
          </button>
          <button
            type="button"
            className="share-chip"
            onClick={onSetShareSelectionForNamedPlayersOnly}
          >
            Named Only
          </button>
          {teams.map((team) => (
            <button
              key={team.id}
              type="button"
              className="share-chip"
              onClick={() => onSetShareSelectionForTeamOnly(team.id)}
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
                      onChange={() => onToggleSharePlayer(player.id)}
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
            onClick={onShare}
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
  )
}
