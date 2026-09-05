import type { DailyActivity } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import type { PlanGap, DataQualityWarning } from './intelligenceTypes'

export function detectDataQualityWarnings(activities: DailyActivity[], followUps: FollowUp[], planGaps: PlanGap[]): DataQualityWarning[] {
  const warnings: DataQualityWarning[] = []
  for (const activity of activities) {
    const text = `${activity.outcome} ${activity.intelligence} ${activity.nextAction}`
    if (/preliminary|approximate|approximately|requires confirmation/i.test(text)) warnings.push({ severity: 'warning', title: `${activity.account} patient information requires confirmation`, reason: 'The captured information is marked preliminary, approximate, or requiring confirmation.', account: activity.account, sourceActivityId: activity.id })
    for (const outcome of activity.structuredOutcomes) {
      if (outcome.type === 'Patient Access / Access Barrier') warnings.push({ severity: 'warning', title: `${activity.account} has an unresolved access issue`, reason: outcome.details || 'A patient access barrier was recorded.', account: activity.account, sourceActivityId: activity.id })
      if (outcome.type === 'Stock Issue') warnings.push({ severity: 'warning', title: `${activity.account} has a stock issue`, reason: outcome.details || outcome.stockStatus || 'A stock issue was recorded.', account: activity.account, sourceActivityId: activity.id })
    }
    if (!activity.outcome.trim() && !activity.intelligence.trim() && !activity.nextAction.trim() && activity.structuredOutcomes.length === 0) warnings.push({ severity: 'warning', title: `${activity.account} activity is incomplete`, reason: 'The activity has no outcome, intelligence, next action, or structured outcome recorded.', account: activity.account, sourceActivityId: activity.id })
  }
  for (const followUp of followUps) if (followUp.status === 'open' && followUp.priority === 'high') warnings.push({ severity: 'warning', title: `High-priority follow-up remains open: ${followUp.task}`, reason: 'This follow-up is still open and marked high priority.', account: followUp.facility })
  for (const gap of planGaps) if (gap.status === 'not evidenced') warnings.push({ severity: 'warning', title: `${gap.item} has no captured activity`, reason: gap.reason })
  return warnings.filter((warning, index, all) => all.findIndex((candidate) => candidate.title === warning.title && candidate.sourceActivityId === warning.sourceActivityId) === index)
}