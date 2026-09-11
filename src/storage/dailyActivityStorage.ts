import {
  ACTIVITY_TYPES,
  PORTFOLIO_PRODUCTS,
  STRUCTURED_OUTCOME_TYPES,
  type ActivityType,
  type DailyActivity,
  type PortfolioProduct,
  type StructuredOutcome,
  type StructuredOutcomeType,
} from '../types/dailyActivity'
import { getCurrentWorkspaceId, getLegacyCompatibleStorageKey, getLegacyCompatibleWorkspaceId, getWorkspaceScopedStorageKey, getCurrentCloudWorkspaceId } from './workspaceStorage'
import { supabase } from '../lib/supabase'

const STORAGE_PREFIX = 'weekflow-daily-activities:'

function getWorkspaceStorageKey(weekStart: string, workspaceId = getCurrentWorkspaceId()) {
  return getWorkspaceScopedStorageKey(STORAGE_PREFIX, weekStart, workspaceId)
}

function getLegacyCompatibleStorageValue(weekStart: string, workspaceId = getCurrentWorkspaceId()) {
  if (workspaceId !== getLegacyCompatibleWorkspaceId()) return null
  return window.localStorage.getItem(getLegacyCompatibleStorageKey(STORAGE_PREFIX, weekStart))
}

function isActivityType(value: unknown): value is ActivityType {
  return typeof value === 'string' && ACTIVITY_TYPES.includes(value as ActivityType)
}

function isOutcomeType(value: unknown): value is StructuredOutcomeType {
  return typeof value === 'string' && STRUCTURED_OUTCOME_TYPES.includes(value as StructuredOutcomeType)
}

function isProduct(value: unknown): value is PortfolioProduct {
  return typeof value === 'string' && PORTFOLIO_PRODUCTS.includes(value as PortfolioProduct)
}

function normalizeOutcome(outcome: unknown): StructuredOutcome | null {
  if (!outcome || typeof outcome !== 'object') return null
  const candidate = outcome as Partial<StructuredOutcome>
  if (typeof candidate.id !== 'string' || !isOutcomeType(candidate.type) || typeof candidate.details !== 'string') return null

  return {
    id: candidate.id,
    type: candidate.type,
    details: candidate.details,
    ...(isProduct(candidate.product) ? { product: candidate.product } : {}),
    ...(typeof candidate.quantity === 'string' ? { quantity: candidate.quantity } : {}),
    ...(typeof candidate.stockStatus === 'string' ? { stockStatus: candidate.stockStatus } : {}),
  }
}

function normalizeActivity(activity: unknown): DailyActivity | null {
  if (!activity || typeof activity !== 'object') return null
  const candidate = activity as Partial<DailyActivity>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.date !== 'string' ||
    typeof candidate.weekStart !== 'string' ||
    typeof candidate.account !== 'string' ||
    !isActivityType(candidate.activityType)
  ) return null

  return {
    id: candidate.id,
    date: candidate.date,
    weekStart: candidate.weekStart,
    plannedActivityId: typeof candidate.plannedActivityId === 'string' ? candidate.plannedActivityId : null,
    account: candidate.account,
    activityType: candidate.activityType,
    hcpNames: Array.isArray(candidate.hcpNames) ? candidate.hcpNames.filter((name): name is string => typeof name === 'string') : [],
    outcome: typeof candidate.outcome === 'string' ? candidate.outcome : '',
    intelligence: typeof candidate.intelligence === 'string' ? candidate.intelligence : '',
    nextAction: typeof candidate.nextAction === 'string' ? candidate.nextAction : '',
    structuredOutcomes: Array.isArray(candidate.structuredOutcomes)
      ? candidate.structuredOutcomes.map(normalizeOutcome).filter((outcome): outcome is StructuredOutcome => outcome !== null)
      : [],
    ...(typeof candidate.product === 'string' ? { product: candidate.product } : {}),
    ...(typeof candidate.stockStatus === 'string' ? { stockStatus: candidate.stockStatus } : {}),
    ...(typeof candidate.progressStatus === 'string' ? { progressStatus: candidate.progressStatus } : {}),
    ...(typeof candidate.blockerRisk === 'string' ? { blockerRisk: candidate.blockerRisk } : {}),
    ...(typeof candidate.decision === 'string' ? { decision: candidate.decision } : {}),
    ...(typeof candidate.workOrderJob === 'string' ? { workOrderJob: candidate.workOrderJob } : {}),
    ...(typeof candidate.equipmentAsset === 'string' ? { equipmentAsset: candidate.equipmentAsset } : {}),
    ...(typeof candidate.issueProblem === 'string' ? { issueProblem: candidate.issueProblem } : {}),
    ...(typeof candidate.resolution === 'string' ? { resolution: candidate.resolution } : {}),
    ...(typeof candidate.serviceStatus === 'string' ? { serviceStatus: candidate.serviceStatus } : {}),
    ...(typeof candidate.partsMaterialsUsed === 'string' ? { partsMaterialsUsed: candidate.partsMaterialsUsed } : {}),
    ...(typeof candidate.escalation === 'string' ? { escalation: candidate.escalation } : {}),
    ...(typeof candidate.slaPriority === 'string' ? { slaPriority: candidate.slaPriority } : {}),
    ...(typeof candidate.downtime === 'string' ? { downtime: candidate.downtime } : {}),
    ...(typeof candidate.customerSignOff === 'string' ? { customerSignOff: candidate.customerSignOff } : {}),
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
  }
}

function loadDailyActivitiesLocal(weekStart: string) {
  try {
    const workspaceId = getCurrentWorkspaceId()
    const key = getWorkspaceStorageKey(weekStart, workspaceId)
    const saved = window.localStorage.getItem(key) ?? getLegacyCompatibleStorageValue(weekStart, workspaceId)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    return Array.isArray(parsed)
      ? parsed.map(normalizeActivity).filter((activity): activity is DailyActivity => activity !== null)
      : []
  } catch {
    return []
  }
}

function saveDailyActivitiesLocal(weekStart: string, activities: DailyActivity[]) {
  try {
    const workspaceId = getCurrentWorkspaceId()
    const workspaceKey = getWorkspaceStorageKey(weekStart, workspaceId)
    window.localStorage.setItem(workspaceKey, JSON.stringify(activities))
    if (workspaceId === getLegacyCompatibleWorkspaceId()) {
      window.localStorage.setItem(getLegacyCompatibleStorageKey(STORAGE_PREFIX, weekStart), JSON.stringify(activities))
    }
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

export function loadDailyActivities(weekStart: string) {
  return loadDailyActivitiesLocal(weekStart)
}

export function saveDailyActivities(weekStart: string, activities: DailyActivity[]) {
  saveDailyActivitiesLocal(weekStart, activities)
}

export async function loadDailyActivitiesAsync(weekStart: string): Promise<DailyActivity[]> {
  const localActivities = loadDailyActivitiesLocal(weekStart)
  try {
    const workspaceId = await getCurrentCloudWorkspaceId()
    if (!workspaceId || !supabase) return localActivities

    const { data, error } = await supabase
      .from('daily_activities')
      .select('data')
      .eq('workspace_id', workspaceId)
      .eq('week_start', weekStart)
      .maybeSingle()

    if (error) throw error
    if (!data?.data) return localActivities
    const parsed: unknown = data.data
    return Array.isArray(parsed)
      ? parsed.map(normalizeActivity).filter((activity): activity is DailyActivity => activity !== null)
      : localActivities
  } catch {
    return localActivities
  }
}

export async function saveDailyActivitiesAsync(weekStart: string, activities: DailyActivity[]): Promise<boolean> {
  saveDailyActivitiesLocal(weekStart, activities)
  try {
    const workspaceId = await getCurrentCloudWorkspaceId()
    if (!workspaceId || !supabase) return false

    const weekRecord = await supabase
      .from('workspace_weeks')
      .upsert({ workspace_id: workspaceId, week_start: weekStart }, { onConflict: 'workspace_id,week_start' })
    if (weekRecord.error) throw weekRecord.error

    const activityRecord = await supabase
      .from('daily_activities')
      .upsert({ workspace_id: workspaceId, week_start: weekStart, data: activities }, { onConflict: 'workspace_id,week_start' })
    if (activityRecord.error) throw activityRecord.error
    return true
  } catch {
    return false
  }
}
