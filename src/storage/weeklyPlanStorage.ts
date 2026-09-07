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

const STORAGE_PREFIX = 'weekflow-weekly-plan:'
const SELECTED_WEEK_KEY = 'weekflow-selected-week'
const STORAGE_PREFIXES = [STORAGE_PREFIX, 'weekflow-daily-activities:', 'weekflow-follow-ups:']
const DAY_IDS: DayId[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

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

export function getSelectedWeekStart() {
  try {
    return window.localStorage.getItem(SELECTED_WEEK_KEY) ?? getCurrentWeekStart()
  } catch {
    return getCurrentWeekStart()
  }
}

export function setSelectedWeekStart(weekStart: string) {
  try {
    window.localStorage.setItem(SELECTED_WEEK_KEY, weekStart)
    window.dispatchEvent(new CustomEvent('weekflow-week-change', { detail: weekStart }))
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

export function getStoredWeekStarts() {
  const weekStarts = new Set<string>()
  try {
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key) continue
      for (const prefix of STORAGE_PREFIXES) {
        if (key.startsWith(prefix)) weekStarts.add(key.slice(prefix.length))
      }
    }
  } catch {
    return []
  }
  return [...weekStarts].filter((weekStart) => /^\d{4}-\d{2}-\d{2}$/.test(weekStart)).sort().reverse()
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

export function loadWeeklyPlan(weekStart: string): WeeklyPlan {
  try {
    const savedPlan = window.localStorage.getItem(`${STORAGE_PREFIX}${weekStart}`)
    return savedPlan ? normalizePlan(JSON.parse(savedPlan), weekStart) : createEmptyWeeklyPlan(weekStart)
  } catch {
    return createEmptyWeeklyPlan(weekStart)
  }
}

export function saveWeeklyPlan(plan: WeeklyPlan) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${plan.weekStart}`, JSON.stringify(plan))
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}
