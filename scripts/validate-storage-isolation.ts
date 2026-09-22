import { canUseLegacyStorageFallback, selectStorageValue } from '../src/storage/legacyStoragePolicy.ts'

const scopedWorkspaceData = { workspaceId: 'workspace-a', weekStart: '2026-09-14', value: 'A' }
const legacyData = { weekStart: '2026-09-14', value: 'legacy' }
const staleLocalActivity = { id: 'local-stale', value: 'Stale local activity' }
const cloudActivity = { id: 'cloud-current', value: 'Cloud activity' }

if (selectStorageValue(scopedWorkspaceData, legacyData, false) !== scopedWorkspaceData) throw new Error('Scoped workspace data must remain authoritative')
if (selectStorageValue([], [staleLocalActivity], false)?.length !== 0) throw new Error('An explicitly empty cloud record must remain empty')
if (selectStorageValue([cloudActivity], [staleLocalActivity], false)?.[0] !== cloudActivity) throw new Error('Cloud activity must override stale local activity')
if (selectStorageValue([], [cloudActivity], false)?.length !== 0) throw new Error('Cloud deletion must not resurrect local activity')
if (selectStorageValue(null, legacyData, false) !== null) throw new Error('Authenticated workspace must not read legacy data when scoped data is absent')
if (selectStorageValue(null, legacyData, false) !== null) throw new Error('Authenticated zero-workspace state must not read legacy data')
if (selectStorageValue(null, legacyData, false) !== null) throw new Error('A workspace with no data must remain empty')
if (selectStorageValue({ workspaceId: 'workspace-b', weekStart: '2026-09-14', value: 'B' }, legacyData, false)?.value !== 'B') throw new Error('Workspace B must read only its own scoped data')
if (selectStorageValue({ workspaceId: 'workspace-a', ownerId: 'account-a', value: 'A' }, { workspaceId: 'workspace-b', ownerId: 'account-b', value: 'B' }, false)?.value !== 'A') throw new Error('Account A must read only account A scoped data')
if (!canUseLegacyStorageFallback(false, null)) throw new Error('Unauthenticated demo mode should preserve legacy compatibility')
if (canUseLegacyStorageFallback(true, null)) throw new Error('Configured authenticated mode must not use legacy compatibility')
if (canUseLegacyStorageFallback(true, 'account-a')) throw new Error('Authenticated owner context must not use legacy compatibility')
if (selectStorageValue(null, legacyData, true) !== legacyData) throw new Error('Demo mode should retain legacy compatibility')

console.log('Storage isolation validation passed: scoped authority, absent scoped data, zero-workspace state, workspace/account isolation, and demo compatibility checks.')