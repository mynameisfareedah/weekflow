import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from '../config/templates.ts'
import { getOpportunityScoreWeights } from './opportunityScoringAdapter.ts'
import type { OpportunityScore, OpportunitySignal, OpportunityStrength } from './intelligenceTypes.ts'

const SIGNAL_POINTS: Record<string, number> = getOpportunityScoreWeights(FIELD_SALES_TEMPLATE)

function getStrength(score: number): OpportunityStrength {
  if (score >= 70) return 'priority'
  if (score >= 50) return 'high'
  if (score >= 25) return 'moderate'
  return 'low'
}

export function scoreOpportunities(signals: OpportunitySignal[], template: WeekFlowTemplate = FIELD_SALES_TEMPLATE): OpportunityScore[] {
  if (template.id === 'project-management') return []
  const signalPoints = getOpportunityScoreWeights(template)
  const byAccount = new Map<string, Set<string>>()
  for (const signal of signals) {
    const key = signal.account.trim().toLowerCase()
    const values = byAccount.get(key) ?? new Set<string>()
    values.add(signal.title)
    byAccount.set(key, values)
  }

  return [...byAccount.keys()].map((key) => {
    const accountSignals = signals.filter((signal) => signal.account.trim().toLowerCase() === key)
    const matchedLabels = new Set<string>()
    for (const signal of accountSignals) {
      const title = signal.title.toLowerCase()
      for (const label of Object.keys(signalPoints)) if (title.includes(label)) matchedLabels.add(label)
    }
    const score = [...matchedLabels].reduce((total, label) => total + signalPoints[label], 0)
    const strength = getStrength(score)
    return {
      account: accountSignals[0].account,
      strength,
      score,
      signals: [...matchedLabels],
      reason: `${strength[0].toUpperCase()}${strength.slice(1)}-priority opportunity based on ${[...matchedLabels].join(', ')}.`,
    }
  }).sort((left, right) => right.score - left.score || left.account.localeCompare(right.account))
}

export { SIGNAL_POINTS }