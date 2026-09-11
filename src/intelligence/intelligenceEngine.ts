import { detectDataQualityWarnings } from './dataQuality.ts'
import { detectFollowUpSuggestions } from './followUpDetection.ts'
import { detectPlanGaps } from './planGapDetection.ts'
import { scoreOpportunities } from './opportunityScoring.ts'
import { deriveOpportunitySignals, deriveWeeklyInsights } from './weeklyInsights.ts'
import { FIELD_SALES_TEMPLATE } from '../config/templates.ts'
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

export function getReportReadiness({
  activityCount,
  plannedItemCount,
  capturedPlannedItemCount,
  openFollowUpCount,
  completedFollowUpCount,
  warningCount,
  highPriorityCount,
  hasMeaningfulPlan,
}: {
  activityCount: number
  plannedItemCount: number
  capturedPlannedItemCount: number
  openFollowUpCount: number
  completedFollowUpCount: number
  warningCount: number
  highPriorityCount: number
  hasMeaningfulPlan: boolean
}) {
  if (!hasMeaningfulPlan && activityCount === 0) {
    return { status: 'empty' as const, hasMeaningfulPlan, activityCount, plannedItemCount, capturedPlannedItemCount, openFollowUpCount, completedFollowUpCount, warningCount, highPriorityCount, summary: "Your week hasn't started yet. Open Weekly Plan to set priorities or start Daily Activity." }
  }
  if (warningCount > 0 || plannedItemCount > capturedPlannedItemCount || (hasMeaningfulPlan && activityCount === 0)) {
    const reasons = []
    if (hasMeaningfulPlan && activityCount === 0) reasons.push('no Daily Activity has been captured yet')
    if (plannedItemCount > capturedPlannedItemCount) reasons.push('some planned work has not yet been captured')
    if (warningCount > 0) reasons.push(`${warningCount} data-quality issue${warningCount === 1 ? '' : 's'} need review`)
    return { status: 'review' as const, hasMeaningfulPlan, activityCount, plannedItemCount, capturedPlannedItemCount, openFollowUpCount, completedFollowUpCount, warningCount, highPriorityCount, summary: `${reasons.join('; ')}.` }
  }
  const followUpNote = openFollowUpCount > 0 ? ` ${openFollowUpCount} open follow-up${openFollowUpCount === 1 ? '' : 's'} remain visible for follow-through.` : ''
  return { status: 'ready' as const, hasMeaningfulPlan, activityCount, plannedItemCount, capturedPlannedItemCount, openFollowUpCount, completedFollowUpCount, warningCount, highPriorityCount, summary: `The selected week's activity is sufficiently captured for review and export.${followUpNote}` }
}

function getMeaningfulPlanItemCount(plan: IntelligenceInput['plan']) {
  const dayItems = plan.days.flatMap((day) => Object.values(day.categories).flat())
  const weeklyItems = [
    ...(plan.weeklyStrategicObjectives ?? []),
    ...(plan.virtualEngagementPlan ?? []).flatMap((item) => [...item.priorityContacts, { id: item.id, text: `${item.coverage} ${item.objective}` }]),
    ...(plan.keyAccountObjectives ?? []).flatMap((item) => item.objectives),
    ...(plan.commercialPriorities ?? []),
    ...(plan.successMeasures ?? []),
  ]
  return [...dayItems, ...weeklyItems].filter((item) => item.text.trim()).length
}

function getMatchablePlanItemCount(plan: IntelligenceInput['plan']) {
  return plan.days.flatMap((day) => Object.values(day.categories).flat()).filter((item) => item.text.trim()).length
}

export function deriveWeeklyIntelligence(input: IntelligenceInput): WeeklyIntelligence {
  const template = input.template ?? FIELD_SALES_TEMPLATE
  const activities = input.activities.filter((activity) => activity.weekStart === input.selectedWeek)
  const followUps = input.followUps.filter((followUp) => followUp.weekKey === input.selectedWeek)
  const followUpSuggestions = detectFollowUpSuggestions(activities, followUps)
  const opportunitySignals = deriveOpportunitySignals(activities, template)
  const opportunityScores = scoreOpportunities(opportunitySignals, template)
  const planGaps = detectPlanGaps(input.plan, activities)
  const dataQualityWarnings = detectDataQualityWarnings(activities, followUps, planGaps)
  const openFollowUps = followUps.filter((followUp) => followUp.status === 'open')
  const completedFollowUps = followUps.filter((followUp) => followUp.status === 'completed')
  const meaningfulPlanItemCount = getMeaningfulPlanItemCount(input.plan)
  const plannedItemCount = getMatchablePlanItemCount(input.plan)
  const capturedPlannedItemCount = plannedItemCount - planGaps.filter((gap) => gap.status === 'not evidenced' || gap.status === 'needs review').length
  const readinessWarnings = dataQualityWarnings.filter((warning) => !warning.title.startsWith('High-priority follow-up remains open:') && !warning.title.endsWith('has no captured activity'))
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
    insights: deriveWeeklyInsights(activities, template),
    recommendations,
    dataQualityWarnings,
    carryForwardCandidates: getCarryForward({ ...input, activities, followUps }, planGaps, dataQualityWarnings),
    reportReadiness: getReportReadiness({
      activityCount: activities.length,
      plannedItemCount,
      capturedPlannedItemCount,
      openFollowUpCount: openFollowUps.length,
      completedFollowUpCount: completedFollowUps.length,
      warningCount: readinessWarnings.length,
      highPriorityCount: openFollowUps.filter((followUp) => followUp.priority === 'high').length,
      hasMeaningfulPlan: meaningfulPlanItemCount > 0,
    }),
  }
}

export type { IntelligenceInput, WeeklyIntelligence } from './intelligenceTypes'