import type { DailyActivity } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import type { WeeklyPlan } from '../types/weeklyPlan'
import type { ProjectIntelligenceSignal, WeeklyIntelligence } from '../intelligence/intelligenceTypes'

export type ProjectTaskStatus = 'completed' | 'in-progress' | 'carried-forward' | 'no-recorded-progress'
export type ProjectPerformanceStatus = 'Strong Progress' | 'On Track' | 'Mixed Progress' | 'Needs Attention' | 'No Recorded Progress'

export interface ProjectObjectivePerformance {
  id: string
  title: string
  status: ProjectTaskStatus
  evidence?: string
}

export interface ProjectPerformance {
  plannedTasks: number
  completedTasks: number
  inProgressTasks: number
  carriedForwardTasks: number
  completionRate: number | null
  plannedHours: number | null
  actualHours: number | null
  timeVariance: number | null
  objectives: ProjectObjectivePerformance[]
  followUpsCreated: number
  followUpsCompleted: number
  followUpsOutstanding: number
  followUpCompletionRate: number | null
  issuesIdentified: number
  issuesResolved: number
  issuesOpen: number
  activeRisks: number
  activeDependencies: number
  blockedWork: number
  delayedWork: number
  carryForwardItems: string[]
  overallStatus: ProjectPerformanceStatus
  summary: string
  evidence: string[]
}

interface PlannedTask {
  id: string
  title: string
  estimatedHours?: string
  dependency?: string
  status?: string
}

function numericHours(value?: string) {
  if (!value) return null
  const parsed = Number.parseFloat(value.replace(',', '.'))
  return Number.isFinite(parsed) ? parsed : null
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function taskText(task: PlannedTask) {
  return normalized(task.title)
}

function activityText(activity: DailyActivity) {
  return normalized([
    activity.account,
    activity.outcome,
    activity.intelligence,
    activity.nextAction,
    activity.workPerformed,
    activity.actualResults,
    activity.dailySummary,
    activity.carryForward,
    activity.progressStatus,
    activity.blockerRisk,
    activity.decision,
  ].filter(Boolean).join(' '))
}

function statusText(task: PlannedTask, activities: DailyActivity[]) {
  return normalized([task.status, ...activities.map((activity) => [activity.progressStatus, activity.actualResults, activity.dailySummary, activity.outcome, activity.carryForward].filter(Boolean).join(' '))].filter(Boolean).join(' '))
}

function getTaskStatus(task: PlannedTask, activities: DailyActivity[]): { status: ProjectTaskStatus; evidence?: string } {
  const status = statusText(task, activities)
  const evidence = activities.find((activity) => activity.actualResults || activity.dailySummary || activity.progressStatus || activity.outcome)
  if (/\b(completed|complete|done|delivered|resolved|closed|approved|finished)\b/.test(status)) return { status: 'completed', evidence: evidence?.actualResults || evidence?.dailySummary || task.status }
  if (/\b(carried forward|carry forward|rolled over|deferred)\b/.test(status)) return { status: 'carried-forward', evidence: evidence?.carryForward || task.status }
  if (/\b(in progress|in-progress|underway|started|working on|progressing|partially complete|ongoing)\b/.test(status)) return { status: 'in-progress', evidence: evidence?.progressStatus || evidence?.dailySummary || task.status }
  return { status: 'no-recorded-progress' }
}

function getPlannedTasks(plan: WeeklyPlan): PlannedTask[] {
  const tasks: PlannedTask[] = []
  for (const objective of plan.weeklyStrategicObjectives ?? []) tasks.push({ id: `objective:${objective.id}`, title: objective.text, status: undefined })
  for (const item of plan.virtualEngagementPlan ?? []) tasks.push({ id: `activity:${item.id}`, title: `${item.coverage} ${item.objective}`.trim(), estimatedHours: item.estimatedHours, dependency: item.dependency, status: item.status })
  for (const item of plan.keyAccountObjectives ?? []) {
    for (const objective of item.objectives) tasks.push({ id: `deliverable:${item.id}:${objective.id}`, title: `${item.account} ${objective.text}`.trim(), estimatedHours: item.estimatedHours, dependency: item.dependency, status: item.status })
  }
  for (const priority of plan.commercialPriorities ?? []) tasks.push({ id: `priority:${priority.id}`, title: priority.text, status: undefined })
  return tasks.filter((task) => task.title.trim())
}

function relatedActivities(task: PlannedTask, activities: DailyActivity[]) {
  const taskTokens = taskText(task).split(' ').filter((token) => token.length > 3)
  return activities.filter((activity) => {
    if (activity.plannedActivityId && (activity.plannedActivityId === task.id || activity.plannedActivityId.endsWith(task.id.split(':').pop() ?? ''))) return true
    const text = activityText(activity)
    const matchedTokens = taskTokens.filter((token) => text.includes(token)).length
    return taskTokens.length > 0 && matchedTokens >= Math.max(1, Math.ceil(taskTokens.length / 2))
  })
}

function signalCount(signals: ProjectIntelligenceSignal[], kinds: ProjectIntelligenceSignal['kind'][]) {
  return signals.filter((signal) => kinds.includes(signal.kind)).length
}

function signalResolved(signal: ProjectIntelligenceSignal) {
  return /\b(resolved|closed|completed|approved|finished)\b/i.test(signal.detail)
}

export function deriveProjectPerformance(plan: WeeklyPlan, activities: DailyActivity[], followUps: FollowUp[], intelligence: WeeklyIntelligence): ProjectPerformance {
  const tasks = getPlannedTasks(plan)
  const evaluated = tasks.map((task) => ({ task, result: getTaskStatus(task, relatedActivities(task, activities)) }))
  const completedTasks = evaluated.filter((item) => item.result.status === 'completed').length
  const inProgressTasks = evaluated.filter((item) => item.result.status === 'in-progress').length
  const carriedForwardTasks = evaluated.filter((item) => item.result.status === 'carried-forward').length
  const completionRate = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : null
  const plannedHourValues = tasks.map((task) => numericHours(task.estimatedHours)).filter((hours): hours is number => hours !== null)
  const actualHourValues = activities.map((activity) => numericHours(activity.timeSpent)).filter((hours): hours is number => hours !== null)
  const plannedHours = plannedHourValues.length > 0 ? plannedHourValues.reduce((sum, value) => sum + value, 0) : null
  const actualHours = actualHourValues.length > 0 ? actualHourValues.reduce((sum, value) => sum + value, 0) : null
  const timeVariance = plannedHours !== null && actualHours !== null ? actualHours - plannedHours : null
  const projectSignals = intelligence.projectSignals
  const issuesIdentified = signalCount(projectSignals, ['issue'])
  const issuesResolved = projectSignals.filter((signal) => signal.kind === 'issue' && signalResolved(signal)).length
  const issuesOpen = issuesIdentified - issuesResolved
  const activeRisks = projectSignals.filter((signal) => ['risk', 'dependency-risk', 'schedule-risk', 'resource-capacity'].includes(signal.kind) && !signalResolved(signal)).length
  const activeDependencies = projectSignals.filter((signal) => ['dependency', 'dependency-risk'].includes(signal.kind) && !signalResolved(signal)).length
  const blockedWork = projectSignals.filter((signal) => signal.kind === 'blocked-work' && !signalResolved(signal)).length
  const delayedWork = projectSignals.filter((signal) => signal.kind === 'delayed-work' && !signalResolved(signal)).length
  const followUpsCompleted = followUps.filter((followUp) => followUp.status === 'completed').length
  const followUpsOutstanding = followUps.filter((followUp) => followUp.status === 'open').length
  const followUpCompletionRate = followUps.length > 0 ? (followUpsCompleted / followUps.length) * 100 : null
  const objectives = (plan.weeklyStrategicObjectives ?? []).map((objective) => {
    const task = { id: `objective:${objective.id}`, title: objective.text }
    const result = getTaskStatus(task, relatedActivities(task, activities))
    return { id: objective.id, title: objective.text, status: result.status, ...(result.evidence ? { evidence: result.evidence } : {}) }
  })
  const carryForwardItems = [...new Set([
    ...evaluated.filter((item) => item.result.status === 'carried-forward').map((item) => item.task.title),
    ...activities.filter((activity) => activity.carryForward?.trim()).map((activity) => activity.carryForward as string),
  ])]
  const materiallyIncomplete = tasks.length > 0 && completedTasks < tasks.length && (inProgressTasks > 0 || carriedForwardTasks > 0 || tasks.some((task) => relatedActivities(task, activities).length === 0))
  const overallStatus: ProjectPerformanceStatus = tasks.length === 0 && activities.length === 0
    ? 'No Recorded Progress'
    : blockedWork > 0 || delayedWork > 0 || issuesOpen > 0 || activeRisks > 0
      ? 'Needs Attention'
      : tasks.length > 0 && completedTasks === tasks.length
        ? 'Strong Progress'
        : materiallyIncomplete
          ? 'Mixed Progress'
          : 'On Track'
  const evidence: string[] = []
  if (tasks.length > 0) evidence.push(`${completedTasks} of ${tasks.length} planned task${tasks.length === 1 ? '' : 's'} have explicit completion evidence.`)
  if (plannedHours !== null && actualHours !== null) evidence.push(`Recorded effort was ${actualHours} hour${actualHours === 1 ? '' : 's'} against ${plannedHours} planned, a ${Math.abs(timeVariance ?? 0)}-hour ${timeVariance && timeVariance > 0 ? 'unfavourable' : 'favourable'} variance.`)
  if (followUpsOutstanding > 0) evidence.push(`${followUpsOutstanding} follow-up${followUpsOutstanding === 1 ? '' : 's'} remain outstanding.`)
  if (carryForwardItems.length > 0) evidence.push(`${carryForwardItems.length} item${carryForwardItems.length === 1 ? '' : 's'} were carried forward.`)
  if (blockedWork > 0) evidence.push(`${blockedWork} item${blockedWork === 1 ? '' : 's'} remain blocked.`)
  if (activeDependencies > 0) evidence.push(`${activeDependencies} active dependenc${activeDependencies === 1 ? 'y' : 'ies'} remain visible.`)
  const summary = evidence.length > 0 ? evidence.slice(0, 2).join(' ') : 'No performance evidence was recorded for the selected week.'
  return {
    plannedTasks: tasks.length,
    completedTasks,
    inProgressTasks,
    carriedForwardTasks,
    completionRate,
    plannedHours,
    actualHours,
    timeVariance,
    objectives,
    followUpsCreated: followUps.length,
    followUpsCompleted,
    followUpsOutstanding,
    followUpCompletionRate,
    issuesIdentified,
    issuesResolved,
    issuesOpen,
    activeRisks,
    activeDependencies,
    blockedWork,
    delayedWork,
    carryForwardItems,
    overallStatus,
    summary,
    evidence,
  }
}
