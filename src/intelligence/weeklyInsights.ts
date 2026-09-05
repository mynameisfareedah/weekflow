import type { DailyActivity, StructuredOutcome } from '../types/dailyActivity'
import type { Evidence, IntelligenceCategory, OpportunitySignal, WeeklyInsight } from './intelligenceTypes'

function evidence(activity: DailyActivity, text: string, outcome?: StructuredOutcome): Evidence {
  return { activityId: activity.id, account: activity.account, text, ...(outcome ? { outcome } : {}) }
}

function categoryForOutcome(type: StructuredOutcome['type']): IntelligenceCategory {
  if (type === 'Prescription Generated') return 'commercial'
  if (type === 'Patient Identified') return 'patient'
  if (type === 'Patient Access / Access Barrier' || type === 'Stock Issue') return 'access-market'
  if (type === 'MDT Opportunity' || type === 'Referral Opportunity') return 'strategic-accounts'
  return 'scientific-engagement'
}

function titleForOutcome(outcome: StructuredOutcome) {
  return outcome.product ? `${outcome.type}: ${outcome.product}` : outcome.type
}

export function deriveWeeklyInsights(activities: DailyActivity[]): Record<IntelligenceCategory, WeeklyInsight[]> {
  const result: Record<IntelligenceCategory, WeeklyInsight[]> = {
    commercial: [], patient: [], 'access-market': [], 'strategic-accounts': [], 'scientific-engagement': [],
  }
  for (const activity of activities) {
    for (const outcome of activity.structuredOutcomes) {
      if (!outcome.details.trim() && !outcome.product) continue
      const category = categoryForOutcome(outcome.type)
      result[category].push({ category, title: titleForOutcome(outcome), detail: outcome.details || outcome.type, account: activity.account, evidence: [evidence(activity, outcome.details || outcome.type, outcome)] })
    }
    if (activity.intelligence.trim()) {
      const text = activity.intelligence.trim()
      const lower = text.toLowerCase()
      const category: IntelligenceCategory = /patient|treatment|cancer|population/.test(lower) ? 'patient' : /mdt|referral|account|stakeholder/.test(lower) ? 'strategic-accounts' : /cme|meeting|journal|scientific|clinical/.test(lower) ? 'scientific-engagement' : /nhis|access|fund|stock|inventory|availability|afford/.test(lower) ? 'access-market' : 'strategic-accounts'
      result[category].push({ category, title: 'Captured intelligence', detail: text, account: activity.account, evidence: [evidence(activity, text)] })
    }
  }
  for (const category of Object.keys(result) as IntelligenceCategory[]) {
    result[category] = result[category].filter((insight, index, all) => all.findIndex((candidate) => candidate.account === insight.account && candidate.title === insight.title && candidate.detail === insight.detail) === index)
  }
  return result
}

export function deriveOpportunitySignals(activities: DailyActivity[]): OpportunitySignal[] {
  const signals: OpportunitySignal[] = []
  for (const activity of activities) {
    for (const outcome of activity.structuredOutcomes) {
      const mapping: Partial<Record<StructuredOutcome['type'], { title: string; category: IntelligenceCategory }>> = {
        'Prescription Generated': { title: `Prescription identified: ${outcome.product ?? outcome.details}`, category: 'commercial' },
        'Patient Identified': { title: 'Patient population identified', category: 'patient' },
        'Patient Access / Access Barrier': { title: 'Unresolved patient access issue', category: 'access-market' },
        'Stock Issue': { title: 'Stock issue', category: 'access-market' },
        'MDT Opportunity': { title: 'MDT opportunity', category: 'strategic-accounts' },
        'Referral Opportunity': { title: 'Referral/pathway opportunity', category: 'strategic-accounts' },
        'Scientific Engagement': { title: 'Scientific engagement opportunity', category: 'scientific-engagement' },
        'CME / Meeting Opportunity': { title: 'Scientific engagement opportunity', category: 'scientific-engagement' },
      }
      const mapped = mapping[outcome.type]
      if (mapped) signals.push({ type: 'commercial-opportunity', account: activity.account, title: mapped.title, reason: outcome.details || `${outcome.type} was recorded in structured activity data.`, strength: 'moderate', category: mapped.category, evidence: [evidence(activity, outcome.details || outcome.type, outcome)] })
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