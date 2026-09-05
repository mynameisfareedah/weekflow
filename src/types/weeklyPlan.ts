export const PLAN_CATEGORIES = [
  'facilities',
  'hcps',
  'primaryObjectives',
  'virtualEngagements',
  'accountObjectives',
  'commercialPriorities',
  'successMeasures',
] as const

export type PlanCategory = (typeof PLAN_CATEGORIES)[number]

export type DayId = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday'

export interface PlanItem {
  id: string
  text: string
}

export type DayCategories = Record<PlanCategory, PlanItem[]>

export interface DayPlan {
  id: DayId
  label: string
  date: string
  categories: DayCategories
}

export interface WeeklyPlan {
  weekStart: string
  days: DayPlan[]
}
