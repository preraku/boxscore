import type { SetupTeam, TeamId } from './types'

export const createSetupTeam = (label: string): SetupTeam => ({
  label,
  names: ['', '', '', '', ''],
})

export const defaultSetup = (): Record<TeamId, SetupTeam> => ({
  A: createSetupTeam('Team A'),
  B: createSetupTeam('Team B'),
})
