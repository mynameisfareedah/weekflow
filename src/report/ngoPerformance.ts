import type { DailyActivity } from '../types/dailyActivity.ts'
import type { FollowUp } from '../types/followUp.ts'
import type { WeeklyPlan } from '../types/weeklyPlan.ts'
import type { WeekFlowTemplate } from '../config/templates.ts'
import { deriveWeeklyIntelligence } from '../intelligence/intelligenceEngine.ts'
import { buildNarrativeReport } from './reportNarrative.ts'

export type NgoPerformanceStatus = 'Insufficient evidence' | 'Progress evidenced' | 'Attention required'

export interface NgoPerformance {
  plannedActivities: number
  completedActivities: number
  carriedForwardActivities: number
  completionRate: number | null
  plannedReach: number | null
  actualReach: number | null
  reachVariance: number | null
  objectivesPlanned: number
  objectivesWithEvidence: number
  objectivesRequiringAction: number
  openFollowUps: number
  completedFollowUps: number
  overdueFollowUps: number
  stakeholderEngagements: number
  stakeholderActions: number
  resourceIssues: string[]
  outputsWithEvidence: number
  actualReachEvidence: number
  outcomeEvidence: number
  outcomeEvidencePending: number
  evidenceGaps: number
  issues: string[]
  status: NgoPerformanceStatus
  empty: boolean
}

function numeric(value?: string) {
  if (!value) return null
  const match = value.replace(/,/g, '').match(/\d+(?:\.\d+)?/)
  return match ? Number.parseFloat(match[0]) : null
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function actualEvidence(activity: DailyActivity) {
  return Boolean(activity.workPerformed?.trim() || activity.actualResults?.trim() || activity.dailySummary?.trim())
}

function matchesObjective(objective: string, activity: DailyActivity) {
  const tokens = normalized(objective).split(' ').filter((token) => token.length > 3)
  const text = normalized([activity.account, activity.workPerformed, activity.actualResults, activity.dailySummary, activity.outcome, activity.nextAction].filter(Boolean).join(' '))
  return tokens.length > 0 && tokens.filter((token) => text.includes(token)).length >= Math.max(1, Math.ceil(tokens.length / 2))
}

function assessmentStatus(plan: WeeklyPlan, activities: DailyActivity[], followUps: FollowUp[], weekKey: string, template: WeekFlowTemplate): NgoPerformanceStatus {
  const narrative = buildNarrativeReport({ weekKey, weekLabel: '', plan, activities, followUps, template })
  const summary = narrative.sections.find((section) => section.id === 'ngo-overall-assessment')?.items[0]?.summary.toLowerCase() ?? ''
  if (summary.startsWith('attention required')) return 'Attention required'
  if (summary.startsWith('progress evidenced')) return 'Progress evidenced'
  return 'Insufficient evidence'
}

export function deriveNgoPerformance(plan: WeeklyPlan, activities: DailyActivity[], followUps: FollowUp[], weekKey: string, template: WeekFlowTemplate): NgoPerformance {
  const plannedActivities = (plan.programmeActivities ?? []).filter((item) => item.activity.trim())
  const actualActivities = activities.filter(actualEvidence)
  const completedActivities = plannedActivities.filter((planned) => activities.some((activity) => {
    if (!actualEvidence(activity)) return false
    const plannedId = activity.plannedActivityId?.replace(/^programme:/, '')
    return plannedId === planned.id || normalized(activity.account) === normalized(planned.activity)
  })).length
  const carriedForwardActivities = activities.filter((activity) => Boolean(activity.carryForward?.trim())).length
  const plannedReachValues = plannedActivities.map((item) => numeric(item.target)).filter((value): value is number => value !== null)
  const actualReachValues = activities.map((activity) => numeric(activity.actualReach)).filter((value): value is number => value !== null)
  const plannedReach = plannedReachValues.length > 0 ? plannedReachValues.reduce((sum, value) => sum + value, 0) : null
  const actualReach = actualReachValues.length > 0 ? actualReachValues.reduce((sum, value) => sum + value, 0) : null
  const intelligence = deriveWeeklyIntelligence({ selectedWeek: weekKey, plan, activities, followUps, template })
  const objectives = (plan.weeklyStrategicObjectives ?? []).filter((item) => item.text.trim())
  const objectivesWithEvidence = objectives.filter((objective) => actualActivities.some((activity) => matchesObjective(objective.text, activity))).length
  const openFollowUps = followUps.filter((item) => item.status === 'open').length
  const completedFollowUps = followUps.filter((item) => item.status === 'completed').length
  const today = new Date()
  const overdueFollowUps = followUps.filter((item) => item.status === 'open' && Boolean(item.dueDate) && new Date(`${item.dueDate}T23:59:59`) < today).length
  const stakeholderEngagements = activities.filter((activity) => activity.stakeholder?.trim() && (activity.stakeholderEngagement?.trim() || activity.stakeholderResult?.trim())).length
  const stakeholderActions = activities.filter((activity) => activity.stakeholderNextStep?.trim()).length
  const resourceIssues = intelligence.insights.risks.filter((item) => /resource|logistics/i.test(item.title)).map((item) => item.detail)
  const outputsWithEvidence = intelligence.insights.deliverables.filter((item) => /output evidence|output/i.test(item.title)).length
  const actualReachEvidence = actualReachValues.length
  const outcomeEvidence = activities.filter((activity) => activity.outcome?.trim() || activity.engagementResult?.trim() || activity.structuredOutcomes.some((outcome) => outcome.details?.trim())).length
  const outcomeEvidencePending = intelligence.insights.risks.filter((item) => /outcome evidence pending/i.test(item.title)).length
  const evidenceGaps = intelligence.insights.risks.filter((item) => /evidence|documentation|pending/i.test(item.title)).length
  const issues = intelligence.insights.risks.map((item) => item.detail).slice(0, 5)

  return {
    plannedActivities: plannedActivities.length,
    completedActivities,
    carriedForwardActivities,
    completionRate: plannedActivities.length > 0 ? (completedActivities / plannedActivities.length) * 100 : null,
    plannedReach,
    actualReach,
    reachVariance: plannedReach !== null && actualReach !== null ? actualReach - plannedReach : null,
    objectivesPlanned: objectives.length,
    objectivesWithEvidence,
    objectivesRequiringAction: Math.max(0, objectives.length - objectivesWithEvidence),
    openFollowUps,
    completedFollowUps,
    overdueFollowUps,
    stakeholderEngagements,
    stakeholderActions,
    resourceIssues,
    outputsWithEvidence,
    actualReachEvidence,
    outcomeEvidence,
    outcomeEvidencePending,
    evidenceGaps,
    issues,
    status: assessmentStatus(plan, activities, followUps, weekKey, template),
    empty: activities.length === 0,
  }
}
