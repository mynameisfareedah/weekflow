import { isAuthenticatedBootstrapBlocked } from '../src/auth/bootstrapState.ts'

const passingCases = [
  { name: 'loading state blocks startup', input: { accountStatus: 'loading', workspaceInitializationPending: false, workspaceReadyOwnerId: null, workspaceInitializationError: '', authenticatedUserId: null }, expected: true },
  { name: 'pending workspace bootstrap blocks while authenticated', input: { accountStatus: 'authenticated', workspaceInitializationPending: true, workspaceReadyOwnerId: null, workspaceInitializationError: '', authenticatedUserId: 'user-1' }, expected: true },
  { name: 'ready owner unblocks authenticated shell', input: { accountStatus: 'authenticated', workspaceInitializationPending: false, workspaceReadyOwnerId: 'user-1', workspaceInitializationError: '', authenticatedUserId: 'user-1' }, expected: false },
  { name: 'authenticated zero-workspace state remains valid', input: { accountStatus: 'authenticated', workspaceInitializationPending: false, workspaceReadyOwnerId: 'user-1', workspaceInitializationError: '', authenticatedUserId: 'user-1' }, expected: false },
  { name: 'workspace bootstrap error reaches terminal state', input: { accountStatus: 'authenticated', workspaceInitializationPending: false, workspaceReadyOwnerId: 'user-1', workspaceInitializationError: 'Cloud workspace bootstrap failed', authenticatedUserId: 'user-1' }, expected: false },
  { name: 'unauthenticated bootstrap is terminal', input: { accountStatus: 'unauthenticated', workspaceInitializationPending: false, workspaceReadyOwnerId: null, workspaceInitializationError: '', authenticatedUserId: null }, expected: false },
]

for (const testCase of passingCases) {
  const actual = isAuthenticatedBootstrapBlocked(testCase.input)
  if (actual !== testCase.expected) {
    throw new Error(`${testCase.name} expected ${String(testCase.expected)} but got ${String(actual)}`)
  }
}

console.log('Auth bootstrap validation passed: loading guard, pending workspace guard, zero-workspace path, and error-terminal path all behave as expected.')
