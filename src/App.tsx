import html2canvas from 'html2canvas'
import {
  type TouchEvent as ReactTouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import './App.css'
import { ControlPanel } from './app/components/ControlPanel'
import { ScorePanel } from './app/components/ScorePanel'
import { SetupPanel } from './app/components/SetupPanel'
import { SharedBoxScorePortal } from './app/components/SharedBoxScorePortal'
import { ShareOptionsSheet } from './app/components/ShareOptionsSheet'
import { TeamBoxScore } from './app/components/TeamBoxScore'
import { TEAM_IDS } from './app/constants'
import { defaultSetup } from './app/setup'
import { loadPersistedState, persistState } from './app/storage'
import type {
  ActionDefinition,
  LoggedAction,
  PersistedState,
  Phase,
  PreparedShareImage,
  ScoringMode,
  SetupTeam,
  Team,
  TeamId,
  TeamSize,
} from './app/types'
import { applyDelta, blankStatLine, scoringActions } from './app/utils/scoring'
import {
  buildDefaultShareSelection,
  isDefaultPlayerName,
  shareCaptureSignature,
  syncShareSelection,
} from './app/utils/share'

function App() {
  const [persistedState] = useState<PersistedState | null>(() =>
    loadPersistedState(),
  )
  const [phase, setPhase] = useState<Phase>(
    () => persistedState?.phase ?? 'setup',
  )
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
  const [preparedShareImage, setPreparedShareImage] =
    useState<PreparedShareImage | null>(null)
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
  const [shareCapturePortalRoot, setShareCapturePortalRoot] =
    useState<HTMLDivElement | null>(null)
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
  const playersPerTeam = teams[0]?.players.length ?? playerCount
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
  const totalSharePlayers = teams.reduce(
    (total, team) => total + team.players.length,
    0,
  )
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
    const portalRoot = document.createElement('div')
    portalRoot.className = 'share-capture-portal-root'
    portalRoot.setAttribute('aria-hidden', 'true')
    document.body.append(portalRoot)
    setShareCapturePortalRoot(portalRoot)

    return () => {
      portalRoot.remove()
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
    const shouldDismiss =
      dragDistance > 64 || (dragDistance > 28 && elapsedMs < 220)
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

  const setShareSelectionForNamedPlayersOnly = () => {
    setShareStatus('')
    setShareSelectionByPlayerId((currentSelection) => {
      const nextSelection = { ...currentSelection }

      for (const team of teams) {
        for (const player of team.players) {
          nextSelection[player.id] = !isDefaultPlayerName(player.name)
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

  const prepareShareImage = useCallback(async (): Promise<{
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
  }, [currentShareSignature, preparedShareImage, shareTeams])

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
        console.info(
          '[shareBoxScore] Falling back to download.',
          shareDebugContext,
        )
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

  return (
    <main className="app">
      <div className="app-shell">
        {showSetup || showEditNames ? (
          <SetupPanel
            showSetup={showSetup}
            showEditNames={showEditNames}
            playerCount={playerCount}
            setupScoringMode={setupScoringMode}
            setup={setup}
            onSetPlayerCount={setPlayerCount}
            onSetSetupScoringMode={setSetupScoringMode}
            onUpdateTeamLabel={updateTeamLabel}
            onUpdatePlayerName={updatePlayerName}
            onStartGame={startGame}
            onSaveEditedNames={saveEditedNames}
            onCancelEditNames={cancelEditNames}
          />
        ) : (
          <>
            <ScorePanel
              teams={teams}
              selectedTeamId={selectedTeamId}
              gameScoringMode={gameScoringMode}
              historyLength={history.length}
              lastAction={lastAction}
              onUndoLastAction={undoLastAction}
              onBeginEditNames={beginEditNames}
              onBackToSetup={backToSetup}
            />

            <ControlPanel
              selectedTeamLabel={selectedTeam?.label}
              selectedPlayerName={selectedPlayer?.name}
              teams={teams}
              selectedTeamId={selectedTeamId}
              selectedPlayerId={selectedPlayerId}
              gameScoringMode={gameScoringMode}
              actionButtons={actionButtons}
              onSelectPlayerTarget={selectPlayerTarget}
              onLogAction={logAction}
            />

            <section className="panel table-panel">
              <div className="onscreen-boxscore">
                {teams.map((team) => (
                  <TeamBoxScore
                    key={team.id}
                    team={team}
                    scoringMode={gameScoringMode}
                  />
                ))}
              </div>

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
                    {selectedSharePlayers} of {totalSharePlayers} players
                    selected
                  </p>
                ) : null}
              </div>

              {shareStatusMessage ? (
                <p className="share-status">{shareStatusMessage}</p>
              ) : null}

              <SharedBoxScorePortal
                shareCapturePortalRoot={shareCapturePortalRoot}
                sharedBoxScoreRef={sharedBoxScoreRef}
                shareTeams={shareTeams}
                playersPerTeam={playersPerTeam}
                gameScoringMode={gameScoringMode}
              />
            </section>

            <ShareOptionsSheet
              isOpen={isShareOptionsOpen}
              shareSheetDragOffset={shareSheetDragOffset}
              isShareSheetDragging={isShareSheetDragging}
              isShareSheetClosing={isShareSheetClosing}
              shareSheetTransitionMs={shareSheetTransitionMs}
              selectedSharePlayers={selectedSharePlayers}
              totalSharePlayers={totalSharePlayers}
              teams={teams}
              shareSelectionByPlayerId={shareSelectionByPlayerId}
              gameScoringMode={gameScoringMode}
              isPreparingShareImage={isPreparingShareImage}
              isSheetShareReady={isSheetShareReady}
              shareSheetTeamListRef={shareSheetTeamListRef}
              onClose={closeShareOptions}
              onTouchStart={handleShareSheetTouchStart}
              onTouchMove={handleShareSheetTouchMove}
              onTouchEnd={handleShareSheetTouchEnd}
              onSetShareSelectionForAllPlayers={setShareSelectionForAllPlayers}
              onSetShareSelectionForNamedPlayersOnly={
                setShareSelectionForNamedPlayersOnly
              }
              onSetShareSelectionForTeamOnly={setShareSelectionForTeamOnly}
              onToggleSharePlayer={toggleSharePlayer}
              onShare={shareFromShareOptions}
            />
          </>
        )}
      </div>
    </main>
  )
}

export default App
