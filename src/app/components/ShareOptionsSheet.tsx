import { useEffect, useState } from 'react'
import { Sheet } from 'react-modal-sheet'
import type { ScoringMode, Team, TeamId } from '../types'
import { playerPoints } from '../utils/scoring'

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(min-width: 48rem)').matches,
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 48rem)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

type ShareOptionsSheetProps = {
  isOpen: boolean
  selectedSharePlayers: number
  totalSharePlayers: number
  teams: Team[]
  shareSelectionByPlayerId: Record<string, boolean>
  gameScoringMode: ScoringMode
  isPreparingShareImage: boolean
  isSheetShareReady: boolean
  onClose: () => void
  onSetShareSelectionForAllPlayers: (isSelected: boolean) => void
  onSetShareSelectionForNamedPlayersOnly: () => void
  onSetShareSelectionForTeamOnly: (teamId: TeamId) => void
  onToggleSharePlayer: (playerId: string) => void
  onShare: () => void
}

export const ShareOptionsSheet = ({
  isOpen,
  selectedSharePlayers,
  totalSharePlayers,
  teams,
  shareSelectionByPlayerId,
  gameScoringMode,
  isPreparingShareImage,
  isSheetShareReady,
  onClose,
  onSetShareSelectionForAllPlayers,
  onSetShareSelectionForNamedPlayersOnly,
  onSetShareSelectionForTeamOnly,
  onToggleSharePlayer,
  onShare,
}: ShareOptionsSheetProps) => {
  const isDesktop = useIsDesktop()

  const quickActions = (
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
  )

  const teamList = (
    <div className="share-sheet-team-list">
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
  )

  const shareButton = (
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
  )

  if (isDesktop) {
    if (!isOpen) return null
    return (
      <div className="share-sheet-backdrop" role="presentation" onClick={onClose}>
        <section
          className="share-sheet"
          role="dialog"
          aria-modal="true"
          aria-label="Share options"
          onClick={(e) => e.stopPropagation()}
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
          {quickActions}
          {teamList}
          <div className="share-sheet-footer">{shareButton}</div>
        </section>
      </div>
    )
  }

  return (
    <Sheet isOpen={isOpen} onClose={onClose} detent="content">
      <Sheet.Container
        style={{
          background: 'var(--ss-bg)',
          borderTopLeftRadius: 'var(--ss-radius)',
          borderTopRightRadius: 'var(--ss-radius)',
          boxShadow: 'var(--ss-shadow)',
          border: '1px solid var(--ss-border-color)',
          borderBottom: 'none',
        }}
      >
        <Sheet.Header />

        <div className="share-sheet-fixed-top">
          <header className="share-sheet-header">
            <h3>Share options</h3>
          </header>
          <p className="share-sheet-count">
            {selectedSharePlayers} of {totalSharePlayers} players selected
          </p>
          {quickActions}
        </div>

        <Sheet.Content
          scrollStyle={{
            paddingTop: 'var(--ss-gap)',
            paddingLeft: 'var(--ss-h-pad)',
            paddingRight: 'calc(var(--ss-h-pad) + 0.1rem)',
            paddingBottom: '0.5rem',
          }}
        >
          {teamList}
        </Sheet.Content>

        <div className="share-sheet-footer">{shareButton}</div>
      </Sheet.Container>
      <Sheet.Backdrop
        onClick={onClose}
        style={{ backgroundColor: 'rgba(12, 24, 38, 0.36)' }}
      />
    </Sheet>
  )
}
