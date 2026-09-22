import {
  PLAN_CATEGORIES,
  type AccountObjective,
  type CommunicationPlanItem,
  type CommunityEngagementItem,
  type CommercialPriority,
  type DayCategories,
  type DayId,
  type DocumentationPlanItem,
  type FieldDailyScheduleItem,
  type FieldEquipment,
  type FieldJob,
  type FieldPartResource,
  type FieldServiceIssue,
  type FieldTeamPlan,
  type MonitoringImpactTarget,
  type PlanItem,
  type ProgrammeActivity,
  type ResourceLogisticsItem,
  type StakeholderPlanItem,
  type SuccessMeasure,
  type VolunteerPlanItem,
  type SuccessMeasureCategory,
  type VirtualEngagementPlanItem,
  type WeeklyPlan,
  type WeeklyProgrammeContext,
  type EducationContext,
  type EducationLearningObjective,
  type EducationTeachingPlanItem,
  type EducationWeeklyTarget,
} from '../types/weeklyPlan'
import { getCurrentWorkspaceId, getLegacyCompatibleStorageKey, getWorkspaceScopedStorageKey, getCurrentCloudWorkspaceId, shouldUseLegacyStorageFallback, hasAuthenticatedCloudWorkspace } from './workspaceStorage'
import { supabase } from '../lib/supabase'
import { WEEK_DAY_IDS, WEEK_DAY_LABELS } from '../utils/week'

const STORAGE_PREFIX = 'weekflow-weekly-plan:'
const SELECTED_WEEK_KEY = 'weekflow-selected-week'
const WEEK_SELECTION_SOURCE_KEY = 'weekflow-week-selection-source'
const STORAGE_PREFIXES = [STORAGE_PREFIX, 'weekflow-daily-activities:', 'weekflow-follow-ups:', 'weekflow-smart-start:']
const DAY_IDS: DayId[] = [...WEEK_DAY_IDS]
const DAY_LABELS = [...WEEK_DAY_LABELS]

function formatDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createEmptyCategories(): DayCategories {
  const categories = {} as DayCategories
  for (const category of PLAN_CATEGORIES) categories[category] = []
  return categories
}

function normalizePlanItems(value: unknown): PlanItem[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is PlanItem =>
      Boolean(item) && typeof item === 'object' && typeof (item as PlanItem).id === 'string' && typeof (item as PlanItem).text === 'string',
  ).map((item: any) => ({
    id: item.id,
    text: item.text,
    ...(typeof item.successMeasure === 'string' ? { successMeasure: item.successMeasure } : {}),
    ...(typeof item.target === 'string' ? { target: item.target } : {}),
    ...(typeof item.priority === 'string' ? { priority: item.priority } : {}),
    ...(typeof item.owner === 'string' ? { owner: item.owner } : {}),
    ...(typeof item.plannedDate === 'string' ? { plannedDate: item.plannedDate } : {}),
    ...(typeof item.estimatedHours === 'string' ? { estimatedHours: item.estimatedHours } : {}),
    ...(typeof item.dependency === 'string' ? { dependency: item.dependency } : {}),
    ...(typeof item.status === 'string' ? { status: item.status } : {}),
  }))
}

function normalizeEducationContext(value: unknown): EducationContext | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as Partial<EducationContext>
  const context: EducationContext = {}
  if (typeof candidate.courseProgramme === 'string') context.courseProgramme = candidate.courseProgramme
  if (typeof candidate.classGroup === 'string') context.classGroup = candidate.classGroup
  if (typeof candidate.instructor === 'string') context.instructor = candidate.instructor
  if (typeof candidate.weeklyTheme === 'string') context.weeklyTheme = candidate.weeklyTheme
  return Object.keys(context).length > 0 ? context : undefined
}

function normalizeEducationLearningObjectives(value: unknown): EducationLearningObjective[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is EducationLearningObjective => Boolean(item) && typeof item === 'object' && typeof (item as EducationLearningObjective).id === 'string' && typeof (item as EducationLearningObjective).objective === 'string').map((item: any) => ({
    id: item.id,
    objective: item.objective,
    ...(typeof item.successMeasure === 'string' ? { successMeasure: item.successMeasure } : {}),
    ...(typeof item.priority === 'string' ? { priority: item.priority } : {}),
  }))
}

function normalizeEducationTeachingPlan(value: unknown): EducationTeachingPlanItem[] {
  if (!Array.isArray(value)) return []
  const validDays = new Set(DAY_IDS)
  return value.filter((item): item is EducationTeachingPlanItem => Boolean(item) && typeof item === 'object' && typeof (item as EducationTeachingPlanItem).id === 'string' && validDays.has((item as EducationTeachingPlanItem).day)).map((item: any) => ({
    id: item.id,
    day: item.day,
    topic: typeof item.topic === 'string' ? item.topic : '',
    ...(typeof item.teachingActivity === 'string' ? { teachingActivity: item.teachingActivity } : {}),
    ...(typeof item.learningActivity === 'string' ? { learningActivity: item.learningActivity } : {}),
    ...(typeof item.duration === 'string' ? { duration: item.duration } : {}),
  }))
}

function normalizeEducationWeeklyTargets(value: unknown): EducationWeeklyTarget[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is EducationWeeklyTarget => Boolean(item) && typeof item === 'object' && typeof (item as EducationWeeklyTarget).id === 'string' && typeof (item as EducationWeeklyTarget).target === 'string').map((item: any) => ({
    id: item.id,
    target: item.target,
    ...(typeof item.measure === 'string' ? { measure: item.measure } : {}),
    ...(typeof item.priority === 'string' ? { priority: item.priority } : {}),
  }))
}

function normalizeVirtualEngagementPlan(value: unknown): VirtualEngagementPlanItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is VirtualEngagementPlanItem => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as VirtualEngagementPlanItem
    return typeof candidate.id === 'string'
      && typeof candidate.coverage === 'string'
      && Array.isArray(candidate.priorityContacts)
      && typeof candidate.objective === 'string'
  }).map((item: any) => ({
    ...item,
    priorityContacts: normalizePlanItems(item.priorityContacts),
    ...(typeof item.relatedObjective === 'string' ? { relatedObjective: item.relatedObjective } : {}),
    ...(typeof item.owner === 'string' ? { owner: item.owner } : {}),
    ...(typeof item.priority === 'string' ? { priority: item.priority } : {}),
    ...(typeof item.plannedDate === 'string' ? { plannedDate: item.plannedDate } : {}),
    ...(typeof item.startTime === 'string' ? { startTime: item.startTime } : {}),
    ...(typeof item.endTime === 'string' ? { endTime: item.endTime } : {}),
    ...(typeof item.estimatedHours === 'string' ? { estimatedHours: item.estimatedHours } : {}),
    ...(typeof item.dependency === 'string' ? { dependency: item.dependency } : {}),
    ...(typeof item.status === 'string' ? { status: item.status } : {}),
  }))
}

function normalizeAccountObjectives(value: unknown): AccountObjective[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is AccountObjective => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as AccountObjective
    return typeof candidate.id === 'string'
      && typeof candidate.account === 'string'
      && Array.isArray(candidate.objectives)
  }).map((item: any) => ({
    ...item,
    objectives: normalizePlanItems(item.objectives),
    ...(typeof item.owner === 'string' ? { owner: item.owner } : {}),
    ...(typeof item.priority === 'string' ? { priority: item.priority } : {}),
    ...(typeof item.plannedDate === 'string' ? { plannedDate: item.plannedDate } : {}),
    ...(typeof item.estimatedHours === 'string' ? { estimatedHours: item.estimatedHours } : {}),
    ...(typeof item.dependency === 'string' ? { dependency: item.dependency } : {}),
    ...(typeof item.status === 'string' ? { status: item.status } : {}),
  }))
}

function normalizeCommercialPriorities(value: unknown): CommercialPriority[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is CommercialPriority => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as CommercialPriority
    return typeof candidate.id === 'string'
      && (candidate.text === undefined || typeof candidate.text === 'string')
      && (candidate.opportunity === undefined || typeof candidate.opportunity === 'string')
      && (candidate.account === undefined || typeof candidate.account === 'string')
      && (candidate.product === undefined || typeof candidate.product === 'string')
      && (candidate.priority === undefined || typeof candidate.priority === 'string')
  }).map((item: any) => ({
    ...item,
    text: typeof item.text === 'string' && item.text.trim().length > 0 ? item.text : (typeof item.opportunity === 'string' ? item.opportunity : ''),
    ...(typeof item.priority === 'string' ? { priority: item.priority } : {}),
  }))
}

function normalizeSuccessMeasures(value: unknown): SuccessMeasure[] {
  const categories: SuccessMeasureCategory[] = ['coverage', 'engagement', 'commercial', 'account', 'scientific', 'other']
  if (!Array.isArray(value)) return []
  return value.filter((item): item is SuccessMeasure => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as SuccessMeasure
    return typeof candidate.id === 'string'
      && typeof candidate.text === 'string'
      && (candidate.target === undefined || typeof candidate.target === 'string')
      && (candidate.unit === undefined || typeof candidate.unit === 'string')
      && (candidate.category === undefined || categories.includes(candidate.category))
  })
}

function normalizeProgrammeContext(value: unknown): WeeklyProgrammeContext | undefined {
  if (!value || typeof value !== 'object') return undefined
  const candidate = value as WeeklyProgrammeContext
  const programmeContext: WeeklyProgrammeContext = {}
  if (typeof candidate.programme === 'string') programmeContext.programme = candidate.programme
  if (typeof candidate.organisation === 'string') programmeContext.organisation = candidate.organisation
  if (typeof candidate.weeklyTheme === 'string') programmeContext.weeklyTheme = candidate.weeklyTheme
  if (typeof candidate.programmeLead === 'string') programmeContext.programmeLead = candidate.programmeLead
  if (typeof candidate.programmeStatus === 'string') programmeContext.programmeStatus = candidate.programmeStatus
  return Object.keys(programmeContext).length > 0 ? programmeContext : undefined
}

function normalizeProgrammeActivities(value: unknown): ProgrammeActivity[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is ProgrammeActivity => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as ProgrammeActivity
    return typeof candidate.id === 'string'
      && typeof candidate.activity === 'string'
  }).map((item: any) => ({
    id: item.id,
    activity: item.activity,
    ...(typeof item.programmeArea === 'string' ? { programmeArea: item.programmeArea } : {}),
    ...(typeof item.location === 'string' ? { location: item.location } : {}),
    ...(typeof item.owner === 'string' ? { owner: item.owner } : {}),
    ...(typeof item.plannedDate === 'string' ? { plannedDate: item.plannedDate } : {}),
    ...(typeof item.target === 'string' ? { target: item.target } : {}),
    ...(typeof item.status === 'string' ? { status: item.status } : {}),
  }))
}

function normalizeCommunityEngagement(value: unknown): CommunityEngagementItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is CommunityEngagementItem => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as CommunityEngagementItem
    return typeof candidate.id === 'string'
      && typeof candidate.communityGroup === 'string'
      && typeof candidate.engagementActivity === 'string'
  }).map((item: any) => ({
    id: item.id,
    communityGroup: item.communityGroup,
    engagementActivity: item.engagementActivity,
    ...(typeof item.target === 'string' ? { target: item.target } : {}),
    ...(typeof item.plannedDate === 'string' ? { plannedDate: item.plannedDate } : {}),
    ...(typeof item.responsible === 'string' ? { responsible: item.responsible } : {}),
  }))
}

function normalizeVolunteerPlan(value: unknown): VolunteerPlanItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is VolunteerPlanItem => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as VolunteerPlanItem
    return typeof candidate.id === 'string'
      && typeof candidate.volunteer === 'string'
      && typeof candidate.role === 'string'
      && typeof candidate.activity === 'string'
  }).map((item: any) => ({
    id: item.id,
    volunteer: item.volunteer,
    role: item.role,
    activity: item.activity,
    ...(typeof item.date === 'string' ? { date: item.date } : {}),
    ...(typeof item.status === 'string' ? { status: item.status } : {}),
  }))
}

function normalizeStakeholderPlan(value: unknown): StakeholderPlanItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is StakeholderPlanItem => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as StakeholderPlanItem
    return typeof candidate.id === 'string'
      && typeof candidate.stakeholder === 'string'
      && typeof candidate.purpose === 'string'
  }).map((item: any) => ({
    id: item.id,
    stakeholder: item.stakeholder,
    purpose: item.purpose,
    ...(typeof item.actionRequired === 'string' ? { actionRequired: item.actionRequired } : {}),
    ...(typeof item.owner === 'string' ? { owner: item.owner } : {}),
    ...(typeof item.due === 'string' ? { due: item.due } : {}),
    ...(typeof item.status === 'string' ? { status: item.status } : {}),
  }))
}

function normalizeResourcesLogistics(value: unknown): ResourceLogisticsItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is ResourceLogisticsItem => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as ResourceLogisticsItem
    return typeof candidate.id === 'string'
      && typeof candidate.resource === 'string'
  }).map((item: any) => ({
    id: item.id,
    resource: item.resource,
    ...(typeof item.required === 'string' ? { required: item.required } : {}),
    ...(typeof item.available === 'string' ? { available: item.available } : {}),
    ...(typeof item.gap === 'string' ? { gap: item.gap } : {}),
    ...(typeof item.action === 'string' ? { action: item.action } : {}),
  }))
}

function normalizeCommunicationsPlan(value: unknown): CommunicationPlanItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is CommunicationPlanItem => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as CommunicationPlanItem
    return typeof candidate.id === 'string'
      && typeof candidate.communication === 'string'
  }).map((item: any) => ({
    id: item.id,
    communication: item.communication,
    ...(typeof item.audience === 'string' ? { audience: item.audience } : {}),
    ...(typeof item.channel === 'string' ? { channel: item.channel } : {}),
    ...(typeof item.date === 'string' ? { date: item.date } : {}),
    ...(typeof item.status === 'string' ? { status: item.status } : {}),
  }))
}

function normalizeDocumentationPlan(value: unknown): DocumentationPlanItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is DocumentationPlanItem => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as DocumentationPlanItem
    return typeof candidate.id === 'string'
      && typeof candidate.documentation === 'string'
  }).map((item: any) => ({
    id: item.id,
    documentation: item.documentation,
    ...(typeof item.required === 'string' ? { required: item.required } : {}),
    ...(typeof item.responsible === 'string' ? { responsible: item.responsible } : {}),
    ...(typeof item.status === 'string' ? { status: item.status } : {}),
  }))
}

function normalizeMonitoringImpactTargets(value: unknown): MonitoringImpactTarget[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is MonitoringImpactTarget => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as MonitoringImpactTarget
    return typeof candidate.id === 'string'
      && typeof candidate.text === 'string'
      && (candidate.kind === 'outputs' || candidate.kind === 'intended-outcomes')
  }).map((item: any) => ({
    id: item.id,
    kind: item.kind,
    text: item.text,
  }))
}

function normalizeFieldJobs(value: unknown): FieldJob[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is FieldJob => Boolean(item) && typeof item === 'object' && typeof (item as FieldJob).id === 'string' && typeof (item as FieldJob).jobId === 'string').map((item: any) => ({
    ...item,
    ...(Array.isArray(item.photos) ? { photos: item.photos.filter((photo: unknown): photo is string => typeof photo === 'string') } : {}),
  }))
}

function normalizeFieldServiceIssues(value: unknown): FieldServiceIssue[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is FieldServiceIssue => Boolean(item) && typeof item === 'object' && typeof (item as FieldServiceIssue).id === 'string' && typeof (item as FieldServiceIssue).issueId === 'string').map((item: any) => ({ ...item }))
}

function normalizeFieldEquipment(value: unknown): FieldEquipment[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is FieldEquipment => Boolean(item) && typeof item === 'object' && typeof (item as FieldEquipment).id === 'string' && typeof (item as FieldEquipment).equipmentId === 'string').map((item: any) => ({ ...item }))
}

function normalizeFieldTeamPlan(value: unknown): FieldTeamPlan[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is FieldTeamPlan => Boolean(item) && typeof item === 'object' && typeof (item as FieldTeamPlan).id === 'string' && typeof (item as FieldTeamPlan).technician === 'string').map((item: any) => ({ ...item }))
}

function normalizeFieldDailySchedule(value: unknown): FieldDailyScheduleItem[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is FieldDailyScheduleItem => Boolean(item) && typeof item === 'object' && typeof (item as FieldDailyScheduleItem).id === 'string' && typeof (item as FieldDailyScheduleItem).day === 'string').map((item: any) => ({ ...item }))
}

function normalizeFieldPartsResources(value: unknown): FieldPartResource[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is FieldPartResource => Boolean(item) && typeof item === 'object' && typeof (item as FieldPartResource).id === 'string' && typeof (item as FieldPartResource).partResource === 'string').map((item: any) => ({ ...item }))
}

export function getCurrentWeekStart() {
  const today = new Date()
  const dayOffset = today.getDay() === 0 ? 6 : today.getDay() - 1
  today.setDate(today.getDate() - dayOffset)
  return formatDate(today)
}

export function getNextPlanningWeekStart() {
  return getNextWeekStart(getCurrentWeekStart())
}

export function getPlanningWeekStart() {
  return new Date().getDay() === 1 ? getCurrentWeekStart() : getNextPlanningWeekStart()
}

function getSelectedWeekStorageKey(workspaceId = getCurrentWorkspaceId()) {
  return workspaceId ? `${SELECTED_WEEK_KEY}:${workspaceId}` : null
}

function getWeekSelectionSourceStorageKey(workspaceId = getCurrentWorkspaceId()) {
  return workspaceId ? `${WEEK_SELECTION_SOURCE_KEY}:${workspaceId}` : null
}

export type WeekSelectionSource = 'explicit' | 'planning-default' | 'activity-default'

export function getWeekSelectionSource() {
  try {
    const workspaceKey = getWeekSelectionSourceStorageKey()
    const source = workspaceKey ? window.localStorage.getItem(workspaceKey) : null
    if (source === 'explicit' || source === 'planning-default' || source === 'activity-default') return source
    return getSelectedWeekStorageKey() && window.localStorage.getItem(getSelectedWeekStorageKey() as string) ? 'explicit' : null
  } catch {
    return null
  }
}

export function getSelectedWeekStart() {
  try {
    const workspaceId = getCurrentWorkspaceId()
    const workspaceKey = getSelectedWeekStorageKey(workspaceId)
    const workspaceValue = workspaceKey ? window.localStorage.getItem(workspaceKey) : null
    if (workspaceValue) return workspaceValue
    if (shouldUseLegacyStorageFallback()) {
      const legacyValue = window.localStorage.getItem(SELECTED_WEEK_KEY)
      if (legacyValue) return legacyValue
    }
    return getCurrentWeekStart()
  } catch {
    return getCurrentWeekStart()
  }
}

export function setSelectedWeekStart(weekStart: string, source: WeekSelectionSource = 'explicit') {
  try {
    const workspaceId = getCurrentWorkspaceId()
    const workspaceKey = getSelectedWeekStorageKey(workspaceId)
    const sourceKey = getWeekSelectionSourceStorageKey(workspaceId)
    if (!workspaceKey) return
    window.localStorage.setItem(workspaceKey, weekStart)
    if (sourceKey) window.localStorage.setItem(sourceKey, source)
    if (shouldUseLegacyStorageFallback()) {
      window.localStorage.setItem(SELECTED_WEEK_KEY, weekStart)
    }
    window.dispatchEvent(new CustomEvent('weekflow-week-change', { detail: weekStart }))
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

export function getStoredWeekStarts(workspaceId = getCurrentWorkspaceId()) {
  const weekStarts = new Set<string>()
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key) continue
      for (const prefix of STORAGE_PREFIXES) {
        const scopedPrefix = `${prefix}${workspaceId}:`
        const isScopedKey = key.startsWith(scopedPrefix)
        const isLegacyKey = shouldUseLegacyStorageFallback() && key.startsWith(prefix) && !key.startsWith(`${prefix}${workspaceId}:`)
        if (!isScopedKey && !isLegacyKey) continue
        const weekStart = key.slice(isScopedKey ? scopedPrefix.length : prefix.length)
        if (/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) weekStarts.add(weekStart)
      }
    }
  } catch {
    return []
  }
  return [...weekStarts].sort().reverse()
}

export function getWeekStartFromInput(value: string) {
  const [year, week] = value.split('-W').map(Number)
  if (!year || !week) return getCurrentWeekStart()

  const januaryFourth = new Date(year, 0, 4)
  const firstMonday = new Date(januaryFourth)
  const dayOffset = januaryFourth.getDay() === 0 ? 6 : januaryFourth.getDay() - 1
  firstMonday.setDate(januaryFourth.getDate() - dayOffset + (week - 1) * 7)
  return formatDate(firstMonday)
}

export function getNextWeekStart(weekStart: string) {
  const date = new Date(`${weekStart}T12:00:00`)
  date.setDate(date.getDate() + 7)
  return formatDate(date)
}

export function getPreviousWeekStart(weekStart: string) {
  const date = new Date(`${weekStart}T12:00:00`)
  date.setDate(date.getDate() - 7)
  return formatDate(date)
}

export function toWeekInput(weekStart: string) {
  const date = new Date(`${weekStart}T12:00:00`)
  const thursday = new Date(date)
  thursday.setDate(date.getDate() + 3)
  const firstThursday = new Date(thursday.getFullYear(), 0, 4)
  const firstThursdayDay = firstThursday.getDay() || 7
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDay + 1)
  const weekNumber = Math.ceil(((thursday.getTime() - firstThursday.getTime()) / 86400000 + 1) / 7)
  return `${thursday.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`
}

export function createEmptyWeeklyPlan(weekStart: string): WeeklyPlan {
  const start = new Date(`${weekStart}T12:00:00`)

  return {
    weekStart,
    educationWeeklyFocus: undefined,
    educationLearningObjectives: [],
    educationTeachingPlan: [],
    educationWeeklyTargets: [],
    educationContext: undefined,
    weeklyStrategicObjectives: [],
    days: DAY_IDS.map((id, index) => {
      const date = new Date(start)
      date.setDate(start.getDate() + index)
      return {
        id,
        label: DAY_LABELS[index],
        date: formatDate(date),
        categories: createEmptyCategories(),
      }
    }),
    programmeContext: undefined,
    programmeActivities: [],
    communityEngagement: [],
    volunteerPlan: [],
    stakeholderPlan: [],
    resourcesLogistics: [],
    communicationsPlan: [],
    documentationPlan: [],
    monitoringImpactTargets: [],
    virtualEngagementPlan: [],
    keyAccountObjectives: [],
    commercialPriorities: [],
    successMeasures: [],
    fieldJobs: [],
    fieldServiceIssues: [],
    fieldEquipment: [],
    fieldTeamPlan: [],
    fieldDailySchedule: [],
    fieldPartsResources: [],
  }
}

function normalizePlan(plan: unknown, weekStart: string): WeeklyPlan {
  const emptyPlan = createEmptyWeeklyPlan(weekStart)
  if (!plan || typeof plan !== 'object' || !Array.isArray((plan as WeeklyPlan).days)) return emptyPlan

  return {
    ...emptyPlan,
    educationWeeklyFocus: typeof (plan as WeeklyPlan).educationWeeklyFocus === 'string' ? (plan as WeeklyPlan).educationWeeklyFocus : undefined,
    educationLearningObjectives: normalizeEducationLearningObjectives((plan as WeeklyPlan).educationLearningObjectives),
    educationTeachingPlan: normalizeEducationTeachingPlan((plan as WeeklyPlan).educationTeachingPlan),
    educationWeeklyTargets: normalizeEducationWeeklyTargets((plan as WeeklyPlan).educationWeeklyTargets),
    educationContext: normalizeEducationContext((plan as WeeklyPlan).educationContext),
    weeklyStrategicObjectives: normalizePlanItems((plan as WeeklyPlan).weeklyStrategicObjectives),
    days: emptyPlan.days.map((day, index) => {
      const savedDay = (plan as WeeklyPlan).days[index]
      if (!savedDay || typeof savedDay !== 'object') return day

      const categories = createEmptyCategories()
      for (const category of PLAN_CATEGORIES) {
        const savedItems = savedDay.categories?.[category]
        if (Array.isArray(savedItems)) {
          categories[category] = savedItems.filter(
            (item): item is { id: string; text: string } =>
              Boolean(item) && typeof item.id === 'string' && typeof item.text === 'string',
          )
        }
      }
      return { ...day, categories }
    }),
    programmeContext: normalizeProgrammeContext((plan as WeeklyPlan).programmeContext),
    programmeActivities: normalizeProgrammeActivities((plan as WeeklyPlan).programmeActivities),
    communityEngagement: normalizeCommunityEngagement((plan as WeeklyPlan).communityEngagement),
    volunteerPlan: normalizeVolunteerPlan((plan as WeeklyPlan).volunteerPlan),
    stakeholderPlan: normalizeStakeholderPlan((plan as WeeklyPlan).stakeholderPlan),
    resourcesLogistics: normalizeResourcesLogistics((plan as WeeklyPlan).resourcesLogistics),
    communicationsPlan: normalizeCommunicationsPlan((plan as WeeklyPlan).communicationsPlan),
    documentationPlan: normalizeDocumentationPlan((plan as WeeklyPlan).documentationPlan),
    monitoringImpactTargets: normalizeMonitoringImpactTargets((plan as WeeklyPlan).monitoringImpactTargets),
    virtualEngagementPlan: normalizeVirtualEngagementPlan((plan as WeeklyPlan).virtualEngagementPlan),
    keyAccountObjectives: normalizeAccountObjectives((plan as WeeklyPlan).keyAccountObjectives),
    commercialPriorities: normalizeCommercialPriorities((plan as WeeklyPlan).commercialPriorities),
    successMeasures: normalizeSuccessMeasures((plan as WeeklyPlan).successMeasures),
    fieldJobs: normalizeFieldJobs((plan as WeeklyPlan).fieldJobs),
    fieldServiceIssues: normalizeFieldServiceIssues((plan as WeeklyPlan).fieldServiceIssues),
    fieldEquipment: normalizeFieldEquipment((plan as WeeklyPlan).fieldEquipment),
    fieldTeamPlan: normalizeFieldTeamPlan((plan as WeeklyPlan).fieldTeamPlan),
    fieldDailySchedule: normalizeFieldDailySchedule((plan as WeeklyPlan).fieldDailySchedule),
    fieldPartsResources: normalizeFieldPartsResources((plan as WeeklyPlan).fieldPartsResources),
  }
}

function loadWeeklyPlanLocal(weekStart: string): WeeklyPlan {
  try {
    if (hasAuthenticatedCloudWorkspace()) return createEmptyWeeklyPlan(weekStart)
    const workspaceId = getCurrentWorkspaceId()
    const key = workspaceId ? getWorkspaceScopedStorageKey(STORAGE_PREFIX, weekStart, workspaceId) : null
    const savedPlan = (key ? window.localStorage.getItem(key) : null) ?? (shouldUseLegacyStorageFallback() ? window.localStorage.getItem(getLegacyCompatibleStorageKey(STORAGE_PREFIX, weekStart)) : null)
    return savedPlan ? normalizePlan(JSON.parse(savedPlan), weekStart) : createEmptyWeeklyPlan(weekStart)
  } catch {
    return createEmptyWeeklyPlan(weekStart)
  }
}

function saveWeeklyPlanLocal(plan: WeeklyPlan) {
  try {
    const workspaceId = getCurrentWorkspaceId()
    if (!workspaceId) return
    const workspaceKey = getWorkspaceScopedStorageKey(STORAGE_PREFIX, plan.weekStart, workspaceId)
    window.localStorage.setItem(workspaceKey, JSON.stringify(plan))
    if (shouldUseLegacyStorageFallback()) {
      window.localStorage.setItem(getLegacyCompatibleStorageKey(STORAGE_PREFIX, plan.weekStart), JSON.stringify(plan))
    }
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

export function loadWeeklyPlan(weekStart: string): WeeklyPlan {
  return loadWeeklyPlanLocal(weekStart)
}

export function saveWeeklyPlan(plan: WeeklyPlan) {
  saveWeeklyPlanLocal(plan)
}

async function getCloudWorkspaceId() {
  return getCurrentCloudWorkspaceId()
}

export async function loadWeeklyPlanAsync(weekStart: string): Promise<WeeklyPlan> {
  const localPlan = loadWeeklyPlanLocal(weekStart)
  if (!supabase) return localPlan
  try {
    const workspaceId = await getCloudWorkspaceId()
    if (!workspaceId) return localPlan

    const { data, error } = await supabase
      .from('weekly_plans')
      .select('data')
      .eq('workspace_id', workspaceId)
      .eq('week_start', weekStart)
      .maybeSingle()

    if (error) throw error
    return data?.data ? normalizePlan(data.data, weekStart) : localPlan
  } catch {
    throw new Error('Weekly Plan could not be loaded from the workspace.')
  }
}

export async function saveWeeklyPlanAsync(plan: WeeklyPlan): Promise<boolean> {
  if (!supabase) {
    saveWeeklyPlanLocal(plan)
    return true
  }
  try {
    const workspaceId = await getCloudWorkspaceId()
    if (!workspaceId) {
      saveWeeklyPlanLocal(plan)
      return true
    }

    const weekRecord = await supabase
      .from('workspace_weeks')
      .upsert({ workspace_id: workspaceId, week_start: plan.weekStart }, { onConflict: 'workspace_id,week_start' })

    if (weekRecord.error) throw weekRecord.error
    const planRecord = await supabase
      .from('weekly_plans')
      .upsert({ workspace_id: workspaceId, week_start: plan.weekStart, data: plan }, { onConflict: 'workspace_id,week_start' })

    if (planRecord.error) throw planRecord.error
    saveWeeklyPlanLocal(plan)
    return true
  } catch {
    return false
  }
}
