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
import { getCurrentUser } from '../account'
import { getCurrentCloudWorkspaceId, getCurrentWorkspace, getCurrentWorkspaceId, getLegacyCompatibleStorageKey, getWorkspaceById, getWorkspaceScopedStorageKey, shouldUseLegacyStorageFallback, hasAuthenticatedCloudWorkspace } from './workspaceStorage'
import { supabase } from '../lib/supabase'

const STORAGE_PREFIX = 'weekflow-daily-activities:'

function getWorkspaceStorageKey(weekStart: string, workspaceId = getCurrentWorkspaceId()) {
  return workspaceId ? getWorkspaceScopedStorageKey(STORAGE_PREFIX, weekStart, workspaceId) : null
}

function getLegacyCompatibleStorageValue(weekStart: string, workspaceId = getCurrentWorkspaceId()) {
  if (!shouldUseLegacyStorageFallback() || workspaceId === null) return null
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

function normalizeActivity(activity: unknown, fallbackTemplateId = getCurrentWorkspace()?.templateId ?? 'field-sales'): DailyActivity | null {
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
    templateId: typeof candidate.templateId === 'string' ? candidate.templateId : fallbackTemplateId,
    plannedActivityId: typeof candidate.plannedActivityId === 'string' ? candidate.plannedActivityId : null,
    account: candidate.account,
    activityType: candidate.activityType,
    hcpNames: Array.isArray(candidate.hcpNames) ? candidate.hcpNames.filter((name): name is string => typeof name === 'string') : [],
    outcome: typeof candidate.outcome === 'string' ? candidate.outcome : '',
    ...(typeof candidate.workPerformed === 'string' ? { workPerformed: candidate.workPerformed } : {}),
    ...(typeof candidate.actualResults === 'string' ? { actualResults: candidate.actualResults } : {}),
    ...(typeof candidate.programmeArea === 'string' ? { programmeArea: candidate.programmeArea } : {}),
    ...(typeof candidate.location === 'string' ? { location: candidate.location } : {}),
    ...(typeof candidate.communityGroup === 'string' ? { communityGroup: candidate.communityGroup } : {}),
    ...(typeof candidate.engagementActivity === 'string' ? { engagementActivity: candidate.engagementActivity } : {}),
    ...(typeof candidate.actualReach === 'string' ? { actualReach: candidate.actualReach } : {}),
    ...(typeof candidate.engagementResult === 'string' ? { engagementResult: candidate.engagementResult } : {}),
    ...(typeof candidate.volunteer === 'string' ? { volunteer: candidate.volunteer } : {}),
    ...(typeof candidate.volunteerRole === 'string' ? { volunteerRole: candidate.volunteerRole } : {}),
    ...(typeof candidate.volunteerActivity === 'string' ? { volunteerActivity: candidate.volunteerActivity } : {}),
    ...(typeof candidate.volunteerParticipation === 'string' ? { volunteerParticipation: candidate.volunteerParticipation } : {}),
    ...(typeof candidate.volunteerContribution === 'string' ? { volunteerContribution: candidate.volunteerContribution } : {}),
    ...(typeof candidate.stakeholder === 'string' ? { stakeholder: candidate.stakeholder } : {}),
    ...(typeof candidate.stakeholderPurpose === 'string' ? { stakeholderPurpose: candidate.stakeholderPurpose } : {}),
    ...(typeof candidate.stakeholderEngagement === 'string' ? { stakeholderEngagement: candidate.stakeholderEngagement } : {}),
    ...(typeof candidate.stakeholderResult === 'string' ? { stakeholderResult: candidate.stakeholderResult } : {}),
    ...(typeof candidate.stakeholderNextStep === 'string' ? { stakeholderNextStep: candidate.stakeholderNextStep } : {}),
    ...(typeof candidate.resource === 'string' ? { resource: candidate.resource } : {}),
    ...(typeof candidate.resourceActual === 'string' ? { resourceActual: candidate.resourceActual } : {}),
    ...(typeof candidate.resourceIssue === 'string' ? { resourceIssue: candidate.resourceIssue } : {}),
    ...(typeof candidate.resourceAction === 'string' ? { resourceAction: candidate.resourceAction } : {}),
    ...(typeof candidate.timeSpent === 'string' ? { timeSpent: candidate.timeSpent } : {}),
    ...(typeof candidate.dailySummary === 'string' ? { dailySummary: candidate.dailySummary } : {}),
    ...(typeof candidate.carryForward === 'string' ? { carryForward: candidate.carryForward } : {}),
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
    ...(typeof candidate.jobCustomer === 'string' ? { jobCustomer: candidate.jobCustomer } : {}),
    ...(typeof candidate.jobPriority === 'string' ? { jobPriority: candidate.jobPriority } : {}),
    ...(typeof candidate.assignedTechnician === 'string' ? { assignedTechnician: candidate.assignedTechnician } : {}),
    ...(typeof candidate.contactPerson === 'string' ? { contactPerson: candidate.contactPerson } : {}),
    ...(typeof candidate.arrivalTime === 'string' ? { arrivalTime: candidate.arrivalTime } : {}),
    ...(typeof candidate.departureTime === 'string' ? { departureTime: candidate.departureTime } : {}),
    ...(typeof candidate.actionsTaken === 'string' ? { actionsTaken: candidate.actionsTaken } : {}),
    ...(typeof candidate.partsUsed === 'string' ? { partsUsed: candidate.partsUsed } : {}),
    ...(typeof candidate.findings === 'string' ? { findings: candidate.findings } : {}),
    ...(typeof candidate.condition === 'string' ? { condition: candidate.condition } : {}),
    ...(typeof candidate.servicePerformed === 'string' ? { servicePerformed: candidate.servicePerformed } : {}),
    ...(typeof candidate.nextServiceDate === 'string' ? { nextServiceDate: candidate.nextServiceDate } : {}),
    ...(typeof candidate.followUpRequired === 'string' ? { followUpRequired: candidate.followUpRequired } : {}),
    ...(typeof candidate.followUpDate === 'string' ? { followUpDate: candidate.followUpDate } : {}),
    ...(typeof candidate.issuePriority === 'string' ? { issuePriority: candidate.issuePriority } : {}),
    ...(typeof candidate.educationCourseProgramme === 'string' ? { educationCourseProgramme: candidate.educationCourseProgramme } : {}),
    ...(typeof candidate.educationClassGroup === 'string' ? { educationClassGroup: candidate.educationClassGroup } : {}),
    ...(typeof candidate.educationTopic === 'string' ? { educationTopic: candidate.educationTopic } : {}),
    ...(typeof candidate.educationInstructor === 'string' ? { educationInstructor: candidate.educationInstructor } : {}),
    ...(typeof candidate.educationLearningObjectiveId === 'string' ? { educationLearningObjectiveId: candidate.educationLearningObjectiveId } : {}),
    ...(typeof candidate.educationTeachingActivity === 'string' ? { educationTeachingActivity: candidate.educationTeachingActivity } : {}),
    ...(typeof candidate.educationStudentActivity === 'string' ? { educationStudentActivity: candidate.educationStudentActivity } : {}),
    ...(typeof candidate.educationLearnerCount === 'string' ? { educationLearnerCount: candidate.educationLearnerCount } : {}),
    ...(typeof candidate.educationExpectedOutput === 'string' ? { educationExpectedOutput: candidate.educationExpectedOutput } : {}),
    ...(typeof candidate.educationLearningResult === 'string' ? { educationLearningResult: candidate.educationLearningResult } : {}),
    ...(typeof candidate.educationStatus === 'string' ? { educationStatus: candidate.educationStatus } : {}),
    ...(typeof candidate.customCategoryId === 'string' ? { customCategoryId: candidate.customCategoryId } : {}),
    ...(typeof candidate.customStatusId === 'string' ? { customStatusId: candidate.customStatusId } : {}),
    ...(candidate.customFieldValues && typeof candidate.customFieldValues === 'object' && !Array.isArray(candidate.customFieldValues) ? { customFieldValues: candidate.customFieldValues as Record<string, unknown> } : {}),
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
  }
}

function parseActivities(value: unknown, fallbackTemplateId = getCurrentWorkspace()?.templateId ?? 'field-sales') {
  return Array.isArray(value)
    ? value.map((activity) => normalizeActivity(activity, fallbackTemplateId)).filter((activity): activity is DailyActivity => activity !== null)
    : []
}

export type CustomUsageSummary = {
  isUsed: boolean
  usageCount: number
  affectedWeekCount: number
  weeks: string[]
}

export type CustomUsageActivityDetail = {
  activityId: string
  date: string
  weekStart: string
  activityTitle: string
  activityType: string
  account: string
  customStatusId?: string
  customFieldValue?: unknown
  outcome?: string
  nextAction?: string
}

function sortWeeksChronologically(weeks: string[]) {
  return [...new Set(weeks)].sort((left, right) => left.localeCompare(right))
}

function buildUsageSummary(activities: DailyActivity[]): CustomUsageSummary {
  const weeks = sortWeeksChronologically(activities.map((activity) => activity.weekStart))
  return {
    isUsed: activities.length > 0,
    usageCount: activities.length,
    affectedWeekCount: weeks.length,
    weeks,
  }
}

function isMeaningfulCustomFieldValue(value: unknown) {
  if (value === undefined || value === null) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

export function scanStoredActivitiesForWorkspace(workspaceId = getCurrentWorkspaceId()): DailyActivity[] {
  if (!workspaceId) return []
  const templateId = getWorkspaceById(workspaceId)?.templateId ?? getCurrentWorkspace()?.templateId ?? 'field-sales'
  const activities: DailyActivity[] = []
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index)
    if (!key || !key.startsWith(`${STORAGE_PREFIX}${workspaceId}:`)) continue
    const value = window.localStorage.getItem(key)
    if (!value) continue
    try {
      activities.push(...parseActivities(JSON.parse(value), templateId))
    } catch {
      // Ignore one malformed workspace-scoped week without hiding valid weeks.
    }
  }
  return activities
}

export function summarizeCustomCategoryUsage(activities: DailyActivity[], categoryId: string): CustomUsageSummary {
  if (!categoryId) return { isUsed: false, usageCount: 0, affectedWeekCount: 0, weeks: [] }
  return buildUsageSummary(activities.filter((activity) => activity.customCategoryId === categoryId))
}

export function summarizeCustomFieldUsage(activities: DailyActivity[], fieldId: string): CustomUsageSummary {
  if (!fieldId) return { isUsed: false, usageCount: 0, affectedWeekCount: 0, weeks: [] }
  const matches = activities.filter((activity) => {
    const fieldValue = activity.customFieldValues?.[fieldId]
    return isMeaningfulCustomFieldValue(fieldValue)
  })
  return buildUsageSummary(matches)
}

async function loadPersistedActivitiesForWorkspace(workspaceId: string) {
  const workspace = getWorkspaceById(workspaceId)
  if (!workspace) return []

  if (supabase && workspace.cloudId) {
    const cloudWorkspaceId = workspaceId === getCurrentWorkspaceId()
      ? await getCurrentCloudWorkspaceId()
      : await (async () => {
        const user = await getCurrentUser()
        if (!user || workspace.ownerId !== user.id) return null
        const { data, error } = await supabase
          .from('workspaces')
          .select('id')
          .eq('id', workspace.cloudId)
          .eq('owner_id', user.id)
          .maybeSingle()
        if (error) throw error
        return data?.id ?? null
      })()
    if (!cloudWorkspaceId) return []

    const { data, error } = await supabase
      .from('daily_activities')
      .select('data')
      .eq('workspace_id', cloudWorkspaceId)
    if (error) throw error

    return Array.isArray(data)
      ? data.flatMap((row) => Array.isArray(row?.data) ? parseActivities(row.data, workspace.templateId) : [])
      : []
  }

  return scanStoredActivitiesForWorkspace(workspaceId)
}

function projectUsageDetail(activity: DailyActivity, fieldId?: string): CustomUsageActivityDetail {
  return {
    activityId: activity.id,
    date: activity.date,
    weekStart: activity.weekStart,
    activityTitle: activity.account,
    activityType: activity.activityType,
    account: activity.account,
    ...(activity.customStatusId ? { customStatusId: activity.customStatusId } : {}),
    ...(fieldId && activity.customFieldValues && Object.prototype.hasOwnProperty.call(activity.customFieldValues, fieldId)
      ? { customFieldValue: activity.customFieldValues[fieldId] }
      : {}),
    ...(activity.outcome ? { outcome: activity.outcome } : {}),
    ...(activity.nextAction ? { nextAction: activity.nextAction } : {}),
  }
}

export async function getCustomCategoryUsageDetails(categoryId: string, workspaceId = getCurrentWorkspaceId()): Promise<CustomUsageActivityDetail[]> {
  if (!categoryId || !workspaceId) return []
  const activities = await loadPersistedActivitiesForWorkspace(workspaceId)
  return activities.filter((activity) => activity.customCategoryId === categoryId).map((activity) => projectUsageDetail(activity))
}

export async function getCustomFieldUsageDetails(fieldId: string, workspaceId = getCurrentWorkspaceId()): Promise<CustomUsageActivityDetail[]> {
  if (!fieldId || !workspaceId) return []
  const activities = await loadPersistedActivitiesForWorkspace(workspaceId)
  return activities.filter((activity) => isMeaningfulCustomFieldValue(activity.customFieldValues?.[fieldId])).map((activity) => projectUsageDetail(activity, fieldId))
}

function filterActivitiesForCurrentTemplate(activities: DailyActivity[]) {
  const templateId = getCurrentWorkspace()?.templateId
  if (!templateId) return []
  return activities.filter((activity) => activity.templateId === templateId)
}

function loadStoredActivitiesLocal(weekStart: string) {
  try {
    if (hasAuthenticatedCloudWorkspace()) return []
    const workspaceId = getCurrentWorkspaceId()
    const key = getWorkspaceStorageKey(weekStart, workspaceId)
    const saved = (key ? window.localStorage.getItem(key) : null) ?? getLegacyCompatibleStorageValue(weekStart, workspaceId)
    return saved ? parseActivities(JSON.parse(saved)) : []
  } catch {
    return []
  }
}

function loadDailyActivitiesLocal(weekStart: string) {
  return filterActivitiesForCurrentTemplate(loadStoredActivitiesLocal(weekStart))
}

function saveDailyActivitiesLocal(weekStart: string, activities: DailyActivity[]) {
  try {
    const workspaceId = getCurrentWorkspaceId()
    const workspaceKey = getWorkspaceStorageKey(weekStart, workspaceId)
    const workspace = getCurrentWorkspace()
    if (!workspaceId || !workspaceKey || !workspace) return
    const templateId = workspace.templateId
    const existingActivities = loadStoredActivitiesLocal(weekStart)
    const preservedActivities = existingActivities.filter((activity) => activity.templateId !== templateId)
    const storedActivities = [...preservedActivities, ...activities]
    window.localStorage.setItem(workspaceKey, JSON.stringify(storedActivities))
    if (shouldUseLegacyStorageFallback()) {
      window.localStorage.setItem(getLegacyCompatibleStorageKey(STORAGE_PREFIX, weekStart), JSON.stringify(storedActivities))
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

export function hasDailyActivityWithCustomStatus(statusId: string) {
  try {
    const workspaceId = getCurrentWorkspaceId()
    if (!workspaceId) return false
    const prefix = `${STORAGE_PREFIX}${workspaceId}:`
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key?.startsWith(prefix)) continue
      const value = window.localStorage.getItem(key)
      if (!value) continue
      if (parseActivities(JSON.parse(value)).some((activity) => activity.customStatusId === statusId)) return true
    }
  } catch {
    return false
  }
  return false
}

export async function getCustomCategoryUsage(categoryId: string, workspaceId = getCurrentWorkspaceId()): Promise<CustomUsageSummary> {
  const emptySummary: CustomUsageSummary = { isUsed: false, usageCount: 0, affectedWeekCount: 0, weeks: [] }
  if (!categoryId || !workspaceId) return emptySummary

  const currentWorkspace = getCurrentWorkspace()
  if (supabase && currentWorkspace?.cloudId) {
    const cloudWorkspaceId = await getCurrentCloudWorkspaceId()
    if (cloudWorkspaceId) {
      const { data, error } = await supabase
        .from('daily_activities')
        .select('data')
        .eq('workspace_id', cloudWorkspaceId)
      if (!error && Array.isArray(data)) {
        const matchingActivities = data.flatMap((row) => Array.isArray(row?.data) ? row.data : [])
          .map((activity) => normalizeActivity(activity, currentWorkspace.templateId ?? 'field-sales'))
          .filter((activity): activity is DailyActivity => activity !== null)
          .filter((activity) => activity.customCategoryId === categoryId)
        return buildUsageSummary(matchingActivities)
      }
      if (error) return emptySummary
    }
  }

  return summarizeCustomCategoryUsage(scanStoredActivitiesForWorkspace(workspaceId), categoryId)
}

export async function getCustomFieldUsage(fieldId: string, workspaceId = getCurrentWorkspaceId()): Promise<CustomUsageSummary> {
  const emptySummary: CustomUsageSummary = { isUsed: false, usageCount: 0, affectedWeekCount: 0, weeks: [] }
  if (!fieldId || !workspaceId) return emptySummary

  const currentWorkspace = getCurrentWorkspace()
  if (supabase && currentWorkspace?.cloudId) {
    const cloudWorkspaceId = await getCurrentCloudWorkspaceId()
    if (cloudWorkspaceId) {
      const { data, error } = await supabase
        .from('daily_activities')
        .select('data')
        .eq('workspace_id', cloudWorkspaceId)
      if (!error && Array.isArray(data)) {
        const matchingActivities = data.flatMap((row) => Array.isArray(row?.data) ? row.data : [])
          .map((activity) => normalizeActivity(activity, currentWorkspace.templateId ?? 'field-sales'))
          .filter((activity): activity is DailyActivity => activity !== null)
          .filter((activity) => isMeaningfulCustomFieldValue(activity.customFieldValues?.[fieldId]))
        return buildUsageSummary(matchingActivities)
      }
      if (error) return emptySummary
    }
  }

  return summarizeCustomFieldUsage(scanStoredActivitiesForWorkspace(workspaceId), fieldId)
}

export async function hasDailyActivityWithCustomCategory(categoryId: string, workspaceId = getCurrentWorkspaceId()) {
  if (!categoryId || !workspaceId) return false
  return (await getCustomCategoryUsage(categoryId, workspaceId)).isUsed
}

export async function hasDailyActivityWithCustomField(fieldId: string, workspaceId = getCurrentWorkspaceId()) {
  if (!fieldId || !workspaceId) return false
  return (await getCustomFieldUsage(fieldId, workspaceId)).isUsed
}

export async function loadDailyActivitiesAsync(weekStart: string): Promise<DailyActivity[]> {
  const localActivities = loadDailyActivitiesLocal(weekStart)
  if (!supabase) return localActivities
  try {
    const workspaceId = await getCurrentCloudWorkspaceId()
    if (!workspaceId) return localActivities

    const { data, error } = await supabase
      .from('daily_activities')
      .select('data')
      .eq('workspace_id', workspaceId)
      .eq('week_start', weekStart)
      .maybeSingle()

    if (error) throw error
    if (!data?.data) return localActivities
    return filterActivitiesForCurrentTemplate(parseActivities(data.data))
  } catch {
    throw new Error('Daily Activity could not be loaded from the workspace.')
  }
}

export async function saveDailyActivitiesAsync(weekStart: string, activities: DailyActivity[]): Promise<boolean> {
  if (!supabase) {
    saveDailyActivitiesLocal(weekStart, activities)
    return true
  }
  try {
    const workspaceId = await getCurrentCloudWorkspaceId()
    if (!workspaceId) {
      saveDailyActivitiesLocal(weekStart, activities)
      return true
    }

    const weekRecord = await supabase
      .from('workspace_weeks')
      .upsert({ workspace_id: workspaceId, week_start: weekStart }, { onConflict: 'workspace_id,week_start' })
    if (weekRecord.error) throw weekRecord.error

    const activityRecord = await supabase
      .from('daily_activities')
      .upsert({ workspace_id: workspaceId, week_start: weekStart, data: activities }, { onConflict: 'workspace_id,week_start' })
    if (activityRecord.error) throw activityRecord.error
    saveDailyActivitiesLocal(weekStart, activities)
    return true
  } catch {
    return false
  }
}
