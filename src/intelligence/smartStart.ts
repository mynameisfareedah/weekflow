import type { CarryForwardCandidate } from './intelligenceTypes'
import { PLAN_CATEGORIES, type DayId, type PlanCategory, type WeeklyPlan } from '../types/weeklyPlan.ts'

export interface SmartStartTarget {
  candidateKey: string
  dayId: DayId
  category: PlanCategory
}

export interface SmartStartMergeResult {
  plan: WeeklyPlan
  added: number
  existing: number
}

export function getCarryForwardCandidateKey(candidate: CarryForwardCandidate) {
  return `${candidate.title}-${candidate.account ?? ''}`
}

function normalizePlanText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function isAlreadyInPlan(plan: WeeklyPlan, candidate: CarryForwardCandidate, text: string) {
  const candidateTitle = normalizePlanText(candidate.title)
  const candidateAccount = normalizePlanText(candidate.account ?? '')
  return plan.days.some((day) => PLAN_CATEGORIES.some((category) => day.categories[category].some((item) => {
    const existing = normalizePlanText(item.text)
    return existing === normalizePlanText(text) || (existing.includes(candidateTitle) && (!candidateAccount || existing.includes(candidateAccount)))
  })))
}

export function mergeCarryForwardCandidates(
  plan: WeeklyPlan,
  candidates: CarryForwardCandidate[],
  selectedKeys: string[],
  targets: SmartStartTarget[],
): SmartStartMergeResult {
  const nextPlan: WeeklyPlan = {
    ...plan,
    days: plan.days.map((day) => ({
      ...day,
      categories: Object.fromEntries(PLAN_CATEGORIES.map((category) => [category, [...day.categories[category]]])) as WeeklyPlan['days'][number]['categories'],
    })),
  }
  let added = 0
  let existing = 0
  for (const candidate of candidates) {
    const key = getCarryForwardCandidateKey(candidate)
    if (!selectedKeys.includes(key)) continue
    const target = targets.find((item) => item.candidateKey === key)
    const day = nextPlan.days.find((item) => item.id === (target?.dayId ?? 'monday'))
    const category = target?.category ?? 'accountObjectives'
    if (!day) continue
    const text = candidate.account ? `${candidate.title} - ${candidate.account}` : candidate.title
    if (isAlreadyInPlan(nextPlan, candidate, text)) {
      existing += 1
      continue
    }
    day.categories[category].push({ id: crypto.randomUUID(), text })
    added += 1
  }
  return { plan: nextPlan, added, existing }
}
