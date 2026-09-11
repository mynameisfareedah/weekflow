import { getCurrentCloudWorkspaceId, getCurrentWorkspaceId, getLegacyCompatibleStorageKey, getLegacyCompatibleWorkspaceId, getWorkspaceScopedStorageKey } from './workspaceStorage'
import { supabase } from '../lib/supabase'

export type SmartStartCompletion = 'started' | 'fresh'

const STORAGE_PREFIX = 'weekflow-smart-start:'

function getWorkspaceStorageKey(weekStart: string, workspaceId = getCurrentWorkspaceId()) {
  return getWorkspaceScopedStorageKey(STORAGE_PREFIX, weekStart, workspaceId)
}

function getLegacyCompatibleStorageValue(weekStart: string, workspaceId = getCurrentWorkspaceId()) {
  if (workspaceId !== getLegacyCompatibleWorkspaceId()) return null
  return window.localStorage.getItem(getLegacyCompatibleStorageKey(STORAGE_PREFIX, weekStart))
}

function loadSmartStartCompletionLocal(weekStart: string): SmartStartCompletion | null {
  try {
    const workspaceId = getCurrentWorkspaceId()
    const value = window.localStorage.getItem(getWorkspaceStorageKey(weekStart, workspaceId)) ?? getLegacyCompatibleStorageValue(weekStart, workspaceId)
    return value === 'started' || value === 'fresh' ? value : null
  } catch {
    return null
  }
}

function saveSmartStartCompletionLocal(weekStart: string, completion: SmartStartCompletion) {
  try {
    const workspaceId = getCurrentWorkspaceId()
    const workspaceKey = getWorkspaceStorageKey(weekStart, workspaceId)
    window.localStorage.setItem(workspaceKey, completion)
    if (workspaceId === getLegacyCompatibleWorkspaceId()) {
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
  try {
    const workspaceId = await getCurrentCloudWorkspaceId()
    if (!workspaceId || !supabase) return localCompletion

    const { data, error } = await supabase
      .from('smart_start')
      .select('data')
      .eq('workspace_id', workspaceId)
      .eq('week_start', weekStart)
      .maybeSingle()
    if (error) throw error

    const completion = data?.data === 'started' || data?.data === 'fresh' ? data.data : null
    if (completion) saveSmartStartCompletionLocal(weekStart, completion)
    return completion ?? localCompletion
  } catch {
    return localCompletion
  }
}

export async function saveSmartStartCompletionAsync(weekStart: string, completion: SmartStartCompletion): Promise<boolean> {
  saveSmartStartCompletionLocal(weekStart, completion)
  try {
    const workspaceId = await getCurrentCloudWorkspaceId()
    if (!workspaceId || !supabase) return false

    const weekRecord = await supabase
      .from('workspace_weeks')
      .upsert({ workspace_id: workspaceId, week_start: weekStart }, { onConflict: 'workspace_id,week_start' })
    if (weekRecord.error) throw weekRecord.error

    const smartStartRecord = await supabase
      .from('smart_start')
      .upsert({ workspace_id: workspaceId, week_start: weekStart, data: completion }, { onConflict: 'workspace_id,week_start' })
    if (smartStartRecord.error) throw smartStartRecord.error
    return true
  } catch {
    return false
  }
}
