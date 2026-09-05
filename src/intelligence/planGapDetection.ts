import type { DailyActivity } from '../types/dailyActivity'
import type { WeeklyPlan } from '../types/weeklyPlan'
import type { PlanGap } from './intelligenceTypes'

const MATCHABLE_CATEGORIES = ['facilities', 'virtualEngagements', 'primaryObjectives', 'accountObjectives', 'commercialPriorities', 'successMeasures'] as const

function tokens(value: string) {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2)
}

function activityText(activity: DailyActivity) {
  return [activity.account, activity.outcome, activity.intelligence, activity.nextAction, ...activity.structuredOutcomes.map((outcome) => outcome.details)].join(' ').toLowerCase()
}

function coverage(item: string, relevantActivities: DailyActivity[]) {
  const itemTokens = tokens(item)
  if (itemTokens.length === 0) return 'needs review' as const
  const matched = relevantActivities.filter((activity) => {
    const text = activityText(activity)
    return itemTokens.some((token) => text.includes(token))
  })
  if (matched.length === 0) return 'not evidenced' as const
  if (itemTokens.every((token) => relevantActivities.some((activity) => activityText(activity).includes(token)))) return 'covered' as const
  return 'partially covered' as const
}

export function detectPlanGaps(plan: WeeklyPlan, activities: DailyActivity[]): PlanGap[] {
  const gaps: PlanGap[] = []
  for (const day of plan.days) {
    for (const category of MATCHABLE_CATEGORIES) {
      for (const item of day.categories[category]) {
        const linked = activities.filter((activity) => activity.date === day.date || activity.plannedActivityId === `${category === 'virtualEngagements' ? 'virtual' : 'facility'}:${item.id}`)
        const status = coverage(item.text, linked.length > 0 ? linked : activities)
        if (status === 'covered') continue
        gaps.push({
          itemId: item.id,
          category,
          item: item.text,
          dayLabel: day.label,
          status,
          reason: status === 'not evidenced' ? `${item.text} has not yet been captured in Daily Activity.` : `${item.text} has some related activity, but the planned item is not fully evidenced.`,
        })
      }
    }
  }
  return gaps
}