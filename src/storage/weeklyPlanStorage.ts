import {
  PLAN_CATEGORIES,
  type DayCategories,
  type DayId,
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
  }
}

function normalizePlan(plan: unknown, weekStart: string): WeeklyPlan {
  const emptyPlan = createEmptyWeeklyPlan(weekStart)
  if (!plan || typeof plan !== 'object' || !Array.isArray((plan as WeeklyPlan).days)) return emptyPlan

  return {
    ...emptyPlan,
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
