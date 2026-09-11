import {
  PLAN_CATEGORIES,
  type AccountObjective,
  type CommercialPriority,
  type DayCategories,
  type DayId,
  type PlanItem,
  type SuccessMeasure,
  type SuccessMeasureCategory,
  type VirtualEngagementPlanItem,
  type WeeklyPlan,
} from '../types/weeklyPlan'
import { getCurrentWorkspaceId, getLegacyCompatibleStorageKey, getLegacyCompatibleWorkspaceId, getWorkspaceScopedStorageKey, getCurrentCloudWorkspaceId } from './workspaceStorage'
import { supabase } from '../lib/supabase'
import { WEEK_DAY_IDS, WEEK_DAY_LABELS } from '../utils/week'

const STORAGE_PREFIX = 'weekflow-weekly-plan:'
const SELECTED_WEEK_KEY = 'weekflow-selected-week'
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
  )
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
  }).map((item) => ({
    ...item,
    priorityContacts: normalizePlanItems(item.priorityContacts),
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
  }).map((item) => ({
    ...item,
    objectives: normalizePlanItems(item.objectives),
  }))
}

function normalizeCommercialPriorities(value: unknown): CommercialPriority[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is CommercialPriority => {
    if (!item || typeof item !== 'object') return false
    const candidate = item as CommercialPriority
    return typeof candidate.id === 'string'
      && typeof candidate.text === 'string'
      && (candidate.opportunity === undefined || typeof candidate.opportunity === 'string')
      && (candidate.account === undefined || typeof candidate.account === 'string')
      && (candidate.product === undefined || typeof candidate.product === 'string')
  })
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

export function getCurrentWeekStart() {
  const today = new Date()
  const dayOffset = today.getDay() === 0 ? 6 : today.getDay() - 1
  today.setDate(today.getDate() - dayOffset)
  return formatDate(today)
}

function getSelectedWeekStorageKey(workspaceId = getCurrentWorkspaceId()) {
  return `${SELECTED_WEEK_KEY}:${workspaceId}`
}

export function getSelectedWeekStart() {
  try {
    const workspaceId = getCurrentWorkspaceId()
    const workspaceKey = getSelectedWeekStorageKey(workspaceId)
    const workspaceValue = window.localStorage.getItem(workspaceKey)
    if (workspaceValue) return workspaceValue
    if (workspaceId === getLegacyCompatibleWorkspaceId()) {
      const legacyValue = window.localStorage.getItem(SELECTED_WEEK_KEY)
      if (legacyValue) return legacyValue
    }
    return getCurrentWeekStart()
  } catch {
    return getCurrentWeekStart()
  }
}

export function setSelectedWeekStart(weekStart: string) {
  try {
    const workspaceId = getCurrentWorkspaceId()
    window.localStorage.setItem(getSelectedWeekStorageKey(workspaceId), weekStart)
    if (workspaceId === getLegacyCompatibleWorkspaceId()) {
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
        const isLegacyKey = workspaceId === getLegacyCompatibleWorkspaceId() && key.startsWith(prefix) && !key.startsWith(`${prefix}${workspaceId}:`)
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
    virtualEngagementPlan: [],
    keyAccountObjectives: [],
    commercialPriorities: [],
    successMeasures: [],
  }
}

function normalizePlan(plan: unknown, weekStart: string): WeeklyPlan {
  const emptyPlan = createEmptyWeeklyPlan(weekStart)
  if (!plan || typeof plan !== 'object' || !Array.isArray((plan as WeeklyPlan).days)) return emptyPlan

  return {
    ...emptyPlan,
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
    virtualEngagementPlan: normalizeVirtualEngagementPlan((plan as WeeklyPlan).virtualEngagementPlan),
    keyAccountObjectives: normalizeAccountObjectives((plan as WeeklyPlan).keyAccountObjectives),
    commercialPriorities: normalizeCommercialPriorities((plan as WeeklyPlan).commercialPriorities),
    successMeasures: normalizeSuccessMeasures((plan as WeeklyPlan).successMeasures),
  }
}

function loadWeeklyPlanLocal(weekStart: string): WeeklyPlan {
  try {
    const workspaceId = getCurrentWorkspaceId()
    const key = getWorkspaceScopedStorageKey(STORAGE_PREFIX, weekStart, workspaceId)
    const savedPlan = window.localStorage.getItem(key) ?? (workspaceId === getLegacyCompatibleWorkspaceId() ? window.localStorage.getItem(getLegacyCompatibleStorageKey(STORAGE_PREFIX, weekStart)) : null)
    return savedPlan ? normalizePlan(JSON.parse(savedPlan), weekStart) : createEmptyWeeklyPlan(weekStart)
  } catch {
    return createEmptyWeeklyPlan(weekStart)
  }
}

function saveWeeklyPlanLocal(plan: WeeklyPlan) {
  try {
    const workspaceId = getCurrentWorkspaceId()
    const workspaceKey = getWorkspaceScopedStorageKey(STORAGE_PREFIX, plan.weekStart, workspaceId)
    window.localStorage.setItem(workspaceKey, JSON.stringify(plan))
    if (workspaceId === getLegacyCompatibleWorkspaceId()) {
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
  try {
    const workspaceId = await getCloudWorkspaceId()
    if (!workspaceId || !supabase) return localPlan

    const { data, error } = await supabase
      .from('weekly_plans')
      .select('data')
      .eq('workspace_id', workspaceId)
      .eq('week_start', weekStart)
      .maybeSingle()

    if (error) throw error
    return data?.data ? normalizePlan(data.data, weekStart) : localPlan
  } catch {
    return localPlan
  }
}

export async function saveWeeklyPlanAsync(plan: WeeklyPlan): Promise<boolean> {
  saveWeeklyPlanLocal(plan)
  try {
    const workspaceId = await getCloudWorkspaceId()
    if (!workspaceId || !supabase) return false

    const weekRecord = await supabase
      .from('workspace_weeks')
      .upsert({ workspace_id: workspaceId, week_start: plan.weekStart }, { onConflict: 'workspace_id,week_start' })

    if (weekRecord.error) throw weekRecord.error
    const planRecord = await supabase
      .from('weekly_plans')
      .upsert({ workspace_id: workspaceId, week_start: plan.weekStart, data: plan }, { onConflict: 'workspace_id,week_start' })

    if (planRecord.error) throw planRecord.error
    return true
  } catch {
    return false
  }
}
