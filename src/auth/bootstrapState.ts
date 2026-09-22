import type { AccountState } from '../account'

export type BootstrapGuardInput = {
  accountStatus: AccountState['status']
  workspaceInitializationPending: boolean
  workspaceReadyOwnerId: string | null
  workspaceInitializationError: string
  authenticatedUserId: string | null
}

export function isAuthenticatedBootstrapBlocked({
  accountStatus,
  workspaceInitializationPending,
  workspaceReadyOwnerId,
  workspaceInitializationError,
  authenticatedUserId,
}: BootstrapGuardInput): boolean {
  if (accountStatus === 'loading') return true
  if (accountStatus !== 'authenticated' || !authenticatedUserId) return false

  if (workspaceInitializationError) return false
  if (workspaceInitializationPending) return true
  if (!workspaceReadyOwnerId) return false
  return workspaceReadyOwnerId !== authenticatedUserId
}
