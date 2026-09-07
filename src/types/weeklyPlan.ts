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

export interface VirtualEngagementPlanItem {
  id: string
  coverage: string
  priorityContacts: PlanItem[]
  objective: string
}

export interface AccountObjective {
  id: string
  account: string
  objectives: PlanItem[]
}

export type SuccessMeasureCategory = 'coverage' | 'engagement' | 'commercial' | 'account' | 'scientific' | 'other'

export interface CommercialPriority {
  id: string
  text: string
  opportunity?: string
  account?: string
  product?: string
}

export interface SuccessMeasure {
  id: string
  text: string
  target?: string
  unit?: string
  category?: SuccessMeasureCategory
}

export type DayCategories = Record<PlanCategory, PlanItem[]>

export type LegacyDayCommercialPriority = PlanItem
export type LegacyDaySuccessMeasure = PlanItem

export interface DayPlan {
  id: DayId
  label: string
  date: string

  /**
   * Legacy compatibility layer for the original daily field-plan template.
   * These day-level category arrays are kept readable for older saved data and
   * current intelligence logic, but they are not the canonical weekly work-plan fields.
   */
  categories: {
    facilities: PlanItem[]
    hcps: PlanItem[]
    primaryObjectives: PlanItem[]

    // Legacy compatibility only.
    virtualEngagements: PlanItem[]
    accountObjectives: PlanItem[]
    commercialPriorities: PlanItem[]
    successMeasures: PlanItem[]
  }
}

export interface WeeklyPlan {
  weekStart: string

  /** Canonical weekly work-plan field; not the same as day categories. */
  weeklyStrategicObjectives: PlanItem[]

  days: DayPlan[]

  /** Canonical weekly work-plan field; not the same as DayPlan.categories.virtualEngagements. */
  virtualEngagementPlan: VirtualEngagementPlanItem[]

  /** Canonical weekly work-plan field; not the same as DayPlan.categories.accountObjectives. */
  keyAccountObjectives: AccountObjective[]

  /** Canonical weekly work-plan field; not the same as DayPlan.categories.commercialPriorities. */
  commercialPriorities: CommercialPriority[]

  /** Canonical weekly work-plan field; not the same as DayPlan.categories.successMeasures. */
  successMeasures: SuccessMeasure[]
}
