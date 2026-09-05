import { detectDataQualityWarnings } from './dataQuality.ts'
import { detectFollowUpSuggestions } from './followUpDetection.ts'
import { detectPlanGaps } from './planGapDetection.ts'
import { scoreOpportunities } from './opportunityScoring.ts'
import { deriveOpportunitySignals, deriveWeeklyInsights } from './weeklyInsights.ts'
import type { CarryForwardCandidate, IntelligenceInput, IntelligenceCategory, Recommendation, WeeklyIntelligence } from './intelligenceTypes'

function recommendationFromGap(gap: ReturnType<typeof detectPlanGaps>[number]): Recommendation {
  return { title: `Review ${gap.item}`, reason: gap.reason, priority: gap.status === 'not evidenced' ? 'high' : 'normal', category: gap.category === 'commercialPriorities' ? 'commercial' : gap.category === 'virtualEngagements' ? 'scientific-engagement' : 'strategic-accounts' }
}

function getCarryForward(input: IntelligenceInput, gaps: ReturnType<typeof detectPlanGaps>, warnings: ReturnType<typeof detectDataQualityWarnings>): CarryForwardCandidate[] {
  const candidates: CarryForwardCandidate[] = gaps.filter((gap) => gap.status !== 'covered').map((gap) => ({ title: gap.item, reason: gap.reason, category: gap.category === 'commercialPriorities' ? 'commercial' : gap.category === 'virtualEngagements' ? 'scientific-engagement' : 'strategic-accounts', source: 'plan-gap' }))
  input.followUps.filter((followUp) => followUp.status === 'open').forEach((followUp) => candidates.push({ title: followUp.task, reason: 'Open follow-up remains unfinished.', category: 'strategic-accounts', account: followUp.facility, hcpName: followUp.hcpName, priority: followUp.priority, source: 'follow-up' }))
  warnings.filter((warning) => warning.title.includes('access issue') || warning.title.includes('stock issue') || warning.title.includes('requires confirmation')).forEach((warning) => candidates.push({ title: warning.title, reason: warning.reason, category: warning.title.includes('access') || warning.title.includes('stock') ? 'access-market' : 'patient', account: warning.account, source: 'data-quality', sourceActivityId: warning.sourceActivityId }))
  return candidates.filter((candidate, index, all) => all.findIndex((item) => item.title === candidate.title && item.account === candidate.account) === index)
}

export function getReportReadiness(activityCount: number, openFollowUpCount: number, warningCount: number, highPriorityCount: number, gapCount: number) {
  if (activityCount === 0) return { status: 'empty' as const, activityCount, openFollowUpCount, warningCount, highPriorityCount, summary: 'No field activity has been captured for this week.' }
  if (warningCount > 0 || gapCount > 0 || highPriorityCount > 0) return { status: 'review' as const, activityCount, openFollowUpCount, warningCount, highPriorityCount, summary: `Activity has been captured, but ${gapCount} planned item${gapCount === 1 ? '' : 's'} and ${warningCount} data-quality warning${warningCount === 1 ? '' : 's'} require review.` }
  return { status: 'ready' as const, activityCount, openFollowUpCount, warningCount, highPriorityCount, summary: `Weekly activity is available for reporting. ${openFollowUpCount} item${openFollowUpCount === 1 ? '' : 's'} require attention before final submission.` }
}

export function deriveWeeklyIntelligence(input: IntelligenceInput): WeeklyIntelligence {
  const activities = input.activities.filter((activity) => activity.weekStart === input.selectedWeek)
  const followUps = input.followUps.filter((followUp) => followUp.weekKey === input.selectedWeek)
  const followUpSuggestions = detectFollowUpSuggestions(activities, followUps)
  const opportunitySignals = deriveOpportunitySignals(activities)
  const opportunityScores = scoreOpportunities(opportunitySignals)
  const planGaps = detectPlanGaps(input.plan, activities)
  const dataQualityWarnings = detectDataQualityWarnings(activities, followUps, planGaps)
  const openFollowUps = followUps.filter((followUp) => followUp.status === 'open')
  const recommendations: Recommendation[] = [
    ...openFollowUps.map((followUp) => ({ title: followUp.task, reason: 'This follow-up remains open.', priority: followUp.priority, category: 'strategic-accounts' as IntelligenceCategory, account: followUp.facility })),
    ...followUpSuggestions.map((suggestion) => ({ title: suggestion.title, reason: suggestion.reason, priority: suggestion.priority, category: 'strategic-accounts' as IntelligenceCategory, sourceActivityId: suggestion.sourceActivityId, account: suggestion.account })),
    ...dataQualityWarnings.filter((warning) => warning.account).map((warning) => ({ title: warning.title, reason: warning.reason, priority: 'high' as const, category: warning.title.includes('patient') ? 'patient' as IntelligenceCategory : 'access-market' as IntelligenceCategory, sourceActivityId: warning.sourceActivityId, account: warning.account })),
    ...planGaps.filter((gap) => gap.status !== 'covered').map(recommendationFromGap),
  ].filter((recommendation, index, all) => all.findIndex((item) => item.title === recommendation.title && item.account === recommendation.account) === index).slice(0, 12)
  return {
    selectedWeek: input.selectedWeek,
    followUpSuggestions,
    opportunitySignals,
    opportunityScores,
    planGaps,
    insights: deriveWeeklyInsights(activities),
    recommendations,
    dataQualityWarnings,
    carryForwardCandidates: getCarryForward({ ...input, activities, followUps }, planGaps, dataQualityWarnings),
    reportReadiness: getReportReadiness(activities.length, openFollowUps.length, dataQualityWarnings.length, openFollowUps.filter((followUp) => followUp.priority === 'high').length, planGaps.filter((gap) => gap.status !== 'covered').length),
  }
}

export type { IntelligenceInput, WeeklyIntelligence } from './intelligenceTypes'