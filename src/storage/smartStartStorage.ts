import { getCurrentCloudWorkspaceId, getCurrentWorkspaceId, getLegacyCompatibleStorageKey, getWorkspaceScopedStorageKey, shouldUseLegacyStorageFallback, hasAuthenticatedCloudWorkspace } from './workspaceStorage'
import { supabase } from '../lib/supabase'

export type SmartStartCompletion = 'started' | 'fresh'

const STORAGE_PREFIX = 'weekflow-smart-start:'

function getWorkspaceStorageKey(weekStart: string, workspaceId = getCurrentWorkspaceId()) {
  return workspaceId ? getWorkspaceScopedStorageKey(STORAGE_PREFIX, weekStart, workspaceId) : null
}

function getLegacyCompatibleStorageValue(weekStart: string, workspaceId = getCurrentWorkspaceId()) {
  if (!shouldUseLegacyStorageFallback() || workspaceId === null) return null
  return window.localStorage.getItem(getLegacyCompatibleStorageKey(STORAGE_PREFIX, weekStart))
}

function loadSmartStartCompletionLocal(weekStart: string): SmartStartCompletion | null {
  try {
    if (hasAuthenticatedCloudWorkspace()) return null
    const workspaceId = getCurrentWorkspaceId()
    const key = getWorkspaceStorageKey(weekStart, workspaceId)
    const value = (key ? window.localStorage.getItem(key) : null) ?? getLegacyCompatibleStorageValue(weekStart, workspaceId)
    return value === 'started' || value === 'fresh' ? value : null
  } catch {
    return null
  }
}

function saveSmartStartCompletionLocal(weekStart: string, completion: SmartStartCompletion) {
  try {
    const workspaceId = getCurrentWorkspaceId()
    const workspaceKey = getWorkspaceStorageKey(weekStart, workspaceId)
    if (!workspaceId || !workspaceKey) return
    window.localStorage.setItem(workspaceKey, completion)
    if (shouldUseLegacyStorageFallback()) {
      window.localStorage.setItem(getLegacyCompatibleStorageKey(STORAGE_PREFIX, weekStart), completion)
    }
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

export function loadSmartStartCompletion(weekStart: string): SmartStartCompletion | null {
  return loadSmartStartCompletionLocal(weekStart)
}

export function saveSmartStartCompletion(weekStart: string, completion: SmartStartCompletion) {
  saveSmartStartCompletionLocal(weekStart, completion)
}

export async function loadSmartStartCompletionAsync(weekStart: string): Promise<SmartStartCompletion | null> {
  const localCompletion = loadSmartStartCompletionLocal(weekStart)
  if (!supabase) return localCompletion
  try {
    const workspaceId = await getCurrentCloudWorkspaceId()
    if (!workspaceId) return null

    const { data, error } = await supabase
      .from('smart_start')
      .select('data')
      .eq('workspace_id', workspaceId)
      .eq('week_start', weekStart)
      .maybeSingle()
    if (error) throw error

    const completion = data?.data === 'started' || data?.data === 'fresh' ? data.data : null
    if (completion) saveSmartStartCompletionLocal(weekStart, completion)
    return completion
  } catch {
    throw new Error('Smart Start state could not be loaded from the workspace.')
  }
}

export async function saveSmartStartCompletionAsync(weekStart: string, completion: SmartStartCompletion): Promise<boolean> {
  if (!supabase) {
    saveSmartStartCompletionLocal(weekStart, completion)
    return true
  }
  try {
    const workspaceId = await getCurrentCloudWorkspaceId()
    if (!workspaceId) return false

    const weekRecord = await supabase
      .from('workspace_weeks')
      .upsert({ workspace_id: workspaceId, week_start: weekStart }, { onConflict: 'workspace_id,week_start' })
    if (weekRecord.error) throw weekRecord.error

    const smartStartRecord = await supabase
      .from('smart_start')
      .upsert({ workspace_id: workspaceId, week_start: weekStart, data: completion }, { onConflict: 'workspace_id,week_start' })
    if (smartStartRecord.error) throw smartStartRecord.error
    saveSmartStartCompletionLocal(weekStart, completion)
    return true
  } catch {
    return false
  }
}
