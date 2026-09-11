import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from '../config/templates.ts'
import type { DailyActivity, StructuredOutcome } from '../types/dailyActivity.ts'
import { classifyIntelligenceText, getStructuredOutcomeIntelligenceCategory, getStructuredOutcomeSignal } from './intelligenceTemplateAdapter.ts'
import type { Evidence, IntelligenceCategory, OpportunitySignal, WeeklyInsight } from './intelligenceTypes.ts'

function evidence(activity: DailyActivity, text: string, outcome?: StructuredOutcome): Evidence {
  return { activityId: activity.id, account: activity.account, text, ...(outcome ? { outcome } : {}) }
}

function titleForOutcome(outcome: StructuredOutcome) {
  return outcome.product ? `${outcome.type}: ${outcome.product}` : outcome.type
}

function normalizeServiceValue(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ')
}

function hasFieldServiceEvidence(activity: DailyActivity): boolean {
  if (activity.structuredOutcomes.some((outcome) => ['Issue Resolved', 'Issue Partially Resolved', 'Issue Unresolved', 'Installation Completed', 'Preventive Maintenance Completed', 'Inspection Completed', 'Customer Sign-off Obtained', 'Parts Required', 'Escalation Required', 'Follow-up Required', 'Equipment Fault Identified'].includes(outcome.type))) {
    return true
  }

  return Boolean(
    activity.workOrderJob?.trim()
    || activity.equipmentAsset?.trim()
    || activity.issueProblem?.trim()
    || activity.resolution?.trim()
    || activity.serviceStatus?.trim()
    || activity.partsMaterialsUsed?.trim()
    || activity.escalation?.trim()
    || activity.slaPriority?.trim()
    || activity.downtime?.trim()
    || activity.customerSignOff?.trim(),
  )
}

function addServiceRepeatSignals(signals: OpportunitySignal[], activities: DailyActivity[]) {
  const byAsset = new Map<string, DailyActivity[]>()
  const byIssue = new Map<string, DailyActivity[]>()

  for (const activity of activities) {
    const asset = (activity.equipmentAsset ?? '').trim()
    const issue = (activity.issueProblem ?? '').trim()
    if (asset) {
      const key = normalizeServiceValue(asset)
      if (key) {
        const existing = byAsset.get(key) ?? []
        existing.push(activity)
        byAsset.set(key, existing)
      }
    }
    if (issue) {
      const key = normalizeServiceValue(issue)
      if (key) {
        const existing = byIssue.get(key) ?? []
        existing.push(activity)
        byIssue.set(key, existing)
      }
    }
  }

  for (const [key, items] of byAsset.entries()) {
    if (items.length > 1) {
      const assets = items.filter((activity) => activity.equipmentAsset && normalizeServiceValue(activity.equipmentAsset) === key)
      if (assets.length > 1) {
        const account = assets[0].account
        const reason = assets.map((activity) => `${activity.account} / ${activity.equipmentAsset}`).join('; ')
        signals.push({
          type: 'commercial-opportunity',
          account,
          title: 'Repeat fault',
          reason,
          strength: 'moderate',
          category: 'risks',
          evidence: assets.map((activity) => evidence(activity, `${activity.equipmentAsset ?? 'Equipment'} repeated service issue`, activity.structuredOutcomes[0] ?? undefined)),
        })
      }
    }
  }

  for (const [key, items] of byIssue.entries()) {
    if (items.length > 1) {
      const issues = items.filter((activity) => activity.issueProblem && normalizeServiceValue(activity.issueProblem) === key)
      if (issues.length > 1) {
        const account = issues[0].account
        const reason = issues.map((activity) => `${activity.account} / ${activity.issueProblem}`).join('; ')
        signals.push({
          type: 'commercial-opportunity',
          account,
          title: 'Recurring equipment problem',
          reason,
          strength: 'moderate',
          category: 'risks',
          evidence: issues.map((activity) => evidence(activity, `${activity.issueProblem ?? 'Issue'} recurred`, activity.structuredOutcomes[0] ?? undefined)),
        })
      }
    }
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

export function deriveWeeklyInsights(activities: DailyActivity[], template: WeekFlowTemplate = FIELD_SALES_TEMPLATE): Record<IntelligenceCategory, WeeklyInsight[]> {
  const result: Record<IntelligenceCategory, WeeklyInsight[]> = {
    commercial: [], patient: [], 'access-market': [], 'strategic-accounts': [], 'scientific-engagement': [], progress: [], risks: [], stakeholders: [], deliverables: [],
  }
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

    if (template.id === 'field-service') {
      if (!hasFieldServiceEvidence(activity)) continue
      const serviceText = `${activity.activityType ?? ''} ${activity.issueProblem ?? ''} ${activity.outcome} ${activity.intelligence} ${activity.resolution ?? ''} ${activity.escalation ?? ''} ${activity.downtime ?? ''} ${activity.partsMaterialsUsed ?? ''} ${activity.slaPriority ?? ''} ${activity.equipmentAsset ?? ''} ${activity.serviceStatus ?? ''} ${activity.customerSignOff ?? ''}`.trim()
      if (serviceText) {
        const lower = serviceText.toLowerCase()
        if (/unresolved issue|still unresolved|issue remains unresolved|not resolved/i.test(lower)) result.risks.push({ category: 'risks', title: 'Unresolved service issue', detail: serviceText, account: activity.account, evidence: [evidence(activity, serviceText)] })
        if (/repeat fault|repeated fault|same fault|recurring issue|recurring equipment/i.test(lower)) result.risks.push({ category: 'risks', title: 'Repeat fault', detail: serviceText, account: activity.account, evidence: [evidence(activity, serviceText)] })
        if (/escalation required|escalation|engineering escalation|urgent escalation/i.test(lower)) result.risks.push({ category: 'risks', title: 'Escalation required', detail: serviceText, account: activity.account, evidence: [evidence(activity, serviceText)] })
        if (/downtime|outage|equipment down|service interruption|\d+\s*(hour|hr|minute|min|day)/i.test(lower)) result.risks.push({ category: 'risks', title: 'Downtime requiring attention', detail: serviceText, account: activity.account, evidence: [evidence(activity, serviceText)] })
        if (/safety concern|unsafe|hazard|risk to safety/i.test(lower)) result.risks.push({ category: 'risks', title: 'Safety concern', detail: serviceText, account: activity.account, evidence: [evidence(activity, serviceText)] })
        if (/preventive maintenance|pm opportunity|routine service|maintenance opportunity/i.test(lower)) result.progress.push({ category: 'progress', title: 'Preventive maintenance opportunity', detail: serviceText, account: activity.account, evidence: [evidence(activity, serviceText)] })
        if (/parts required|parts needed|replacement required|spare parts|parts used|materials used/i.test(lower)) result.deliverables.push({ category: 'deliverables', title: 'Parts required', detail: serviceText, account: activity.account, evidence: [evidence(activity, serviceText)] })
        if (/customer concern|customer complaint|service quality|customer satisfaction|customer sign-off|customer sign off/i.test(lower)) result.stakeholders.push({ category: 'stakeholders', title: 'Customer concern', detail: serviceText, account: activity.account, evidence: [evidence(activity, serviceText)] })
        if (/sla risk|critical priority|service level|breached sla/i.test(lower)) result.risks.push({ category: 'risks', title: 'SLA risk', detail: serviceText, account: activity.account, evidence: [evidence(activity, serviceText)] })
      }
    }
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

    if (template.id === 'field-service') {
      if (!hasFieldServiceEvidence(activity)) continue
      const lowerText = `${activity.activityType ?? ''} ${activity.issueProblem ?? ''} ${activity.intelligence ?? ''} ${activity.outcome ?? ''} ${activity.resolution ?? ''} ${activity.escalation ?? ''} ${activity.downtime ?? ''} ${activity.partsMaterialsUsed ?? ''} ${activity.slaPriority ?? ''} ${activity.equipmentAsset ?? ''} ${activity.serviceStatus ?? ''} ${activity.customerSignOff ?? ''}`.toLowerCase()
      if (/unresolved issue|still unresolved|issue remains unresolved|not resolved/i.test(lowerText)) signals.push({ type: 'commercial-opportunity', account: activity.account, title: 'Unresolved service issue', reason: lowerText, strength: 'moderate', category: 'risks', evidence: [evidence(activity, lowerText)] })
      if (/escalation required|escalation|engineering escalation/i.test(lowerText)) signals.push({ type: 'commercial-opportunity', account: activity.account, title: 'Escalation required', reason: lowerText, strength: 'moderate', category: 'risks', evidence: [evidence(activity, lowerText)] })
      if (/downtime|outage|service interruption|equipment down|\d+\s*(hour|hr|minute|min|day)/i.test(lowerText)) signals.push({ type: 'commercial-opportunity', account: activity.account, title: 'Downtime', reason: lowerText, strength: 'moderate', category: 'risks', evidence: [evidence(activity, lowerText)] })
      if (/safety concern|unsafe|hazard|risk to safety/i.test(lowerText)) signals.push({ type: 'commercial-opportunity', account: activity.account, title: 'Safety concern', reason: lowerText, strength: 'moderate', category: 'risks', evidence: [evidence(activity, lowerText)] })
      if (/preventive maintenance|maintenance opportunity|routine service/i.test(lowerText)) signals.push({ type: 'commercial-opportunity', account: activity.account, title: 'Preventive maintenance opportunity', reason: lowerText, strength: 'moderate', category: 'progress', evidence: [evidence(activity, lowerText)] })
      if (/parts required|parts needed|replacement required|spare parts|parts used|materials used/i.test(lowerText)) signals.push({ type: 'commercial-opportunity', account: activity.account, title: 'Parts required', reason: lowerText, strength: 'low', category: 'deliverables', evidence: [evidence(activity, lowerText)] })
      if (/customer concern|customer complaint|service quality|customer satisfaction|customer sign-off|customer sign off/i.test(lowerText)) signals.push({ type: 'commercial-opportunity', account: activity.account, title: 'Customer concern', reason: lowerText, strength: 'low', category: 'stakeholders', evidence: [evidence(activity, lowerText)] })
      if (/sla risk|service level|critical priority|breached sla/i.test(lowerText)) signals.push({ type: 'commercial-opportunity', account: activity.account, title: 'SLA risk', reason: lowerText, strength: 'moderate', category: 'risks', evidence: [evidence(activity, lowerText)] })
      continue
    }
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
  if (template.id === 'field-service') addServiceRepeatSignals(signals, activities)
  return signals
}