import type { DailyActivity } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import type { FollowUpSuggestion } from './intelligenceTypes'

const ACTION_PATTERN = /\b(follow\s*up|confirm|monitor|replenish|validate|review|contact\s+again|arrange|schedule|continue\s+engagement)\b/i

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function equivalent(text: string, followUp: FollowUp) {
  const candidate = normalize(text)
  const existing = normalize(followUp.task)
  return candidate === existing || candidate.includes(existing) || existing.includes(candidate)
}

export function detectFollowUpSuggestions(activities: DailyActivity[], followUps: FollowUp[]): FollowUpSuggestion[] {
  const suggestions: FollowUpSuggestion[] = []
  for (const activity of activities) {
    const action = activity.nextAction.trim() || [activity.outcome, activity.intelligence].find((text) => ACTION_PATTERN.test(text))?.trim() || ''
    if (!action || !ACTION_PATTERN.test(action)) continue
    const existing = followUps.some((followUp) => followUp.sourceActivityId === activity.id || equivalent(action, followUp))
    if (existing) continue
    const priority = /urgent|high priority|critical|depleted|pending access/i.test(action) ? 'high' : 'normal'
    suggestions.push({
      type: 'follow-up',
      title: action,
      reason: `The ${activity.account} activity records an actionable next step that is not yet an existing follow-up.`,
      priority,
      sourceActivityId: activity.id,
      account: activity.account,
    })
  }
  return suggestions
}