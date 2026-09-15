import type { DailyActivity, StructuredOutcome } from '../types/dailyActivity.ts'
import type { FollowUp } from '../types/followUp.ts'
import type { WeeklyPlan } from '../types/weeklyPlan.ts'
import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from '../config/templates.ts'
import { getReportSectionDescriptors } from './reportTemplateAdapter.ts'
import { mapReportSections } from './reportDataMapper.ts'
import type { ProjectPerformance } from './projectPerformance.ts'
import { deriveWeeklyIntelligence } from '../intelligence/intelligenceEngine.ts'

export interface NarrativeItem {
  title: string
  summary: string
  detail?: string
}

export interface NarrativeSection {
  id: string
  title: string
  order: number
  emptyText: string
  items: NarrativeItem[]
}

export interface NarrativeReport {
  title: string
  weekLabel: string
  metadata: string
  summaryText: string
  sections: NarrativeSection[]
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function sentenceCase(value: string) {
  const text = normalizeWhitespace(value)
  if (!text) return ''
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()
}

function titleCasePhrase(value: string) {
  const text = normalizeWhitespace(value)
  if (!text) return ''
  return text
    .toLowerCase()
    .split(/\s+/)
    .map((word) => {
      if (!word) return word
      if (['and', 'or', 'of', 'for', 'the', 'a', 'an', 'to', 'in', 'on', 'at', 'by', 'with', 'from', 'as'].includes(word)) return word
      const lowerWord = word.toLowerCase()
      return lowerWord === 'dr' ? 'Dr.' : lowerWord === 'hcp' ? 'HCP' : lowerWord.charAt(0).toUpperCase() + lowerWord.slice(1)
    })
    .join(' ')
}

function cleanLabel(value: string) {
  return normalizeWhitespace(value.replace(/[_-]+/g, ' ')).replace(/\s+/g, ' ')
}

function formatPersonName(value: string) {
  const cleaned = cleanLabel(value)
  if (!cleaned) return ''
  if (cleaned.toLowerCase() === 'dr smith') return 'Dr. Smith'
  if (cleaned.toLowerCase() === 'smith') return 'Dr. Smith'
  return titleCasePhrase(cleaned)
}

function formatDateLabel(dateValue: string) {
  const date = new Date(`${dateValue}T12:00:00`)
  if (Number.isNaN(date.getTime())) return dateValue
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
}

function formatWeekRangeLabel(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const startLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)
  const endLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)
  return `${startLabel} - ${endLabel}`
}

function inflateValue(value: string) {
  const text = normalizeWhitespace(value)
  return text
    .replace(/\s*\|\s*/g, '. ')
    .replace(/\s+/g, ' ')
    .trim()
}

function humanizeText(value: string) {
  const text = inflateValue(value)
  if (!text) return ''
  return sentenceCase(text)
}

function withFinalPeriod(value: string) {
  const text = normalizeWhitespace(value)
  if (!text) return ''
  return /[.!?]$/.test(text) ? text : `${text}.`
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

function makeTitleFromActivity(activity: DailyActivity, template: WeekFlowTemplate) {
  if (template.id === 'personal') {
    const accountText = cleanLabel(activity.account)
    const lowerAccount = accountText.toLowerCase()
    const lowerType = activity.activityType.toLowerCase()
    if (lowerType.includes('appointment') || lowerAccount.includes('hair') || lowerAccount.includes('salon')) return 'Hair Appointment'
    if (lowerAccount.includes('tailor') || lowerAccount.includes('tailors')) return 'Tailor Visit'
    if (lowerAccount.includes('doctor') || lowerAccount.includes('clinic')) return 'Appointment'
    if (lowerType.includes('errand')) return 'Errand'
    return titleCasePhrase(accountText || activity.activityType)
  }

  if (template.id === 'field-sales') {
    const person = formatPersonName(activity.hcpNames[0] ?? activity.account)
    const account = cleanLabel(activity.account)
    if (person && account && person.toLowerCase() !== account.toLowerCase()) return `${person} — HCP Engagement`
    if (person) return `${person} — HCP Engagement`
    return `${titleCasePhrase(account || 'Field Activity')} — HCP Engagement`
  }

  if (template.id === 'field-service') {
    const site = cleanLabel(activity.account)
    return `${titleCasePhrase(site || 'Service Activity')} — Service Intervention`
  }

  if (template.id === 'project-management') {
    const project = cleanLabel(activity.account)
    return `${titleCasePhrase(project || 'Project Activity')} — Client Review`
  }

  if (template.id === 'small-business') {
    const customer = formatPersonName(activity.hcpNames[0] ?? activity.account)
    return `${customer || titleCasePhrase(cleanLabel(activity.account) || 'Customer')} — Customer Order`
  }

  if (template.id === 'ngo-community') {
    return 'Community Outreach'
  }

  if (template.id === 'education') {
    return 'Student Support Session'
  }

  return titleCasePhrase(cleanLabel(activity.account || activity.activityType))
}

function buildPersonalSummary(activity: DailyActivity) {
  const text = cleanLabel(activity.outcome || activity.account || activity.activityType)
  const account = cleanLabel(activity.account)
  const lowerAccount = account.toLowerCase()
  const lowerType = activity.activityType.toLowerCase()

  if (lowerType.includes('appointment') || lowerAccount.includes('hair') || lowerAccount.includes('salon')) {
    const sentence = text ? `Completed ${text.toLowerCase()} as planned.` : 'Completed the appointment as planned.'
    return sentence
  }

  if (lowerAccount.includes('tailor') || lowerAccount.includes('tailors')) {
    const adjusted = text ? `Dropped off clothing with the tailor for ${inflateValue(text).toLowerCase()}.` : 'Dropped off clothing with the tailor for adjustment.'
    const balance = normalizeWhitespace(activity.intelligence || '')
    const balanceSentence = balance ? ` A ${balance.replace(/^to\s+/i, '').replace(/^(balance\s+)?her\s+/i, '').replace(/^.*?\b(\d[0-9,]*)\b.*$/i, '$1')} balance was noted in relation to the adjustment.` : ''
    return `${adjusted}${balanceSentence}`.replace(/\s+/g, ' ').trim()
  }

  if (text) return `Completed ${sentenceCase(text).toLowerCase()} as planned.`
  return 'Completed the activity as planned.'
}

function buildFieldSalesSummary(activity: DailyActivity) {
  const name = formatPersonName(activity.hcpNames[0] ?? activity.account)
  const outcome = humanizeText(activity.outcome || '')
  const intelligence = humanizeText(activity.intelligence || '')
  const nextAction = humanizeText(activity.nextAction || '')
  const pieces: string[] = []
  if (outcome) {
    if (name) pieces.push(`${name} engaged. ${outcome}`)
    else pieces.push(outcome)
  }
  if (intelligence) pieces.push(intelligence)
  if (nextAction) pieces.push(`Next action: ${nextAction}`)
  return withFinalPeriod(pieces.join('. ') || 'No outcome details recorded.')
}

function buildNgoCommunitySummary(activity: DailyActivity, plan?: WeeklyPlan) {
  const plannedActivity = plan?.programmeActivities?.find((item) => item.id === activity.plannedActivityId?.replace(/^programme:/, ''))
    ?? plan?.programmeActivities?.find((item) => item.activity.trim().toLowerCase() === activity.account.trim().toLowerCase())
  const target = plannedActivity?.target?.trim()
  const detailParts = [
    activity.workPerformed,
    activity.actualResults,
    activity.engagementResult,
    activity.programmeArea ? `Programme area: ${activity.programmeArea}` : '',
    activity.location ? `Location: ${activity.location}` : '',
    activity.communityGroup ? `Community group: ${activity.communityGroup}` : '',
    activity.engagementActivity ? `Engagement activity: ${activity.engagementActivity}` : '',
    target && activity.actualReach ? `Planned target: ${target}; actual reach: ${activity.actualReach}` : '',
    activity.resourceIssue ? `Resource issue: ${activity.resourceIssue}` : '',
    activity.resourceAction ? `Action: ${activity.resourceAction}` : '',
    activity.carryForward ? `Carry-forward: ${activity.carryForward}` : '',
    activity.nextAction ? `Next action: ${activity.nextAction}` : '',
  ].map((value) => humanizeText(value || '')).filter(Boolean)

  if (detailParts.length === 0) return 'No programme activity details recorded.'
  return withFinalPeriod(detailParts.join(' '))
}

function buildGenericSummary(activity: DailyActivity) {
  const sentenceParts = [activity.outcome, activity.intelligence, activity.nextAction]
    .map((value) => humanizeText(value || ''))
    .filter(Boolean)
  return withFinalPeriod(sentenceParts.join(' ') || 'No details recorded.')
}

function buildActivityNarrative(activity: DailyActivity, template: WeekFlowTemplate, plan?: WeeklyPlan) {
  const title = makeTitleFromActivity(activity, template)
  if (template.id === 'personal') {
    const summary = buildPersonalSummary(activity)
    const followUp = inflateValue(activity.nextAction || '')
    return {
      title,
      summary,
      detail: followUp ? `Follow-up: ${withFinalPeriod(followUp)}` : undefined,
    }
  }

  if (template.id === 'field-sales') {
    return {
      title,
      summary: buildFieldSalesSummary(activity),
      detail: activity.nextAction ? `Next Action: ${withFinalPeriod(activity.nextAction)}` : undefined,
    }
  }

  if (template.id === 'ngo-community') {
    return {
      title,
      summary: buildNgoCommunitySummary(activity, plan),
      detail: activity.nextAction ? `Next Action: ${withFinalPeriod(activity.nextAction)}` : undefined,
    }
  }

  return {
    title,
    summary: buildGenericSummary(activity),
    detail: activity.nextAction ? `Next Action: ${withFinalPeriod(activity.nextAction)}` : undefined,
  }
}

function ngoPlannedActivity(activity: DailyActivity, plan: WeeklyPlan) {
  return plan.programmeActivities?.find((item) => item.id === activity.plannedActivityId?.replace(/^programme:/, ''))
    ?? plan.programmeActivities?.find((item) => item.activity.trim().toLowerCase() === activity.account.trim().toLowerCase())
}

function ngoEvidenceItem(title: string, summary: string, detail?: string): NarrativeItem {
  return { title, summary: withFinalPeriod(summary), ...(detail ? { detail: withFinalPeriod(detail) } : {}) }
}

function getNgoPlannedTargetForActivity(activity: DailyActivity, plan: WeeklyPlan) {
  const planned = ngoPlannedActivity(activity, plan)
  return planned?.target?.trim() || ''
}

function summarizeNgoActualActivityEvidence(activity: DailyActivity) {
  const segments = [
    activity.workPerformed,
    activity.actualResults,
    activity.engagementResult,
    activity.volunteerContribution,
    activity.stakeholderResult,
    activity.resourceAction,
    activity.outcome,
  ].filter(Boolean)
  return withFinalPeriod(segments.map((segment) => humanizeText(segment || '')).filter(Boolean).join(' ') || 'No actual delivery evidence was recorded.')
}

function buildNgoMonitoringLearningItems(snapshot: { activities: DailyActivity[]; followUps: FollowUp[]; plan: WeeklyPlan; weekKey: string; template?: WeekFlowTemplate }): NarrativeItem[] {
  const activities = snapshot.activities
  const actualActivities = activities.filter((activity) => activity.workPerformed?.trim() || activity.actualResults?.trim() || activity.dailySummary?.trim())
  const actualReachItems = activities.filter((activity) => activity.actualReach?.trim())
  const plannedTarget = snapshot.plan.programmeActivities?.find((item) => item.target?.trim())?.target?.trim() ?? ''
  const intendedOutcome = snapshot.plan.weeklyStrategicObjectives?.map((item) => item.text.trim()).filter(Boolean)[0] ?? 'No intended outcome was recorded.'
  const targetComparison = plannedTarget && actualReachItems.length > 0
    ? `Planned target: ${plannedTarget}; actual reach: ${actualReachItems[0].actualReach}.`
    : plannedTarget
      ? `Planned target: ${plannedTarget}; actual reach was not recorded.`
      : actualReachItems.length > 0
        ? `Actual reach recorded: ${actualReachItems[0].actualReach}.`
        : 'Planned target and actual reach were not recorded.'

  const activityOutcomeEvidence = actualActivities
    .filter((activity) => activity.outcome?.trim() || activity.engagementResult?.trim() || activity.actualResults?.trim())
    .slice(0, 3)
    .map((activity) => `${activity.account || 'Community activity'}: ${[activity.outcome, activity.engagementResult, activity.actualResults].filter(Boolean).join(' ')}`)

  const feedbackEvidence = activities
    .filter((activity) => /feedback|comment|response|concern|suggestion/i.test([activity.intelligence, activity.outcome, activity.engagementResult].filter(Boolean).join(' ')))
    .slice(0, 3)
    .map((activity) => `${activity.account || 'Community activity'}: ${[activity.engagementResult, activity.intelligence].filter(Boolean).join(' ')}`)

  const learningEvidence = activities
    .filter((activity) => /learning|lesson|improvement|adapted|adjusted|insight|lessons learned/i.test([activity.intelligence, activity.dailySummary, activity.carryForward].filter(Boolean).join(' ')))
    .slice(0, 3)
    .map((activity) => `${activity.account || 'Community activity'}: ${[activity.intelligence, activity.carryForward].filter(Boolean).join(' ')}`)

  const items: NarrativeItem[] = []

  if (actualActivities.length > 0) {
    const first = actualActivities[0]
    items.push({ title: 'Output evidence', summary: withFinalPeriod(`${first.account || 'Community activity'}: ${summarizeNgoActualActivityEvidence(first)}`) })
  } else {
    items.push({ title: 'Output evidence', summary: 'No actual programme delivery evidence was recorded for this week.' })
  }

  items.push({ title: 'Planned target vs actual reach', summary: withFinalPeriod(targetComparison) })
  items.push({ title: 'Intended outcome', summary: withFinalPeriod(intendedOutcome) })

  if (activityOutcomeEvidence.length > 0) {
    items.push({ title: 'Outcome evidence', summary: withFinalPeriod(activityOutcomeEvidence.join(' ')) })
  } else {
    items.push({ title: 'Outcome evidence', summary: 'Outcome evidence remains pending.' })
  }

  if (feedbackEvidence.length > 0) {
    items.push({ title: 'Community feedback', summary: withFinalPeriod(feedbackEvidence.join(' ')) })
  } else {
    items.push({ title: 'Community feedback', summary: 'No community feedback evidence was recorded this week.' })
  }

  if (learningEvidence.length > 0) {
    items.push({ title: 'Programme learning', summary: withFinalPeriod(learningEvidence.join(' ')) })
  } else {
    items.push({ title: 'Programme learning', summary: 'No implementation learning was recorded this week.' })
  }

  return items
}

function buildNgoOverallAssessmentItem(snapshot: { activities: DailyActivity[]; followUps: FollowUp[]; plan: WeeklyPlan; weekKey: string; template?: WeekFlowTemplate }): NarrativeItem {
  const activities = snapshot.activities
  const actualActivities = activities.filter((activity) => activity.workPerformed?.trim() || activity.actualResults?.trim() || activity.dailySummary?.trim())
  const actualReachItems = activities.filter((activity) => activity.actualReach?.trim())
  const plannedTargets = snapshot.plan.programmeActivities?.filter((item) => item.target?.trim()) ?? []
  const openFollowUps = snapshot.followUps.filter((followUp) => followUp.status === 'open')
  const unresolvedRiskSignals = deriveWeeklyIntelligence({ selectedWeek: snapshot.weekKey, plan: snapshot.plan, activities, followUps: snapshot.followUps, template: snapshot.template }).insights.risks
  const parseNgoNumber = (value: string) => Number.parseFloat(value.replace(/[^0-9.]/g, '') || '0')
  const actualReachTotal = actualReachItems.reduce((sum, activity) => {
    const value = parseNgoNumber(activity.actualReach ?? '')
    return Number.isFinite(value) ? sum + value : sum
  }, 0)
  const plannedTargetTotal = plannedTargets.reduce((sum, item) => {
    const value = parseNgoNumber(item.target ?? '')
    return Number.isFinite(value) ? sum + value : sum
  }, 0)
  const hasComparableTargetEvidence = plannedTargetTotal > 0 && actualReachItems.length === actualActivities.length && actualReachTotal > 0
  const belowTarget = hasComparableTargetEvidence && actualReachTotal < plannedTargetTotal
  const targetAssessment = plannedTargets.length > 0
    ? actualReachItems.length === 0
      ? 'Planned target was recorded, but actual reach was not captured, so target achievement cannot be confirmed.'
      : hasComparableTargetEvidence
        ? `Planned target: ${plannedTargetTotal}; actual reach: ${actualReachTotal}. ${belowTarget ? 'Delivery was below the planned target based on the evidence recorded.' : 'The recorded reach met or exceeded the planned target.'}`
        : 'Planned target and actual reach evidence were not complete enough to confirm target achievement.'
    : ''
  const evidenceGaps = actualActivities.flatMap((activity) => {
    const hasVolunteerEvidence = Boolean(activity.volunteer?.trim() || activity.volunteerRole?.trim() || activity.volunteerParticipation?.trim() || activity.volunteerContribution?.trim())
    const hasStakeholderEvidence = Boolean(activity.stakeholder?.trim() || activity.stakeholderPurpose?.trim() || activity.stakeholderEngagement?.trim() || activity.stakeholderResult?.trim() || activity.stakeholderNextStep?.trim())
    const hasResourceEvidence = Boolean(activity.resource?.trim() || activity.resourceActual?.trim() || activity.resourceIssue?.trim() || activity.resourceAction?.trim())
    const hasOutcomeEvidence = Boolean(activity.outcome?.trim() || activity.engagementResult?.trim() || activity.structuredOutcomes.some((outcome) => outcome.details?.trim()))
    const gaps: string[] = []
    if (!activity.actualResults?.trim()) gaps.push('actual results')
    if (!activity.actualReach?.trim()) gaps.push('beneficiary reach')
    if (!activity.engagementResult?.trim()) gaps.push('engagement evidence')
    if (!hasVolunteerEvidence) gaps.push('volunteer evidence')
    if (!hasStakeholderEvidence) gaps.push('stakeholder evidence')
    if (!hasResourceEvidence) gaps.push('resource evidence')
    if (!hasOutcomeEvidence) gaps.push('outcome evidence')
    if (activity.carryForward?.trim() || /incomplete|pending|partially|not completed/i.test(activity.progressStatus ?? '')) gaps.push('completion status')
    return gaps
  })
  const hasIntendedOutcome = snapshot.plan.weeklyStrategicObjectives?.some((item) => item.text.trim()) ?? false
  const hasOutcomeEvidence = actualActivities.some((activity) => Boolean(activity.outcome?.trim() || activity.engagementResult?.trim() || activity.structuredOutcomes.some((outcome) => outcome.details?.trim())))
  const evidenceIncomplete = evidenceGaps.length > 0 || (hasIntendedOutcome && !hasOutcomeEvidence)

  let status = 'Insufficient evidence'
  let summary = 'No programme activities were recorded for this reporting week, so programme progress cannot yet be assessed from actual activity evidence.'

  if (actualActivities.length > 0) {
    if (evidenceIncomplete) {
      status = 'Insufficient evidence'
      summary = 'Programme activity was recorded during the week, but the available evidence is incomplete. Overall programme progress cannot yet be fully confirmed.'
      if (targetAssessment) summary += ` ${targetAssessment}`
      if (hasIntendedOutcome && !hasOutcomeEvidence) summary += ' Intended outcomes remain unverified because outcome evidence was not recorded.'
    } else if (unresolvedRiskSignals.length > 0 || openFollowUps.length > 0 || belowTarget) {
      status = 'Attention required'
      summary = 'Programme activity was recorded, but unresolved delivery issues, below-target participation, or evidence gaps materially affect the week.'
    } else {
      status = 'Progress evidenced'
      summary = 'Programme activities were delivered during the week with supporting evidence recorded. Progress is evident across the activities captured.'
    }
  }

  return { title: 'Overall assessment', summary: `${status}. ${summary}` }
}

function buildNgoChallengeItems(snapshot: { activities: DailyActivity[]; followUps: FollowUp[]; plan: WeeklyPlan; weekKey: string; template?: WeekFlowTemplate }): NarrativeItem[] {
  const intelligence = deriveWeeklyIntelligence({ selectedWeek: snapshot.weekKey, plan: snapshot.plan, activities: snapshot.activities, followUps: snapshot.followUps, template: snapshot.template })
  const items = intelligence.insights.risks
    .filter((signal) => /issue|risk|below target|pending|carried forward|gap|resource|dependency|documentation/i.test(signal.title))
    .map((signal) => ngoEvidenceItem(signal.title, signal.detail || 'Evidence indicates a delivery or documentation issue requires review.'))

  const resourceIssues = snapshot.activities.filter((activity) => activity.resourceIssue?.trim())
  if (resourceIssues.length > 0) {
    items.push(...resourceIssues.slice(0, 2).map((activity) => ngoEvidenceItem('Resource issue', `${activity.resourceIssue}. ${activity.resourceAction ? `Action taken: ${activity.resourceAction}.` : 'No corrective action was recorded.'}`)))
  }

  if (items.length === 0) {
    return [ngoEvidenceItem('No formal challenge identified', 'No evidence-backed challenge requiring formal escalation was identified this week.')]
  }

  return items.slice(0, 4)
}

function buildNgoDocumentationItems(snapshot: { activities: DailyActivity[]; followUps: FollowUp[]; plan: WeeklyPlan; weekKey: string; template?: WeekFlowTemplate }): NarrativeItem[] {
  const intelligence = deriveWeeklyIntelligence({ selectedWeek: snapshot.weekKey, plan: snapshot.plan, activities: snapshot.activities, followUps: snapshot.followUps, template: snapshot.template })
  const evidenceSignals = intelligence.insights.risks.filter((signal) => /evidence|documentation|gap|pending/i.test(signal.title))
  const documentedEvidence = snapshot.activities.filter((activity) => activity.actualResults?.trim() || activity.engagementResult?.trim() || activity.actualReach?.trim())

  if (evidenceSignals.length > 0) {
    return evidenceSignals.slice(0, 3).map((signal) => ngoEvidenceItem(signal.title, signal.detail || 'Evidence is incomplete for this area.'))
  }

  if (documentedEvidence.length > 0) {
    return [ngoEvidenceItem('Documentation recorded', 'Activity, reach, and outcome evidence was recorded for this reporting week.')]
  }

  return [ngoEvidenceItem('Documentation status', 'No documentation evidence was recorded for this week.')]
}

function buildNgoFollowUpSectionItems(snapshot: { activities: DailyActivity[]; followUps: FollowUp[]; plan: WeeklyPlan; weekKey: string; template?: WeekFlowTemplate }): NarrativeItem[] {
  const actualOpen = snapshot.followUps.filter((followUp) => followUp.status === 'open')
  const actualCompleted = snapshot.followUps.filter((followUp) => followUp.status === 'completed')

  const items: NarrativeItem[] = []

  actualOpen.forEach((followUp) => {
    const details = [followUp.facility, followUp.hcpName, followUp.dueDate ? `Due ${formatDateLabel(followUp.dueDate)}` : '', followUp.priority ? `Priority: ${followUp.priority}` : ''].filter(Boolean)
    items.push({
      title: followUp.task || 'Open follow-up',
      summary: details.length > 0 ? details.join(' • ') : 'Open follow-up record.',
      detail: followUp.notes ? withFinalPeriod(humanizeText(followUp.notes)) : undefined,
    })
  })

  if (items.length === 0 && actualCompleted.length > 0) {
    return actualCompleted.slice(0, 3).map((followUp) => ({ title: followUp.task || 'Completed follow-up', summary: followUp.notes ? withFinalPeriod(humanizeText(followUp.notes)) : 'Completed follow-up record.' }))
  }

  return items.length > 0 ? items : [{ title: 'No actual follow-up records', summary: 'No actual follow-up records were recorded for this reporting week.' }]
}

function buildNgoPriorityItems(snapshot: { activities: DailyActivity[]; followUps: FollowUp[]; plan: WeeklyPlan; weekKey: string; template?: WeekFlowTemplate }): NarrativeItem[] {
  const items: NarrativeItem[] = []
  const carryForward = snapshot.activities.filter((activity) => activity.carryForward?.trim())
  const unresolved = snapshot.followUps.filter((followUp) => followUp.status === 'open')
  const nextActions = snapshot.activities.filter((activity) => activity.nextAction?.trim())

  carryForward.slice(0, 3).forEach((activity) => {
    items.push({ title: 'Carry-forward work', summary: withFinalPeriod(activity.carryForward || 'Carry-forward item'), detail: activity.account ? titleCasePhrase(cleanLabel(activity.account)) : undefined })
  })

  unresolved.slice(0, 3).forEach((followUp) => {
    items.push({ title: 'Open follow-up', summary: withFinalPeriod(followUp.task || 'Follow-up item'), detail: followUp.dueDate ? `Due ${formatDateLabel(followUp.dueDate)}` : undefined })
  })

  nextActions.slice(0, 3).forEach((activity) => {
    items.push({ title: 'Next action', summary: withFinalPeriod(activity.nextAction || 'Next action'), detail: activity.account ? titleCasePhrase(cleanLabel(activity.account)) : undefined })
  })

  return items.length > 0 ? items.slice(0, 6) : [{ title: 'No next-week priorities', summary: 'No explicit priorities or carry-forward work were recorded for next week.' }]
}

function buildNgoReportItems(sectionId: string, snapshot: { activities: DailyActivity[]; followUps: FollowUp[]; plan: WeeklyPlan; weekKey: string; template?: WeekFlowTemplate }): NarrativeItem[] {
  const activities = snapshot.activities
  const intelligence = deriveWeeklyIntelligence({ selectedWeek: snapshot.weekKey, plan: snapshot.plan, activities, followUps: snapshot.followUps, template: snapshot.template })
  const actualActivities = activities.filter((activity) => activity.workPerformed?.trim() || activity.actualResults?.trim() || activity.dailySummary?.trim())
  const actualReachItems = activities.filter((activity) => activity.actualReach?.trim())
  const openFollowUps = snapshot.followUps.filter((followUp) => followUp.status === 'open')

  if (sectionId === 'executive-summary') {
    const focus = snapshot.plan.weeklyStrategicObjectives?.map((item) => item.text.trim()).filter(Boolean).slice(0, 2).join('; ')
    const reach = actualReachItems.map((activity) => activity.actualReach).filter(Boolean).join(', ')
    const summary = actualActivities.length > 0
      ? `${actualActivities.length} actual programme activit${actualActivities.length === 1 ? 'y was' : 'ies were'} recorded${reach ? `, with recorded reach of ${reach}` : ''}.`
      : 'No actual programme activities were recorded for this reporting week.'
    const items: NarrativeItem[] = [ngoEvidenceItem('Programme focus', focus || 'No explicit programme focus was recorded.', focus ? undefined : 'No explicit programme focus was recorded.'), ngoEvidenceItem('Delivery summary', summary)]
    if (intelligence.insights.risks.length > 0) items.push(ngoEvidenceItem('Key issues', `${intelligence.insights.risks.length} evidence-backed issue${intelligence.insights.risks.length === 1 ? '' : 's'} or gap${intelligence.insights.risks.length === 1 ? '' : 's'} require attention.`))
    if (openFollowUps.length > 0) items.push(ngoEvidenceItem('Open follow-up', `${openFollowUps.length} follow-up${openFollowUps.length === 1 ? '' : 's'} remain active.`))
    return items
  }

  if (sectionId === 'key-activities-completed') return actualActivities.length > 0 ? actualActivities.map((activity) => {
    const narrative = buildActivityNarrative(activity, snapshot.template ?? FIELD_SALES_TEMPLATE, snapshot.plan)
    return ngoEvidenceItem(narrative.title, narrative.summary)
  }) : [ngoEvidenceItem('No actual programme activities', 'No actual programme activities have been recorded for this reporting week.')]

  if (sectionId === 'daily-activity-breakdown') return actualActivities.length > 0 ? actualActivities.map((activity) => {
    const narrative = buildActivityNarrative(activity, snapshot.template ?? FIELD_SALES_TEMPLATE, snapshot.plan)
    return ngoEvidenceItem(`${formatDateLabel(activity.date)} · ${narrative.title}`, narrative.summary)
  }) : [ngoEvidenceItem('No actual programme activities', 'No actual programme activities have been recorded for this reporting week.')]

  if (sectionId === 'programme-progress') {
    const planned = snapshot.plan.programmeActivities ?? []
    const items = planned.map((item) => {
      const matching = activities.filter((candidate) => ngoPlannedActivity(candidate, snapshot.plan)?.id === item.id)
      const evidence = matching.find((candidate) => candidate.workPerformed?.trim() || candidate.actualResults?.trim() || candidate.dailySummary?.trim())
      if (!evidence) return ngoEvidenceItem(item.activity, `Planned activity was recorded, but no actual Daily Activity evidence was captured.`)
      const actualReach = evidence.actualReach?.trim()
      const target = item.target?.trim()
      if (target && actualReach) return ngoEvidenceItem(item.activity, `Planned target: ${target}; actual reach: ${actualReach}.`)
      if (target) return ngoEvidenceItem(item.activity, `Planned target: ${target}; actual delivery evidence was recorded, but actual reach was not captured.`)
      return ngoEvidenceItem(item.activity, `Actual activity evidence was recorded for this planned programme item.`)
    })
    return items.length > 0 ? items : [ngoEvidenceItem('No planned programme activities', 'No planned programme activities were recorded for this reporting week.')]
  }

  if (sectionId === 'community-engagement') return activities.filter((activity) => activity.communityGroup || activity.engagementActivity || activity.engagementResult).map((activity) => {
    const group = activity.communityGroup || activity.account
    const summaryParts = [
      activity.engagementActivity ? `Engagement activity: ${activity.engagementActivity}.` : '',
      activity.communityGroup ? `Community group: ${activity.communityGroup}.` : '',
      activity.engagementResult ? `Result: ${activity.engagementResult}.` : '',
      activity.actualReach ? `Actual reach: ${activity.actualReach}.` : '',
    ].filter(Boolean)
    return ngoEvidenceItem(group || 'Community engagement', summaryParts.join(' '))
  })

  if (sectionId === 'beneficiary-reach') return actualReachItems.map((activity) => {
    const target = getNgoPlannedTargetForActivity(activity, snapshot.plan)
    const summary = target ? `Planned target: ${target}; actual reach: ${activity.actualReach}.` : `Actual reach recorded: ${activity.actualReach}.`
    return ngoEvidenceItem(activity.account || 'Community activity', summary)
  })

  if (sectionId === 'volunteer-coordination') return activities.filter((activity) => activity.volunteer || activity.volunteerParticipation || activity.volunteerContribution).map((activity) => ngoEvidenceItem(activity.volunteer || activity.account, [activity.volunteerRole ? `Role: ${activity.volunteerRole}.` : '', activity.volunteerParticipation ? `Participation: ${activity.volunteerParticipation}.` : '', activity.volunteerContribution ? `Contribution: ${activity.volunteerContribution}` : ''].filter(Boolean).join(' ')))
  if (sectionId === 'stakeholder-partnerships') return activities.filter((activity) => activity.stakeholder || activity.stakeholderEngagement || activity.stakeholderResult || activity.stakeholderNextStep).map((activity) => ngoEvidenceItem(activity.stakeholder || activity.account, [activity.stakeholderEngagement ? `Engagement: ${activity.stakeholderEngagement}.` : '', activity.stakeholderResult ? `Result: ${activity.stakeholderResult}` : '', activity.stakeholderNextStep ? `Next step: ${activity.stakeholderNextStep}` : ''].filter(Boolean).join(' ')))
  if (sectionId === 'resources-logistics') return activities.filter((activity) => activity.resource || activity.resourceActual || activity.resourceIssue || activity.resourceAction).map((activity) => ngoEvidenceItem(activity.resource || activity.account, [activity.resourceActual ? `Actual / available: ${activity.resourceActual}.` : '', activity.resourceIssue ? `Gap: ${activity.resourceIssue}.` : '', activity.resourceAction ? `Action: ${activity.resourceAction}.` : ''].filter(Boolean).join(' ')))
  if (sectionId === 'challenges') return buildNgoChallengeItems(snapshot)
  if (sectionId === 'ngo-follow-ups') return buildNgoFollowUpSectionItems(snapshot)
  if (sectionId === 'documentation') return buildNgoDocumentationItems(snapshot)
  if (sectionId === 'monitoring-learning') return buildNgoMonitoringLearningItems(snapshot)
  if (sectionId === 'ngo-priorities-next-week') return buildNgoPriorityItems(snapshot)
  if (sectionId === 'ngo-overall-assessment') return [buildNgoOverallAssessmentItem(snapshot)]
  return []
}

function buildFollowUpNarrative(followUp: FollowUp, template: WeekFlowTemplate) {
  const task = cleanLabel(followUp.task || 'Follow-up')
  const title = template.id === 'personal' ? (task.toLowerCase().includes('collect') ? 'Follow-up' : 'Follow-up') : titleCasePhrase(task)
  const details: string[] = []
  if (followUp.facility) details.push(titleCasePhrase(cleanLabel(followUp.facility)))
  if (followUp.hcpName) details.push(formatPersonName(followUp.hcpName))
  if (followUp.dueDate) details.push(`Due ${formatDateLabel(followUp.dueDate)}`)
  const notes = inflateValue(followUp.notes || '')
  const summary = notes || (details.length > 0 ? `Follow up with ${details.join(' · ')}.` : 'Follow up on this item.')

  return {
    title,
    summary: withFinalPeriod(summary),
    detail: followUp.status === 'open' ? 'Open follow-up' : 'Completed follow-up',
  }
}

function buildStructuredOutcomeNarrative(outcome: StructuredOutcome, activity: DailyActivity) {
  const label = cleanLabel(outcome.type || 'Outcome')
  const account = cleanLabel(activity.account || '')
  const detailParts = [outcome.product, outcome.quantity ? `Quantity: ${outcome.quantity}` : '', outcome.stockStatus, outcome.details].filter(Boolean)
  const summary = detailParts.length > 0 ? detailParts.join(' • ') : 'No outcome detail was recorded.'
  return {
    title: `${account ? `${titleCasePhrase(account)} — ` : ''}${label}`,
    summary: withFinalPeriod(summary),
  }
}

function buildSummaryText(snapshot: { activities: DailyActivity[]; followUps: FollowUp[]; template?: WeekFlowTemplate }, template: WeekFlowTemplate) {
  const activities = snapshot.activities
  const followUps = snapshot.followUps.filter((followUp) => followUp.status === 'open')
  if (activities.length === 0) return 'No activities were recorded during the reporting week.'

  if (template.id === 'personal') {
    const meaningful = activities.filter((activity) => {
      const actualResults = normalizeWhitespace(activity.actualResults || '')
      return Boolean(actualResults) && !/^((complete|completed|done|finished)(\s+(the\s+)?(task|activity|work|workday|goal))?)$/i.test(actualResults)
    }).length
    const openFollowUps = followUps.length
    return `The week included ${activities.length} recorded activity item${activities.length === 1 ? '' : 's'} with ${meaningful} meaningful accomplishment${meaningful === 1 ? '' : 's'} recorded. ${openFollowUps > 0 ? `${openFollowUps} open follow-up${openFollowUps === 1 ? '' : 's'} remain for the coming week.` : 'No open follow-ups were recorded.'}`
  }

  if (template.id === 'field-sales') {
    const accounts = [...new Set(activities.map((activity) => cleanLabel(activity.account)).filter(Boolean))]
    return `The week included ${activities.length} recorded field activity${activities.length === 1 ? '' : 'ies'} across ${accounts.length || 1} account${accounts.length === 1 ? '' : 's'}.`
  }

  if (template.id === 'project-management') {
    const performance = (snapshot as { performance?: ProjectPerformance }).performance
    if (performance) return performance.summary
    const workstreams = [...new Set(activities.map((activity) => cleanLabel(activity.account)).filter(Boolean))]
    return workstreams.length > 0 ? `The week included ${activities.length} activity record${activities.length === 1 ? '' : 's'} across ${workstreams.length} workstream${workstreams.length === 1 ? '' : 's'}.` : 'The week included project activity recorded during the reporting week.'
  }

  if (followUps.length > 0) {
    return `The week included ${activities.length} recorded activity items and ${followUps.length} open follow-up${followUps.length === 1 ? '' : 's'} for the coming week.`
  }

  return `The week included ${activities.length} recorded activity items.`
}

function formatHours(value: number | null) {
  if (value === null) return ''
  return Number.isInteger(value) ? String(value) : value.toFixed(1)
}

function buildPerformanceNarrativeItems(performance: ProjectPerformance, sectionId: string): NarrativeItem[] {
  if (sectionId === 'project-workstream-progress') {
    const summary: NarrativeItem[] = [{ title: 'Overall performance', summary: performance.overallStatus, detail: performance.summary }]
    if (performance.plannedTasks > 0) summary.push({ title: 'Task performance', summary: `${performance.completedTasks} of ${performance.plannedTasks} planned tasks have explicit completion evidence${performance.completionRate === null ? '' : ` (${performance.completionRate.toFixed(1)}%)`}.` })
    if (performance.plannedHours !== null && performance.actualHours !== null) summary.push({ title: 'Time performance', summary: `Recorded effort was ${formatHours(performance.actualHours)} hours against ${formatHours(performance.plannedHours)} planned, representing a ${Math.abs(performance.timeVariance ?? 0)}-hour ${performance.timeVariance && performance.timeVariance > 0 ? 'unfavourable' : 'favourable'} variance.` })
    return performance.objectives.length > 0
      ? [...summary, ...performance.objectives.map((objective) => ({ title: objective.title, summary: titleCasePhrase(objective.status.replace(/-/g, ' ')), detail: objective.evidence ? withFinalPeriod(objective.evidence) : undefined }))]
      : [{ title: 'No objectives recorded', summary: 'No project objectives were recorded for the reporting week.' }]
  }
  if (sectionId === 'key-deliverables') {
    const completed = performance.objectives.filter((objective) => objective.status === 'completed')
    return completed.length > 0 ? completed.map((objective) => ({ title: objective.title, summary: 'Completed with explicit activity evidence.' })) : [{ title: 'No completed deliverables', summary: 'No completed deliverables were recorded for the reporting week.' }]
  }
  if (sectionId === 'risks-blockers-decisions') {
    const items: NarrativeItem[] = []
    if (performance.issuesIdentified > 0) items.push({ title: 'Issues', summary: `${performance.issuesIdentified} issue${performance.issuesIdentified === 1 ? '' : 's'} identified; ${performance.issuesOpen} remain open.` })
    if (performance.activeRisks > 0) items.push({ title: 'Risks', summary: `${performance.activeRisks} active risk${performance.activeRisks === 1 ? '' : 's'} remain visible.` })
    if (performance.activeDependencies > 0) items.push({ title: 'Dependencies', summary: `${performance.activeDependencies} active dependenc${performance.activeDependencies === 1 ? 'y' : 'ies'} remain visible.` })
    if (performance.blockedWork > 0) items.push({ title: 'Blocked work', summary: `${performance.blockedWork} item${performance.blockedWork === 1 ? '' : 's'} remain blocked.` })
    return items.length > 0 ? items : [{ title: 'No active issues or risks', summary: 'No active issues, risks, dependencies, or blocked work were recorded.' }]
  }
  return []
}

function sectionItemsForSection(sectionId: string, snapshot: { weekKey: string; activities: DailyActivity[]; followUps: FollowUp[]; plan: WeeklyPlan; performance?: ProjectPerformance; template?: WeekFlowTemplate }, template: WeekFlowTemplate): NarrativeItem[] {
  const activities = snapshot.activities

  if (template.id === 'project-management' && snapshot.performance && ['project-workstream-progress', 'key-deliverables', 'risks-blockers-decisions'].includes(sectionId)) return buildPerformanceNarrativeItems(snapshot.performance, sectionId)

  if (template.id === 'ngo-community') return buildNgoReportItems(sectionId, snapshot)

  if (template.id === 'personal') {
    const personalMeaningfulActivities = activities.filter((activity) => {
      const actualResults = normalizeWhitespace(activity.actualResults || '')
      return Boolean(actualResults) && !/^((complete|completed|done|finished)(\s+(the\s+)?(task|activity|work|workday|goal))?)$/i.test(actualResults)
    })

    switch (sectionId) {
      case 'weekly-summary': {
        const items: NarrativeItem[] = []
        const focusItems = snapshot.plan.weeklyStrategicObjectives.map((item) => cleanLabel(item.text || '')).filter(Boolean)
        const bigThreeItems = snapshot.plan.commercialPriorities.map((item) => cleanLabel(item.text || '')).filter(Boolean)
        const taskItems = snapshot.plan.virtualEngagementPlan.map((item) => cleanLabel(item.objective || item.coverage || '')).filter(Boolean)
        if (focusItems.length > 0) items.push({ title: 'Weekly Focus', summary: focusItems.slice(0, 3).join('; ') })
        if (bigThreeItems.length > 0) items.push({ title: 'Big Three', summary: bigThreeItems.slice(0, 3).join('; ') })
        if (taskItems.length > 0) items.push({ title: 'Weekly Tasks', summary: taskItems.slice(0, 3).join('; ') })
        if (personalMeaningfulActivities.length > 0) items.push({
          title: 'Meaningful activity completed',
          summary: personalMeaningfulActivities.slice(0, 3).map((activity) => {
            const workPerformed = humanizeText(activity.workPerformed || '')
            const actualResults = humanizeText(activity.actualResults || '')
            const parts = [workPerformed || titleCasePhrase(cleanLabel(activity.account || activity.activityType || 'Activity')), actualResults].filter(Boolean)
            return withFinalPeriod(parts.join('. '))
          }).join(' '),
        })
        const openFollowUps = snapshot.followUps.filter((followUp) => followUp.status === 'open')
        if (openFollowUps.length > 0) items.push({ title: 'Relevant follow-ups', summary: openFollowUps.slice(0, 3).map((followUp) => followUp.task).join('; ') })
        return items.length > 0 ? items : [{ title: 'No personal work captured yet', summary: 'No weekly focus, activity, or follow-up details were recorded for this reporting week.' }]
      }
      case 'key-accomplishments': {
        const items = personalMeaningfulActivities.slice(0, 6).map((activity) => ({
          title: titleCasePhrase(cleanLabel(activity.account || activity.activityType || 'Activity')),
          summary: withFinalPeriod([
            humanizeText(activity.workPerformed || activity.account || activity.activityType || 'Activity'),
            humanizeText(activity.actualResults || ''),
          ].filter(Boolean).join('. ')),
        }))
        return items.length > 0 ? items : [{ title: 'No meaningful accomplishments', summary: 'No meaningful completed activity was recorded this week.' }]
      }
      case 'progress-against-goals': {
        const items: NarrativeItem[] = []
        const goalItems = snapshot.plan.weeklyStrategicObjectives.map((item) => item.text).filter(Boolean)
        const priorityItems = snapshot.plan.commercialPriorities.map((item) => item.text).filter(Boolean)
        const taskItems = snapshot.plan.virtualEngagementPlan.map((item) => item.objective || item.coverage).filter(Boolean)

        const planItems = [...goalItems, ...priorityItems, ...taskItems].map((item) => cleanLabel(item)).filter(Boolean)
        planItems.forEach((item) => {
          const matched = activities.some((activity) => {
            const haystack = [activity.workPerformed, activity.actualResults, activity.dailySummary, activity.carryForward, activity.intelligence, activity.nextAction, activity.outcome, activity.progressStatus, activity.blockerRisk, activity.decision, ...activity.structuredOutcomes.map((outcome) => `${outcome.type} ${outcome.details}`)].filter(Boolean).join(' ').toLowerCase()
            return haystack.includes(item.toLowerCase())
          })
          items.push({
            title: item,
            summary: matched
              ? 'Progress was recorded against this focus area this week.'
              : 'Progress was recorded against this focus area, with further work remaining.',
          })
        })

        return items.length > 0 ? items : [{ title: 'No goals recorded', summary: 'No weekly focus, tasks, or priorities were recorded for this week.' }]
      }
      case 'productivity-time-performance': {
        const items: NarrativeItem[] = []
        const totalHours = activities.reduce((sum, activity) => sum + parseTimeSpentHours(activity.timeSpent), 0)
        if (totalHours > 0) {
          items.push({ title: 'Total recorded time', summary: `${Math.round(totalHours)} hour${Math.round(totalHours) === 1 ? '' : 's'} of activity time were recorded this week.` })
          activities.filter((activity) => activity.timeSpent && parseTimeSpentHours(activity.timeSpent) > 0).forEach((activity) => {
            items.push({ title: cleanLabel(activity.account || activity.activityType || 'Activity'), summary: `${activity.timeSpent} recorded for this activity.` })
          })
        } else {
          items.push({ title: 'Time tracking', summary: 'Time tracking was recorded for selected activities during the week.' })
        }
        return items
      }
      case 'outstanding-items': {
        const items: NarrativeItem[] = []
        const openFollowUps = snapshot.followUps.filter((followUp) => followUp.status === 'open')
        openFollowUps.forEach((followUp) => {
          const details = [
            followUp.facility ? titleCasePhrase(cleanLabel(followUp.facility)) : '',
            followUp.hcpName ? formatPersonName(followUp.hcpName) : '',
            followUp.dueDate ? `Due ${formatDateLabel(followUp.dueDate)}` : '',
            followUp.priority ? `Priority: ${titleCasePhrase(followUp.priority)}` : '',
          ].filter(Boolean)
          items.push({ title: followUp.task || 'Open follow-up', summary: details.length > 0 ? `${details.join(' • ')}` : 'Open follow-up', detail: followUp.notes ? withFinalPeriod(humanizeText(followUp.notes)) : undefined })
        })
        activities.filter((activity) => activity.carryForward && activity.carryForward.trim()).forEach((activity) => {
          items.push({ title: `Carry-forward work — ${cleanLabel(activity.account || activity.activityType || 'Activity')}`, summary: withFinalPeriod(activity.carryForward || ''), detail: activity.nextAction ? `Next step: ${withFinalPeriod(activity.nextAction)}` : undefined })
        })
        return items.length > 0 ? items : [{ title: 'No outstanding items', summary: 'No open follow-ups, carry-forward items, or unresolved next steps were recorded.' }]
      }
      case 'lessons-learned': {
        const items: NarrativeItem[] = []
        activities.forEach((activity) => {
          const intelligence = normalizeWhitespace(activity.intelligence || '')
          if (intelligence) items.push({ title: titleCasePhrase(cleanLabel(activity.account || activity.activityType || 'Activity')), summary: withFinalPeriod(humanizeText(intelligence)) })
        })
        if (items.length === 0) {
          const carryForwardItems = activities.filter((activity) => activity.carryForward && activity.carryForward.trim())
          if (carryForwardItems.length > 0) {
            carryForwardItems.slice(0, 3).forEach((activity) => {
              items.push({ title: titleCasePhrase(cleanLabel(activity.account || activity.activityType || 'Activity')), summary: withFinalPeriod(humanizeText(activity.carryForward || '')) })
            })
          }
        }
        return items.length > 0 ? items : [{ title: 'No specific lesson was recorded', summary: 'No specific lesson was recorded for this week.' }]
      }
      case 'priorities-for-next-week': {
        const items: NarrativeItem[] = []
        const priorities = snapshot.plan.commercialPriorities.map((item) => item.text).filter(Boolean)
        priorities.forEach((item) => items.push({ title: 'Big Three item', summary: humanizeText(item) }))
        activities.filter((activity) => activity.nextAction && activity.nextAction.trim()).forEach((activity) => {
          items.push({ title: titleCasePhrase(cleanLabel(activity.account || activity.activityType || 'Activity')), summary: withFinalPeriod(humanizeText(activity.nextAction || '')) })
        })
        snapshot.followUps.filter((followUp) => followUp.status === 'open').forEach((followUp) => {
          items.push({ title: 'Open follow-up', summary: humanizeText(followUp.task || 'Follow-up') })
        })
        return items.length > 0 ? items : [{ title: 'No next-week priorities', summary: 'No next-week priorities were recorded.' }]
      }
      case 'overall-assessment': {
        const meaningfulCount = personalMeaningfulActivities.length
        const openFollowUps = snapshot.followUps.filter((followUp) => followUp.status === 'open').length
        const carryForwardCount = activities.filter((activity) => activity.carryForward && activity.carryForward.trim()).length
        return [{
          title: 'Overall assessment',
          summary: `The week included ${meaningfulCount} meaningful accomplishment${meaningfulCount === 1 ? '' : 's'}${openFollowUps > 0 ? `, ${openFollowUps} open follow-up${openFollowUps === 1 ? '' : 's'} remain, and ${carryForwardCount} carry-forward item${carryForwardCount === 1 ? '' : 's'} are still in progress.` : '. No open follow-ups were recorded.'}`,
        }]
      }
      default:
        break
    }
  }

  switch (sectionId) {
    case 'daily-activity-breakdown': {
      const grouped = snapshot.plan.days.map((day) => ({
        day,
        items: activities.filter((activity) => activity.date === day.date),
      }))
      return grouped.flatMap(({ day, items }) => {
        if (items.length === 0) return [{ title: `${day.label}, ${formatDateLabel(day.date)}`, summary: 'No activity recorded.' }]
        return items.map((activity) => {
          const narrative = buildActivityNarrative(activity, template, snapshot.plan)
          return { title: `${day.label}, ${formatDateLabel(day.date)}`, summary: `${narrative.title}: ${narrative.summary}` }
        })
      })
    }
    case 'priorities-coming-week': {
      const openFollowUps = snapshot.followUps.filter((followUp) => followUp.status === 'open')
      return openFollowUps.length > 0 ? openFollowUps.map((followUp) => buildFollowUpNarrative(followUp, template)) : [{ title: 'No open follow-ups', summary: 'No open follow-ups were recorded for the coming week.' }]
    }
    case 'completed-follow-ups': {
      const completedFollowUps = snapshot.followUps.filter((followUp) => followUp.status === 'completed')
      return completedFollowUps.length > 0 ? completedFollowUps.map((followUp) => buildFollowUpNarrative(followUp, template)) : [{ title: 'No completed follow-ups', summary: 'No completed follow-ups were recorded.' }]
    }
    case 'virtual-engagements': {
      const items = activities.filter((activity) => activity.activityType === 'Virtual Engagement')
      return items.length > 0 ? items.map((activity) => buildActivityNarrative(activity, template, snapshot.plan)) : [{ title: 'No virtual engagements', summary: 'No virtual engagements were recorded.' }]
    }
    case 'commercial-patient-journey-outcomes': {
      const mappedOutcomes = activities.flatMap((activity) => activity.structuredOutcomes.map((outcome) => ({ outcome, activity })))
      return mappedOutcomes.length > 0 ? mappedOutcomes.map(({ outcome, activity }) => buildStructuredOutcomeNarrative(outcome, activity)) : [{ title: 'No outcomes', summary: 'No commercial or patient-journey outcomes were recorded.' }]
    }
    case 'strategic-account-intelligence': {
      const items = activities.flatMap((activity) => {
        const narratives = activity.structuredOutcomes.map((outcome) => ({ title: `${titleCasePhrase(cleanLabel(activity.account || 'Account'))} — ${outcome.type}`, summary: withFinalPeriod(outcome.details || 'No further detail was recorded.') }))
        const info = inflateValue(activity.intelligence || '')
        if (info) narratives.push({ title: `${titleCasePhrase(cleanLabel(activity.account || 'Account'))} — Intelligence`, summary: withFinalPeriod(info) })
        return narratives
      })
      return items.length > 0 ? items : [{ title: 'No intelligence', summary: 'No strategic intelligence was recorded.' }]
    }
    default: {
      if (sectionId.includes('summary')) {
        return activities.length > 0 ? activities.slice(0, 6).map((activity) => buildActivityNarrative(activity, template, snapshot.plan)) : [{ title: 'No activities recorded', summary: 'No activities were recorded during the reporting week.' }]
      }
      return activities.length > 0 ? activities.slice(0, 6).map((activity) => buildActivityNarrative(activity, template, snapshot.plan)) : [{ title: 'No activity', summary: 'No activity was recorded during the reporting week.' }]
    }
  }
}

export function buildNarrativeReport(snapshot: {
  weekKey: string
  weekLabel: string
  plan: WeeklyPlan
  activities: DailyActivity[]
  followUps: FollowUp[]
  performance?: ProjectPerformance
  template?: WeekFlowTemplate
}): NarrativeReport {
  const template = snapshot.template ?? FIELD_SALES_TEMPLATE
  const mappedSections = mapReportSections(snapshot as any, getReportSectionDescriptors(template), template)
  const reportSections: NarrativeSection[] = mappedSections.map((section) => ({
    id: section.sectionId,
    title: section.title,
    order: section.order,
    emptyText: section.presentation.emptyState,
    items: sectionItemsForSection(section.sectionId, snapshot, template),
  }))

  return {
    title: template.report.title,
    weekLabel: snapshot.weekLabel || formatWeekRangeLabel(snapshot.weekKey),
    metadata: `${template.name} · ${snapshot.weekLabel || formatWeekRangeLabel(snapshot.weekKey)}`,
    summaryText: buildSummaryText(snapshot, template),
    sections: reportSections,
  }
}
