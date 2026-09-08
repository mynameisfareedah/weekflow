import { ACTIVITY_TYPES, type ActivityType } from '../types/dailyActivity'
import type { DayPlan } from '../types/weeklyPlan'

export interface PlannedActivity {
  id: string
  label: string
  account: string
  focus: string
  activityType: ActivityType
}

export function getExecutablePlannedActivities(day: DayPlan): PlannedActivity[] {
  const facilities = day.categories.facilities.map((item) => ({
    id: `facility:${item.id}`,
    label: item.text,
    account: item.text,
    focus: [...day.categories.primaryObjectives, ...day.categories.accountObjectives, ...day.categories.commercialPriorities].map((focus) => focus.text).join(' | '),
    activityType: ACTIVITY_TYPES[0],
  }))
  const virtualEngagements = day.categories.virtualEngagements.map((item) => ({
    id: `virtual:${item.id}`,
    label: item.text,
    account: item.text,
    focus: day.categories.primaryObjectives.map((focus) => focus.text).join(' | '),
    activityType: ACTIVITY_TYPES[1],
  }))

  return [...facilities, ...virtualEngagements]
}
