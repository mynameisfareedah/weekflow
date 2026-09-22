import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from '../config/templates.ts'
import type { DailyActivity, StructuredOutcome } from '../types/dailyActivity.ts'
import type { FollowUp } from '../types/followUp.ts'
import type { WeeklyPlan } from '../types/weeklyPlan.ts'
import { classifyIntelligenceText, getStructuredOutcomeIntelligenceCategory, getStructuredOutcomeSignal } from './intelligenceTemplateAdapter.ts'
import type { Evidence, FollowUpSuggestion, IntelligenceCategory, OpportunitySignal, ProjectIntelligenceKind, ProjectIntelligenceSignal, WeeklyInsight } from './intelligenceTypes.ts'

function evidence(activity: DailyActivity, text: string, outcome?: StructuredOutcome): Evidence {
  return { activityId: activity.id, account: activity.account, text, ...(outcome ? { outcome } : {}) }
}

function titleForOutcome(outcome: StructuredOutcome) {
  return outcome.product ? `${outcome.type}: ${outcome.product}` : outcome.type
}

function normalizeServiceValue(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function addFieldInsight(result: Record<IntelligenceCategory, WeeklyInsight[]>, activity: DailyActivity, category: IntelligenceCategory, title: string, detail: string) {
  if (detail.trim()) result[category].push({ category, title, detail, account: activity.account, evidence: [evidence(activity, detail)] })
}

function addFieldOperationsInsights(result: Record<IntelligenceCategory, WeeklyInsight[]>, activities: DailyActivity[]) {
  const repeatedFaultGroups = new Map<string, DailyActivity[]>()
  for (const activity of activities) {
    const serviceContext = Boolean(
      activity.equipmentAsset?.trim()
      || activity.issueProblem?.trim()
      || activity.workOrderJob?.trim()
      || activity.serviceStatus?.trim()
      || activity.downtime?.trim()
      || activity.escalation?.trim()
      || activity.partsUsed?.trim()
      || activity.partsMaterialsUsed?.trim()
      || activity.followUpRequired?.trim()
      || /repair|service|inspection|maintenance|install|troubleshooting|dispatch|support|visit|job/i.test(activity.activityType)
      || activity.structuredOutcomes.some((outcome) => ['Issue Unresolved', 'Issue Partially Resolved', 'Escalation Required', 'Parts Required', 'Preventive Maintenance Completed', 'Customer Sign-off Obtained', 'Equipment Fault Identified'].includes(outcome.type)),
    )
    const issue = activity.issueProblem?.trim()
    const equipment = activity.equipmentAsset?.trim()
    if (equipment && issue) {
      const key = `${normalizeServiceValue(equipment)}::${normalizeServiceValue(issue)}`
      repeatedFaultGroups.set(key, [...(repeatedFaultGroups.get(key) ?? []), activity])
    }
    const outcomeTypes = new Set(activity.structuredOutcomes.map((outcome) => outcome.type))
    const status = activity.serviceStatus?.trim()
    const resolution = activity.resolution?.trim() ?? ''
    if (status === 'Awaiting Verification' || activity.followUpRequired === 'Required' || activity.followUpRequired === 'Pending' || outcomeTypes.has('Issue Unresolved') || outcomeTypes.has('Issue Partially Resolved') || (issue && (!resolution || /pending|incomplete|unresolved|awaiting/i.test(resolution)))) {
      const detail = status === 'Awaiting Verification' ? `Service Status: ${status}` : activity.followUpRequired === 'Required' || activity.followUpRequired === 'Pending' ? `Follow-up Required: ${activity.followUpRequired}` : issue ? `Issue / Problem: ${issue}; Resolution: ${resolution || 'not recorded'}` : 'Structured unresolved issue outcome recorded.'
      addFieldInsight(result, activity, 'risks', 'Unresolved Service Issue', detail)
    }
    if (outcomeTypes.has('Escalation Required') || activity.escalation?.trim()) addFieldInsight(result, activity, 'risks', 'Escalation Required', outcomeTypes.has('Escalation Required') ? 'Structured outcome: Escalation Required' : `Escalation: ${activity.escalation!.trim()}`)
    if (activity.downtime?.trim()) addFieldInsight(result, activity, 'risks', 'Downtime', `Downtime: ${activity.downtime.trim()}`)
    if (outcomeTypes.has('Parts Required')) addFieldInsight(result, activity, 'deliverables', 'Parts Required', `Structured outcome: Parts Required${activity.partsUsed?.trim() ? `; Parts Used: ${activity.partsUsed.trim()}` : ''}`)
    const preventiveMaintenanceEvidence = outcomeTypes.has('Preventive Maintenance Completed') || activity.activityType === 'Preventive Maintenance' || activity.activityType === 'Maintenance' || /preventive|scheduled|maintenance due|routine service|service check/i.test(`${activity.servicePerformed ?? ''} ${activity.outcome} ${activity.intelligence ?? ''}`)
    if (preventiveMaintenanceEvidence && (activity.nextServiceDate?.trim() || /preventive|scheduled|maintenance due|routine service|service check/i.test(`${activity.servicePerformed ?? ''} ${activity.outcome} ${activity.intelligence ?? ''}`))) {
      addFieldInsight(result, activity, 'progress', 'Preventive Maintenance', activity.nextServiceDate?.trim() ? `Next Service Date: ${activity.nextServiceDate.trim()}` : `Service Performed: ${(activity.servicePerformed || activity.outcome || activity.intelligence).trim()}`)
    }
    const customerConcernEvidence = outcomeTypes.has('Customer Confirmation Pending') || activity.customerSignOff === 'Confirmation Pending' || activity.customerSignOff === 'Customer Not Available' || activity.customerSignOff === 'Requires Follow-up' || (serviceContext && /customer concern|service quality|customer complaint|customer dissatisfied|customer issue|customer requested|customer raised/i.test(`${activity.intelligence} ${activity.outcome} ${activity.nextAction}`))
    if (customerConcernEvidence) {
      const detail = activity.customerSignOff && activity.customerSignOff !== 'Confirmed Operational'
        ? `Customer Confirmation: ${activity.customerSignOff}`
        : activity.intelligence.trim()
          ? `Customer concern evidence: ${activity.intelligence.trim()}`
          : 'Structured outcome: Customer Confirmation Pending'
      addFieldInsight(result, activity, 'stakeholders', 'Customer Concern', detail)
    }
  }
  for (const group of repeatedFaultGroups.values()) {
    if (group.length < 2) continue
    const first = group[0]
    const evidenceItems = group.map((activity) => evidence(activity, `Equipment / Asset: ${activity.equipmentAsset}; Issue / Problem: ${activity.issueProblem}`))
    result.risks.push({ category: 'risks', title: 'Repeat Fault', detail: `${first.equipmentAsset}: ${first.issueProblem} was captured in ${group.length} actual activities.`, account: first.account, evidence: evidenceItems })
    result.risks.push({ category: 'risks', title: 'Recurring Equipment Problem', detail: `${first.equipmentAsset} has repeated issue evidence across ${group.length} actual activities.`, account: first.account, evidence: evidenceItems })
  }
}

function smallBusinessText(activity: DailyActivity) {
  return [activity.outcome, activity.intelligence, activity.nextAction].filter(Boolean).join(' ').trim()
}

function addSmallBusinessSignals(signals: OpportunitySignal[], activity: DailyActivity, text: string) {
  if (!text) return
  const lower = text.toLowerCase()
  const add = (title: string, category: IntelligenceCategory, strength: OpportunitySignal['strength']) => {
    if (signals.some((signal) => signal.account === activity.account && signal.title === title && signal.evidence[0]?.activityId === activity.id)) return
    signals.push({ type: 'commercial-opportunity', account: activity.account, title, reason: text, strength, category, evidence: [evidence(activity, text)] })
  }
  if (/lead qualified|qualified lead|sales opportunity|pending opportunity|pipeline opportunity|proposal requested|quote requested|quotation requested|purchase intent|ready to buy|request for quote/i.test(lower)) add('Sales opportunity', 'commercial', 'high')
  if (/unresolved customer concern|customer complaint|customer issue remains|customer concern remains|repeat customer need|recurring customer need/i.test(lower)) add('Customer concern', 'stakeholders', 'moderate')
  if (/operational blocker|blocked operation|business process blocked|supplier problem|supplier issue|supplier delay|supplier unavailable/i.test(lower)) add('Supplier issue', 'risks', 'moderate')
  if (/payment pending|payment overdue|awaiting payment|payment action pending|invoice outstanding/i.test(lower)) add('Payment pending', 'commercial', 'moderate')
}

function parseTimeSpentHours(value?: string): number {
  const spent = (value ?? '').trim()
  if (!spent) return 0
  const hourMatch = spent.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|h)/i)
  if (hourMatch) return Number.parseFloat(hourMatch[1])
  const minutesMatch = spent.match(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|m)/i)
  if (minutesMatch) return Number.parseFloat(minutesMatch[1]) / 60
  const plainMatch = spent.match(/\d+(?:\.\d+)?/)
  if (plainMatch) return Number.parseFloat(plainMatch[0])
  return 0
}

function isMeaningfulPersonalCompletionText(value: string): boolean {
  const text = value.trim().toLowerCase()
  if (!text) return false
  if (/^(complete|completed|done|finished)$/i.test(text)) return false
  if (/^(complete|completed|done|finished)\s+(the\s+)?(task|activity|work|workday|goal)$/i.test(text)) return false
  const normalized = text.replace(/\b(complete|completed|done|finished)\b/gi, '').trim()
  if (!normalized || normalized.length < 3) return false
  return true
}

function activityPriorityUnresolved(activity: DailyActivity, priorityText: string): boolean {
  const haystack = [
    activity.workPerformed,
    activity.actualResults,
    activity.dailySummary,
    activity.carryForward,
    activity.intelligence,
    activity.nextAction,
    activity.outcome,
    activity.progressStatus,
    activity.blockerRisk,
    activity.decision,
    ...activity.structuredOutcomes.map((outcome) => `${outcome.type} ${outcome.details} ${outcome.product ?? ''}`),
  ].filter((value): value is string => Boolean(value?.trim())).join(' ')

  const lower = haystack.toLowerCase()
  const target = priorityText.toLowerCase().replace(/\s+/g, ' ')
  if (!lower.includes(target)) return false

  const unresolved = /unfinished|not complete|not achieved|not finished|still open|incomplete|remaining|partial|carry forward|carry-forward|remains needed|still needs|not yet/i
  return unresolved.test(haystack)
}

function activityTouchedPriority(activity: DailyActivity, priorityText: string): boolean {
  const haystack = [
    activity.workPerformed,
    activity.actualResults,
    activity.dailySummary,
    activity.carryForward,
    activity.intelligence,
    activity.nextAction,
    activity.outcome,
    activity.progressStatus,
    activity.blockerRisk,
    activity.decision,
    ...activity.structuredOutcomes.map((outcome) => `${outcome.type} ${outcome.details} ${outcome.product ?? ''}`),
  ].filter((value): value is string => Boolean(value?.trim())).join(' ').toLowerCase()
  return haystack.includes(priorityText.toLowerCase()) || haystack.includes(priorityText.toLowerCase().replace(/\s+/g, ' '))
}

function addPersonalInsights(result: Record<IntelligenceCategory, WeeklyInsight[]>, activities: DailyActivity[], plan: WeeklyPlan, followUps: FollowUp[]) {
  const totalHours = activities.reduce((sum, activity) => sum + parseTimeSpentHours(activity.timeSpent), 0)

  if (totalHours > 0) {
    const displayHours = Math.round(totalHours)
    const detail = `${displayHours} ${displayHours === 1 ? 'hour' : 'hours'} of activity time were recorded this week.`
    result.progress.push({ category: 'progress', title: 'Time / effort pattern', detail, account: 'Personal Productivity', evidence: activities.map((activity) => evidence(activity, `Time spent: ${activity.timeSpent ?? 'n/a'}`)) })
  }

  for (const activity of activities) {
    const actualResults = (activity.actualResults ?? '').trim()
    const workPerformed = (activity.workPerformed ?? '').trim()
    const nextAction = (activity.nextAction ?? '').trim()

    if (isMeaningfulPersonalCompletionText(actualResults) && workPerformed) {
      const detail = `${workPerformed} ${actualResults}`.trim()
      result.progress.push({ category: 'progress', title: 'Completed / Accomplished', detail, account: activity.account, evidence: [evidence(activity, detail)] })
    }

    const carryForward = (activity.carryForward ?? '').trim()
    const unresolvedCompletionEvidence = /unfinished|not complete|not achieved|not finished|still open|incomplete|remaining|partial/i.test(actualResults)
    if (carryForward) {
      result.progress.push({ category: 'progress', title: 'Carry-forward work', detail: carryForward, account: activity.account, evidence: [evidence(activity, carryForward)] })
    } else if (unresolvedCompletionEvidence && nextAction) {
      result.progress.push({ category: 'progress', title: 'Carry-forward work', detail: `${nextAction} remains needed for the unfinished task.`, account: activity.account, evidence: [evidence(activity, `${actualResults} ${nextAction}`)] })
    }

    if (nextAction) {
      result.progress.push({ category: 'progress', title: 'Next-step signal', detail: nextAction, account: activity.account, evidence: [evidence(activity, nextAction)] })
    }
  }

  for (const followUp of followUps.filter((item) => item.status === 'open')) {
    if (!followUp.task.trim()) continue
    result.stakeholders.push({ category: 'stakeholders', title: 'Open follow-up', detail: followUp.task, account: followUp.facility ?? 'Personal Productivity', evidence: [evidence({ id: followUp.id, date: '', weekStart: '', plannedActivityId: null, account: followUp.facility ?? 'Personal Productivity', activityType: 'Task', hcpNames: [], outcome: '', intelligence: '', nextAction: '', structuredOutcomes: [], createdAt: '', updatedAt: '' }, followUp.task)] })
  }

  for (const priority of plan.commercialPriorities) {
    const text = priority.text?.trim()
    if (!text) continue
    const touched = activities.some((activity) => activityTouchedPriority(activity, text))
    const unresolved = activities.some((activity) => activityPriorityUnresolved(activity, text))
    if (!touched || unresolved) {
      result.risks.push({ category: 'risks', title: 'Priority attention', detail: text, account: priority.account ?? 'Personal Productivity', evidence: [evidence({ id: priority.id, date: '', weekStart: '', plannedActivityId: null, account: priority.account ?? 'Personal Productivity', activityType: 'Task', hcpNames: [], outcome: '', intelligence: '', nextAction: '', structuredOutcomes: [], createdAt: '', updatedAt: '' }, text)] })
    }
  }
}

function parseWholeNumber(value?: string) {
  const match = value?.replace(/,/g, '').match(/\d+(?:\.\d+)?/)
  return match ? Number.parseFloat(match[0]) : null
}

function addNgoInsight(result: Record<IntelligenceCategory, WeeklyInsight[]>, activity: DailyActivity, category: IntelligenceCategory, title: string, detail: string) {
  result[category].push({ category, title, detail, account: activity.account, evidence: [evidence(activity, detail)] })
}

function addNgoInsights(result: Record<IntelligenceCategory, WeeklyInsight[]>, activities: DailyActivity[], plan: WeeklyPlan, followUps: FollowUp[]) {
  const plannedActivities = plan.programmeActivities ?? []
  for (const activity of activities) {
    const plannedId = activity.plannedActivityId?.startsWith('programme:') ? activity.plannedActivityId.slice('programme:'.length) : ''
    const planned = plannedActivities.find((item) => item.id === plannedId) ?? plannedActivities.find((item) => item.activity.trim().toLowerCase() === activity.account.trim().toLowerCase())
    const target = parseWholeNumber(planned?.target)
    const actualReach = parseWholeNumber(activity.actualReach)

    if (target !== null && actualReach !== null) {
      const variance = actualReach - target
      if (variance < 0) addNgoInsight(result, activity, 'risks', 'Participation below target', `${actualReach} participants reached against a planned target of ${target}; variance ${Math.abs(variance)} below target.`)
      else addNgoInsight(result, activity, 'progress', 'Output target reached', `${actualReach} participants reached against a planned target of ${target}.`)
    } else if (actualReach !== null) {
      addNgoInsight(result, activity, 'progress', 'Actual reach recorded', `${actualReach} participants reached; no planned target was used to infer additional reach.`)
    }

    if (activity.workPerformed?.trim() || activity.actualResults?.trim()) addNgoInsight(result, activity, 'deliverables', 'Output evidence recorded', activity.actualResults?.trim() || activity.workPerformed?.trim() || 'Actual programme work was recorded.')
    if (activity.resourceIssue?.trim()) addNgoInsight(result, activity, 'risks', 'Resource / logistics issue', `${activity.resourceIssue.trim()}${activity.resourceAction?.trim() ? ` Action taken: ${activity.resourceAction.trim()}.` : ''}`)
    if (activity.engagementResult?.trim()) addNgoInsight(result, activity, 'progress', 'Community feedback recorded', activity.engagementResult.trim())
    if (activity.volunteer?.trim() && (activity.volunteerParticipation?.trim() || activity.volunteerContribution?.trim())) addNgoInsight(result, activity, 'progress', 'Volunteer participation recorded', `${activity.volunteer.trim()} participated${activity.volunteerContribution?.trim() ? ` and ${activity.volunteerContribution.trim().replace(/[.]$/, '')}.` : '.'}`)
    if (activity.stakeholder?.trim() && (activity.stakeholderEngagement?.trim() || activity.stakeholderResult?.trim())) addNgoInsight(result, activity, 'stakeholders', 'Stakeholder engagement recorded', `${activity.stakeholder.trim()}: ${activity.stakeholderResult?.trim() || activity.stakeholderEngagement?.trim()}`)
    if (activity.stakeholderNextStep?.trim()) addNgoInsight(result, activity, 'stakeholders', 'Stakeholder follow-up required', activity.stakeholderNextStep.trim())
    if (activity.carryForward?.trim()) addNgoInsight(result, activity, 'risks', 'Programme item carried forward', activity.carryForward.trim())
    if (activity.intelligence?.trim()) addNgoInsight(result, activity, 'progress', 'Programme learning recorded', activity.intelligence.trim())
  }

  for (const target of plan.monitoringImpactTargets ?? []) {
    if (target.kind !== 'intended-outcomes' || !target.text.trim()) continue
    const evidenceFound = activities.some((activity) => `${activity.actualResults ?? ''} ${activity.engagementResult ?? ''} ${activity.outcome ?? ''} ${activity.intelligence ?? ''}`.toLowerCase().includes(target.text.trim().toLowerCase()))
    if (!evidenceFound) result.risks.push({ category: 'risks', title: 'Outcome evidence pending', detail: target.text.trim(), account: 'Programme', evidence: [] })
  }

  for (const followUp of followUps.filter((item) => item.status === 'open' && item.task.trim())) {
    const source: DailyActivity = { id: followUp.id, date: '', weekStart: '', plannedActivityId: null, account: followUp.facility ?? 'Programme', activityType: 'Programme Activity', hcpNames: [], outcome: '', intelligence: '', nextAction: followUp.task, structuredOutcomes: [], createdAt: '', updatedAt: '' }
    addNgoInsight(result, source, 'stakeholders', 'Open programme follow-up', followUp.task.trim())
  }
}

function projectActivityText(activity: DailyActivity) {
  return [activity.workPerformed, activity.actualResults, activity.dailySummary, activity.carryForward, activity.outcome, activity.intelligence, activity.nextAction, activity.progressStatus, activity.blockerRisk, activity.decision]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(' ')
    .trim()
}

function addProjectSignal(signals: ProjectIntelligenceSignal[], kind: ProjectIntelligenceKind, title: string, detail: string, activity: DailyActivity) {
  if (signals.some((signal) => signal.kind === kind && signal.sourceActivityId === activity.id)) return
  signals.push({ kind, title, detail, account: activity.account, sourceActivityId: activity.id, evidence: [evidence(activity, detail)] })
}

function deriveProjectActivitySignals(signals: ProjectIntelligenceSignal[], activity: DailyActivity) {
  const text = projectActivityText(activity)
  if (!text) return
  const lower = text.toLowerCase()
  const futureRisk = /\b(may|might|could|potential|at risk|risk|concern)\b.{0,80}\b(delay|delayed|deadline|delivery|implementation|schedule|miss|problem|issue|dependency|access|approval|vendor)\b/i.test(lower)
  const dependencyEvidence = /\b(waiting for|awaiting|dependent on|dependency|requires? (?:management )?approval|vendor (?:response|access)|network credentials|credentials|office access|access dependency|external dependency)\b/i.test(lower)

  if (futureRisk) addProjectSignal(signals, 'risk', 'Risk Identified', text, activity)
  if (/\b(unable to proceed|cannot proceed|can't proceed|blocked|blocking|waiting for access|waiting for approval|waiting for response|waiting for credentials|work cannot proceed)\b/i.test(lower)) addProjectSignal(signals, 'blocked-work', 'Blocked Work', text, activity)
  if (/\b(delayed|delay|postponed|overdue|behind schedule|could not complete as planned|not completed as planned)\b/i.test(lower)) addProjectSignal(signals, 'delayed-work', 'Delayed Work', text, activity)
  if (dependencyEvidence) {
    const unresolved = futureRisk || /\b(pending|unresolved|may delay|could delay|at risk)\b/i.test(lower)
    addProjectSignal(signals, unresolved ? 'dependency-risk' : 'dependency', unresolved ? 'Dependency Risk' : 'Dependency', text, activity)
  }
  if (/\b(issue identified|problem identified|failed|failure|unresolved|requires resolution|not working|error during|network (?:connection )?failed|support problem)\b/i.test(lower) && !futureRisk) addProjectSignal(signals, 'issue', 'Issue Identified', text, activity)
  if (/\b(insufficient(?:\s+\w+){0,3}\s+resources?|staff shortage|capacity constraint|unavailable resource|workload constraint|not enough (?:staff|people|resources))\b/i.test(lower)) addProjectSignal(signals, 'resource-capacity', 'Resource / Capacity Concern', text, activity)
  if (/\b(deadline at risk|milestone at risk|delivery date concern|schedule risk|insufficient time remaining|friday delivery is at risk|delivery is at risk)\b/i.test(lower)) addProjectSignal(signals, 'schedule-risk', 'Schedule Risk', text, activity)
}

function deriveProjectPlanSignals(signals: ProjectIntelligenceSignal[], plan: WeeklyPlan) {
  const dependencyItems = [
    ...(plan.virtualEngagementPlan ?? []).map((item) => ({ id: item.id, account: item.coverage, dependency: item.dependency, status: item.status })),
    ...(plan.keyAccountObjectives ?? []).map((item) => ({ id: item.id, account: item.account, dependency: item.dependency, status: item.status })),
  ]
  for (const item of dependencyItems) {
    const dependency = item.dependency?.trim()
    if (!dependency) continue
    const unresolved = /\b(waiting|pending|unresolved|blocked|delayed|at risk|may delay|approval required)\b/i.test(`${dependency} ${item.status ?? ''}`)
    signals.push({ kind: unresolved ? 'dependency-risk' : 'dependency', title: unresolved ? 'Dependency Risk' : 'Dependency', detail: `${item.account || 'Planned work'} depends on ${dependency}.`, account: item.account, sourceActivityId: `plan:${item.id}`, evidence: [] })
  }
}

export function deriveProjectIntelligence(activities: DailyActivity[], plan: WeeklyPlan, followUpSuggestions: FollowUpSuggestion[], template: WeekFlowTemplate = FIELD_SALES_TEMPLATE): ProjectIntelligenceSignal[] {
  if (template.id !== 'project-management') return []
  const signals: ProjectIntelligenceSignal[] = []
  activities.forEach((activity) => deriveProjectActivitySignals(signals, activity))
  deriveProjectPlanSignals(signals, plan)
  for (const suggestion of followUpSuggestions) {
    if (signals.some((signal) => signal.kind === 'follow-up-required' && signal.sourceActivityId === suggestion.sourceActivityId)) continue
    signals.push({ kind: 'follow-up-required', title: 'Follow-up Required', detail: suggestion.title, account: suggestion.account, sourceActivityId: suggestion.sourceActivityId, evidence: [] })
  }
  return signals
}

export function deriveWeeklyInsights(activities: DailyActivity[], template: WeekFlowTemplate = FIELD_SALES_TEMPLATE, plan?: WeeklyPlan, followUps: FollowUp[] = []): Record<IntelligenceCategory, WeeklyInsight[]> {
  const result: Record<IntelligenceCategory, WeeklyInsight[]> = {
    commercial: [], patient: [], 'access-market': [], 'strategic-accounts': [], 'scientific-engagement': [], progress: [], risks: [], stakeholders: [], deliverables: [],
  }
  if (template.id === 'personal') {
    addPersonalInsights(result, activities, plan ?? { weekStart: '', weeklyStrategicObjectives: [], days: [], virtualEngagementPlan: [], keyAccountObjectives: [], commercialPriorities: [], successMeasures: [] }, followUps)
  }
  if (template.id === 'ngo-community') addNgoInsights(result, activities, plan ?? { weekStart: '', weeklyStrategicObjectives: [], days: [], virtualEngagementPlan: [], keyAccountObjectives: [], commercialPriorities: [], successMeasures: [] }, followUps)
  if (template.id === 'field-service') addFieldOperationsInsights(result, activities)
  for (const activity of activities) {
    for (const outcome of activity.structuredOutcomes) {
      const isConfigured = Object.prototype.hasOwnProperty.call(template.intelligence.structuredOutcomeCategories, outcome.type)
      if (!isConfigured || (!outcome.details.trim() && !outcome.product)) continue
      const category = getStructuredOutcomeIntelligenceCategory(template, outcome.type)
      result[category].push({ category, title: titleForOutcome(outcome), detail: outcome.details || outcome.type, account: activity.account, evidence: [evidence(activity, outcome.details || outcome.type, outcome)] })
    }
    if (activity.intelligence.trim()) {
      const text = activity.intelligence.trim()
      const category = classifyIntelligenceText(template, text)
      result[category].push({ category, title: 'Captured intelligence', detail: text, account: activity.account, evidence: [evidence(activity, text)] })
    }

    if (template.id === 'field-service') continue
    if (template.id === 'small-business') {
      const text = smallBusinessText(activity)
      if (text) {
        const lower = text.toLowerCase()
        if (/lead qualified|qualified lead|sales opportunity|pending opportunity|pipeline opportunity|proposal requested|quote requested|quotation requested|purchase intent|ready to buy|request for quote/i.test(lower)) result.commercial.push({ category: 'commercial', title: 'Sales opportunity', detail: text, account: activity.account, evidence: [evidence(activity, text)] })
        if (/unresolved customer concern|customer complaint|customer issue remains|customer concern remains|repeat customer need|recurring customer need/i.test(lower)) result.stakeholders.push({ category: 'stakeholders', title: 'Customer concern', detail: text, account: activity.account, evidence: [evidence(activity, text)] })
        if (/operational blocker|blocked operation|business process blocked|supplier problem|supplier issue|supplier delay|supplier unavailable/i.test(lower)) result.risks.push({ category: 'risks', title: 'Supplier issue', detail: text, account: activity.account, evidence: [evidence(activity, text)] })
        if (/payment pending|payment overdue|awaiting payment|payment action pending|invoice outstanding/i.test(lower)) result.commercial.push({ category: 'commercial', title: 'Payment pending', detail: text, account: activity.account, evidence: [evidence(activity, text)] })
      }
    }
  }
  for (const category of Object.keys(result) as IntelligenceCategory[]) {
    result[category] = result[category].filter((insight, index, all) => all.findIndex((candidate) => candidate.account === insight.account && candidate.title === insight.title && candidate.detail === insight.detail) === index)
  }
  return result
}

export function deriveOpportunitySignals(activities: DailyActivity[], template: WeekFlowTemplate = FIELD_SALES_TEMPLATE): OpportunitySignal[] {
  const signals: OpportunitySignal[] = []
  for (const activity of activities) {
    for (const outcome of activity.structuredOutcomes) {
      const mapped = getStructuredOutcomeSignal(template, outcome.type, { product: outcome.product, details: outcome.details })
      if (mapped) {
        const shouldEmit = template.id !== 'field-service' || !['customer concern', 'parts required', 'service quality issue', 'sla risk', 'recurring equipment issue'].some((label) => mapped.title.toLowerCase().includes(label))
        if (shouldEmit) signals.push({ type: template.id === 'project-management' ? 'project-signal' : 'commercial-opportunity', account: activity.account, title: mapped.title, reason: outcome.details || `${outcome.type} was recorded in structured activity data.`, strength: 'moderate', category: mapped.category, evidence: [evidence(activity, outcome.details || outcome.type, outcome)] })
      }
    }

    if (template.id === 'field-service') continue
    if (template.id === 'project-management' && `${activity.outcome} ${activity.intelligence}`.trim()) {
      const text = [activity.outcome, activity.intelligence].filter(Boolean).join(' ')
      const category = classifyIntelligenceText(template, text)
      const title = category === 'risks' ? 'Project risk or blocker' : category === 'deliverables' ? 'Deliverable progress' : category === 'stakeholders' ? 'Stakeholder update' : 'Project progress'
      if (!signals.some((signal) => signal.account === activity.account && signal.title === title && signal.evidence[0].activityId === activity.id)) signals.push({ type: 'project-signal', account: activity.account, title, reason: text, strength: 'moderate', category, evidence: [evidence(activity, text)] })
      continue
    }
    if (template.id === 'small-business') {
      addSmallBusinessSignals(signals, activity, smallBusinessText(activity))
      continue
    }
    if (/nhis|access|fund|stock|mdt|referral|cme|meeting|journal/i.test(`${activity.outcome} ${activity.intelligence}`)) {
      const text = [activity.outcome, activity.intelligence].filter(Boolean).join(' ')
      const category: IntelligenceCategory = /mdt|referral/i.test(text) ? 'strategic-accounts' : /cme|meeting|journal/i.test(text) ? 'scientific-engagement' : 'access-market'
      const title = category === 'strategic-accounts' ? 'Strategic account signal' : category === 'scientific-engagement' ? 'Scientific engagement opportunity' : 'Unresolved patient access issue'
      if (!signals.some((signal) => signal.account === activity.account && signal.title === title && signal.evidence[0].activityId === activity.id)) signals.push({ type: 'commercial-opportunity', account: activity.account, title, reason: text, strength: 'moderate', category, evidence: [evidence(activity, text)] })
    }
  }
  return signals
}