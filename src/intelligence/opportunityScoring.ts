import type { OpportunityScore, OpportunitySignal, OpportunityStrength } from './intelligenceTypes'

const SIGNAL_POINTS: Record<string, number> = {
  'prescription identified': 30,
  'unresolved patient access issue': 20,
  'stock issue': 20,
  'follow-up required': 15,
  'strategic account signal': 15,
  'MDT opportunity': 15,
  'patient population identified': 10,
  'scientific engagement opportunity': 10,
}

function getStrength(score: number): OpportunityStrength {
  if (score >= 70) return 'priority'
  if (score >= 50) return 'high'
  if (score >= 25) return 'moderate'
  return 'low'
}

export function scoreOpportunities(signals: OpportunitySignal[]): OpportunityScore[] {
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
      for (const label of Object.keys(SIGNAL_POINTS)) if (title.includes(label)) matchedLabels.add(label)
    }
    const score = [...matchedLabels].reduce((total, label) => total + SIGNAL_POINTS[label], 0)
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