import {
  FOLLOW_UP_PRIORITIES,
  FOLLOW_UP_STATUSES,
  type FollowUp,
  type FollowUpPriority,
  type FollowUpStatus,
} from '../types/followUp'
import { getCurrentCloudWorkspaceId, getCurrentWorkspaceId, getLegacyCompatibleStorageKey, getLegacyCompatibleWorkspaceId, getWorkspaceScopedStorageKey } from './workspaceStorage'
import { supabase } from '../lib/supabase'

const STORAGE_PREFIX = 'weekflow-follow-ups:'
const PENDING_FOLLOW_UP_KEY = 'weekflow-pending-follow-up'

function getWorkspaceStorageKey(weekKey: string, workspaceId = getCurrentWorkspaceId()) {
  return getWorkspaceScopedStorageKey(STORAGE_PREFIX, weekKey, workspaceId)
}

function getLegacyCompatibleStorageValue(weekKey: string, workspaceId = getCurrentWorkspaceId()) {
  if (workspaceId !== getLegacyCompatibleWorkspaceId()) return null
  return window.localStorage.getItem(getLegacyCompatibleStorageKey(STORAGE_PREFIX, weekKey))
}

function isPriority(value: unknown): value is FollowUpPriority {
  return typeof value === 'string' && FOLLOW_UP_PRIORITIES.includes(value as FollowUpPriority)
}

function isStatus(value: unknown): value is FollowUpStatus {
  return typeof value === 'string' && FOLLOW_UP_STATUSES.includes(value as FollowUpStatus)
}

function normalizeFollowUp(value: unknown): FollowUp | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<FollowUp>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.weekKey !== 'string' ||
    typeof candidate.task !== 'string' ||
    !isPriority(candidate.priority) ||
    !isStatus(candidate.status)
  ) return null

  return {
    id: candidate.id,
    weekKey: candidate.weekKey,
    task: candidate.task,
    ...(typeof candidate.facility === 'string' && candidate.facility ? { facility: candidate.facility } : {}),
    ...(typeof candidate.hcpName === 'string' && candidate.hcpName ? { hcpName: candidate.hcpName } : {}),
    ...(typeof candidate.dueDate === 'string' && candidate.dueDate ? { dueDate: candidate.dueDate } : {}),
    priority: candidate.priority,
    status: candidate.status,
    ...(typeof candidate.notes === 'string' && candidate.notes ? { notes: candidate.notes } : {}),
    ...(typeof candidate.sourceActivityId === 'string' ? { sourceActivityId: candidate.sourceActivityId } : {}),
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
  }
}

function loadFollowUpsLocal(weekKey: string): FollowUp[] {
  try {
    const workspaceId = getCurrentWorkspaceId()
    const key = getWorkspaceStorageKey(weekKey, workspaceId)
    const saved = window.localStorage.getItem(key) ?? getLegacyCompatibleStorageValue(weekKey, workspaceId)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    return Array.isArray(parsed)
      ? parsed.map(normalizeFollowUp).filter((followUp): followUp is FollowUp => followUp !== null)
      : []
  } catch {
    return []
  }
}

function saveFollowUpsLocal(weekKey: string, followUps: FollowUp[]) {
  try {
    const workspaceId = getCurrentWorkspaceId()
    const workspaceKey = getWorkspaceStorageKey(weekKey, workspaceId)
    window.localStorage.setItem(workspaceKey, JSON.stringify(followUps))
    if (workspaceId === getLegacyCompatibleWorkspaceId()) {
      window.localStorage.setItem(getLegacyCompatibleStorageKey(STORAGE_PREFIX, weekKey), JSON.stringify(followUps))
    }
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

export function loadFollowUps(weekKey: string): FollowUp[] {
  return loadFollowUpsLocal(weekKey)
}

export function saveFollowUps(weekKey: string, followUps: FollowUp[]) {
  saveFollowUpsLocal(weekKey, followUps)
}

export async function loadFollowUpsAsync(weekKey: string): Promise<FollowUp[]> {
  const localFollowUps = loadFollowUpsLocal(weekKey)
  try {
    const workspaceId = await getCurrentCloudWorkspaceId()
    if (!workspaceId || !supabase) return localFollowUps

    const { data, error } = await supabase
      .from('follow_ups')
      .select('data')
      .eq('workspace_id', workspaceId)
      .eq('week_start', weekKey)
      .maybeSingle()

    if (error) throw error
    if (!data?.data) return localFollowUps
    const parsed: unknown = data.data
    if (!Array.isArray(parsed)) return localFollowUps
    const cloudFollowUps = parsed.map(normalizeFollowUp).filter((followUp): followUp is FollowUp => followUp !== null)
    saveFollowUpsLocal(weekKey, cloudFollowUps)
    return cloudFollowUps
  } catch {
    return localFollowUps
  }
}

export async function saveFollowUpsAsync(weekKey: string, followUps: FollowUp[]): Promise<boolean> {
  saveFollowUpsLocal(weekKey, followUps)
  try {
    const workspaceId = await getCurrentCloudWorkspaceId()
    if (!workspaceId || !supabase) return false

    const weekRecord = await supabase
      .from('workspace_weeks')
      .upsert({ workspace_id: workspaceId, week_start: weekKey }, { onConflict: 'workspace_id,week_start' })
    if (weekRecord.error) throw weekRecord.error

    const followUpRecord = await supabase
      .from('follow_ups')
      .upsert({ workspace_id: workspaceId, week_start: weekKey, data: followUps }, { onConflict: 'workspace_id,week_start' })
    if (followUpRecord.error) throw followUpRecord.error
    return true
  } catch {
    return false
  }
}

export function queueFollowUpPrefill(prefill: Partial<FollowUp> & { weekKey: string }) {
  try {
    window.sessionStorage.setItem(PENDING_FOLLOW_UP_KEY, JSON.stringify({
      ...prefill,
      workspaceId: getCurrentWorkspaceId(),
    }))
  } catch {
    // Session storage can be unavailable in restricted environments.
  }
}

export function consumeFollowUpPrefill(weekKey: string): Partial<FollowUp> | null {
  try {
    const currentWorkspaceId = getCurrentWorkspaceId()
    const saved = window.sessionStorage.getItem(PENDING_FOLLOW_UP_KEY)
    if (!saved) return null
    window.sessionStorage.removeItem(PENDING_FOLLOW_UP_KEY)
    const parsed: unknown = JSON.parse(saved)
    if (!parsed || typeof parsed !== 'object') return null
    const candidate = parsed as Partial<FollowUp> & { weekKey?: string; workspaceId?: string }
    const workspaceMatches = candidate.workspaceId === undefined || candidate.workspaceId === currentWorkspaceId
    if (!workspaceMatches || candidate.weekKey !== weekKey) return null
    const { workspaceId: _workspaceId, ...rest } = candidate
    return rest as Partial<FollowUp>
  } catch {
    return null
  }
}
