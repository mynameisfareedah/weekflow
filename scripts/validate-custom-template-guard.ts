import assert from 'node:assert/strict'
import { CURRENT_WORKSPACE_STORAGE_KEY, WORKSPACES_STORAGE_KEY, getWorkspaceScopedStorageKey } from '../src/storage/workspaceStorage.ts'

const originalWindow = globalThis.window
const originalLocalStorage = globalThis.localStorage

function installStorage(entries: Array<{ weekStart: string; workspaceId: string; activities: unknown[] }>) {
  const store = new Map<string, string>()
  const workspaceA = { id: 'ws-a', ownerId: 'default-user', name: 'Workspace A', templateId: 'custom', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', archived: false }
  const workspaceB = { id: 'ws-b', ownerId: 'default-user', name: 'Workspace B', templateId: 'custom', createdAt: '2025-01-01T00:00:00.000Z', updatedAt: '2025-01-01T00:00:00.000Z', archived: false }
  store.set(WORKSPACES_STORAGE_KEY, JSON.stringify([workspaceA, workspaceB]))
  store.set(CURRENT_WORKSPACE_STORAGE_KEY, 'ws-a')
  for (const entry of entries) {
    const key = getWorkspaceScopedStorageKey('weekflow-daily-activities:', entry.weekStart, entry.workspaceId)
    store.set(key, JSON.stringify(entry.activities))
  }
  const storage = {
    getItem(key: string) { return store.get(key) ?? null },
    setItem(key: string, value: string) { store.set(key, String(value)) },
    removeItem(key: string) { store.delete(key) },
    clear() { store.clear() },
    key(index: number) { return Array.from(store.keys())[index] ?? null },
    get length() { return store.size },
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage } })
}

function restoreStorage() {
  if (originalWindow === undefined) {
    delete (globalThis as { window?: unknown }).window
  } else {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  }
  if (originalLocalStorage === undefined) {
    delete (globalThis as { localStorage?: unknown }).localStorage
  } else {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalLocalStorage })
  }
}

try {
  installStorage([
    { weekStart: '2025-01-06', workspaceId: 'ws-a', activities: [
      { id: 'a1', date: '2025-01-06', weekStart: '2025-01-06', account: 'Alpha', activityType: 'Team Meeting', templateId: 'custom', customCategoryId: 'cat-other', customFieldValues: { 'field-other': 'x', 'field-empty': '' }, structuredOutcomes: [], hcpNames: [], outcome: '', nextAction: '', intelligence: '', createdAt: '2025-01-06T00:00:00.000Z', updatedAt: '2025-01-06T00:00:00.000Z' },
      { id: 'a1b', date: '2025-01-07', weekStart: '2025-01-06', account: 'Alpha', activityType: 'Team Meeting', templateId: 'custom', customCategoryId: 'cat-used', customFieldValues: { 'field-used': 'hello', 'field-empty': '   ', 'field-zero': 0 }, structuredOutcomes: [], hcpNames: [], outcome: '', nextAction: '', intelligence: '', createdAt: '2025-01-06T00:00:00.000Z', updatedAt: '2025-01-06T00:00:00.000Z' },
    ] },
    { weekStart: '2025-01-13', workspaceId: 'ws-a', activities: [
      { id: 'a2', date: '2025-01-13', weekStart: '2025-01-13', account: 'Beta', activityType: 'Team Meeting', templateId: 'custom', customCategoryId: 'cat-used', customFieldValues: { 'field-used': 'hello', 'field-flag': false, 'field-empty-array': [] }, structuredOutcomes: [], hcpNames: [], outcome: '', nextAction: '', intelligence: '', createdAt: '2025-01-13T00:00:00.000Z', updatedAt: '2025-01-13T00:00:00.000Z' },
      { id: 'a2b', date: '2025-01-14', weekStart: '2025-01-13', account: 'Beta', activityType: 'Team Meeting', templateId: 'custom', customCategoryId: 'cat-other', customFieldValues: { 'field-used': null, 'field-flag': false }, structuredOutcomes: [], hcpNames: [], outcome: '', nextAction: '', intelligence: '', createdAt: '2025-01-13T00:00:00.000Z', updatedAt: '2025-01-13T00:00:00.000Z' },
      { id: 'a2c', date: '2025-01-15', weekStart: '2025-01-13', account: 'Beta', activityType: 'Team Meeting', templateId: 'custom', customCategoryId: 'cat-used', customFieldValues: { 'field-used': 'again', 'field-flag': false }, structuredOutcomes: [], hcpNames: [], outcome: '', nextAction: '', intelligence: '', createdAt: '2025-01-13T00:00:00.000Z', updatedAt: '2025-01-13T00:00:00.000Z' },
    ] },
    { weekStart: '2025-01-06', workspaceId: 'ws-b', activities: [
      { id: 'a3', date: '2025-01-06', weekStart: '2025-01-06', account: 'Gamma', activityType: 'Team Meeting', templateId: 'custom', customCategoryId: 'cat-used', customFieldValues: { 'field-used': 'other-workspace' }, structuredOutcomes: [], hcpNames: [], outcome: '', nextAction: '', intelligence: '', createdAt: '2025-01-06T00:00:00.000Z', updatedAt: '2025-01-06T00:00:00.000Z' },
    ] },
  ])

  const { getCustomCategoryUsage, getCustomFieldUsage, hasDailyActivityWithCustomCategory, hasDailyActivityWithCustomField } = await import('../src/storage/dailyActivityStorage.ts')

  const workspaceId = 'ws-a'
  const currentWorkspaceId = globalThis.window.localStorage.getItem(CURRENT_WORKSPACE_STORAGE_KEY)
  const wsAKey = getWorkspaceScopedStorageKey('weekflow-daily-activities:', '2025-01-13', workspaceId)
  const rawWsAValue = globalThis.window.localStorage.getItem(wsAKey)
  const prefix = 'weekflow-daily-activities:ws-a:'
  const allKeys = Array.from({ length: globalThis.window.localStorage.length }, (_, index) => globalThis.window.localStorage.key(index))
  const selectedKeys = allKeys.filter((key): key is string => typeof key === 'string' && key.startsWith(prefix))
  const parsedActivities = selectedKeys.flatMap((key) => {
    const value = globalThis.window.localStorage.getItem(key)
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })
  const matchingActivity = parsedActivities.find((activity) => {
    if (!activity || typeof activity !== 'object') return false
    const candidate = activity as { customCategoryId?: string; customFieldValues?: Record<string, unknown> }
    return candidate.customCategoryId === 'cat-used' || Object.prototype.hasOwnProperty.call(candidate.customFieldValues ?? {}, 'field-used')
  }) as { customCategoryId?: string; customFieldValues?: Record<string, unknown> } | undefined

  console.log('workspace ID', workspaceId)
  console.log('current workspace ID', currentWorkspaceId)
  console.log('all localStorage keys', allKeys)
  console.log('exact key written for the ws-a activity', wsAKey)
  console.log('value stored under that key', rawWsAValue)
  console.log('prefix used by scanStoredActivitiesForWorkspace()', prefix)
  console.log('keys actually selected by the scanner', selectedKeys)
  console.log('parsed activities found by the scanner', parsedActivities)
  console.log('activity customCategoryId', matchingActivity?.customCategoryId ?? null)
  console.log('activity customFieldValues', matchingActivity?.customFieldValues ?? null)

  assert.equal(await hasDailyActivityWithCustomCategory('cat-unused', 'ws-a'), false)
  assert.equal(await hasDailyActivityWithCustomCategory('cat-used', 'ws-a'), true)
  assert.equal(await hasDailyActivityWithCustomField('field-unused', 'ws-a'), false)
  assert.equal(await hasDailyActivityWithCustomField('field-used', 'ws-a'), true)
  assert.equal(await hasDailyActivityWithCustomCategory('cat-used', 'ws-b'), true)
  assert.equal(await hasDailyActivityWithCustomField('field-used', 'ws-b'), true)

  const categoryUsage = await getCustomCategoryUsage('cat-used', 'ws-a')
  assert.deepEqual(categoryUsage, { isUsed: true, usageCount: 3, affectedWeekCount: 2, weeks: ['2025-01-06', '2025-01-13'] })
  const unusedCategoryUsage = await getCustomCategoryUsage('cat-unused', 'ws-a')
  assert.deepEqual(unusedCategoryUsage, { isUsed: false, usageCount: 0, affectedWeekCount: 0, weeks: [] })

  const fieldUsage = await getCustomFieldUsage('field-used', 'ws-a')
  assert.deepEqual(fieldUsage, { isUsed: true, usageCount: 3, affectedWeekCount: 2, weeks: ['2025-01-06', '2025-01-13'] })
  const zeroFieldUsage = await getCustomFieldUsage('field-zero', 'ws-a')
  assert.deepEqual(zeroFieldUsage, { isUsed: true, usageCount: 1, affectedWeekCount: 1, weeks: ['2025-01-06'] })
  const falseFieldUsage = await getCustomFieldUsage('field-flag', 'ws-a')
  assert.deepEqual(falseFieldUsage, { isUsed: true, usageCount: 3, affectedWeekCount: 1, weeks: ['2025-01-13'] })
  const emptyStringUsage = await getCustomFieldUsage('field-empty', 'ws-a')
  assert.deepEqual(emptyStringUsage, { isUsed: false, usageCount: 0, affectedWeekCount: 0, weeks: [] })
  const whitespaceUsage = await getCustomFieldUsage('field-empty-array', 'ws-a')
  assert.deepEqual(whitespaceUsage, { isUsed: false, usageCount: 0, affectedWeekCount: 0, weeks: [] })
  const otherWorkspaceFieldUsage = await getCustomFieldUsage('field-used', 'ws-b')
  assert.deepEqual(otherWorkspaceFieldUsage, { isUsed: true, usageCount: 1, affectedWeekCount: 1, weeks: ['2025-01-06'] })

  console.log('custom-template guard validation passed')
} finally {
  restoreStorage()
}
