import type { FollowUp } from '../types/followUp'
import type { CommercialPriority, PlanItem, WeeklyPlan } from '../types/weeklyPlan'

export type SmartStartCandidateType = 'weekly-objective' | 'open-follow-up' | 'account-objective' | 'commercial-priority'

export interface SmartStartCandidate {
  key: string
  type: SmartStartCandidateType
  title: string
  detail?: string
  sourceId: string
  source: PlanItem | FollowUp | { account: string; objective: PlanItem } | CommercialPriority
}

export interface SmartStartMergeResult {
  plan: WeeklyPlan
  followUps: FollowUp[]
  added: number
}

function newId() {
  return crypto.randomUUID()
}

function clean(value: string | undefined) {
  return value?.trim() ?? ''
}

function candidateKey(type: SmartStartCandidateType, id: string) {
  return `${type}:${id}`
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function hasPlanItem(plan: WeeklyPlan, text: string) {
  const normalized = normalize(text)
  return [
    ...(plan.weeklyStrategicObjectives ?? []),
    ...(plan.days ?? []).flatMap((day) => Object.values(day.categories).flat()),
  ].some((item) => normalize(item.text) === normalized)
}

function hasAccountObjective(plan: WeeklyPlan, account: string, text: string) {
  const normalizedAccount = normalize(account)
  const normalizedText = normalize(text)
  return (plan.keyAccountObjectives ?? []).some((item) => normalize(item.account) === normalizedAccount && item.objectives.some((objective) => normalize(objective.text) === normalizedText))
}

function hasCommercialPriority(plan: WeeklyPlan, source: CommercialPriority) {
  return (plan.commercialPriorities ?? []).some((item) => normalize(item.text) === normalize(source.text) && normalize(item.account ?? '') === normalize(source.account ?? '') && normalize(item.product ?? '') === normalize(source.product ?? ''))
}

function hasFollowUp(followUps: FollowUp[], source: FollowUp) {
  return followUps.some((followUp) => normalize(followUp.task) === normalize(source.task) && normalize(followUp.facility ?? '') === normalize(source.facility ?? ''))
}

export function getSmartStartCandidates(plan: WeeklyPlan, followUps: FollowUp[]) {
  const candidates: SmartStartCandidate[] = []
  for (const objective of plan.weeklyStrategicObjectives ?? []) {
    if (clean(objective.text)) candidates.push({ key: candidateKey('weekly-objective', objective.id), type: 'weekly-objective', title: objective.text, sourceId: objective.id, source: objective })
  }
  for (const followUp of followUps.filter((item) => item.status === 'open')) {
    if (clean(followUp.task)) candidates.push({ key: candidateKey('open-follow-up', followUp.id), type: 'open-follow-up', title: followUp.task, detail: [followUp.facility, followUp.hcpName].filter(Boolean).join(' · '), sourceId: followUp.id, source: followUp })
  }
  for (const account of plan.keyAccountObjectives ?? []) {
    for (const objective of account.objectives) {
      if (clean(account.account) && clean(objective.text)) candidates.push({ key: candidateKey('account-objective', `${account.id}:${objective.id}`), type: 'account-objective', title: objective.text, detail: account.account, sourceId: objective.id, source: { account: account.account, objective } })
    }
  }
  for (const priority of plan.commercialPriorities ?? []) {
    if (clean(priority.text)) candidates.push({ key: candidateKey('commercial-priority', priority.id), type: 'commercial-priority', title: priority.text, detail: [priority.account, priority.product].filter(Boolean).join(' · '), sourceId: priority.id, source: priority })
  }
  return candidates
}

export function mergeSmartStartSelections(newPlan: WeeklyPlan, newWeekStart: string, newFollowUps: FollowUp[], candidates: SmartStartCandidate[], selectedKeys: string[]): SmartStartMergeResult {
  const plan: WeeklyPlan = {
    ...newPlan,
    weeklyStrategicObjectives: [...(newPlan.weeklyStrategicObjectives ?? [])].map((item) => ({ ...item })),
    days: newPlan.days.map((day) => ({ ...day, categories: Object.fromEntries(Object.entries(day.categories).map(([category, items]) => [category, items.map((item) => ({ ...item }))])) as typeof day.categories })),
    virtualEngagementPlan: (newPlan.virtualEngagementPlan ?? []).map((item) => ({ ...item, priorityContacts: item.priorityContacts.map((contact) => ({ ...contact })) })),
    keyAccountObjectives: (newPlan.keyAccountObjectives ?? []).map((item) => ({ ...item, objectives: item.objectives.map((objective) => ({ ...objective })) })),
    commercialPriorities: (newPlan.commercialPriorities ?? []).map((item) => ({ ...item })),
    successMeasures: (newPlan.successMeasures ?? []).map((item) => ({ ...item })),
  }
  const followUps = newFollowUps.map((followUp) => ({ ...followUp }))
  let added = 0
  for (const candidate of candidates) {
    if (!selectedKeys.includes(candidate.key)) continue
    if (candidate.type === 'weekly-objective') {
      const source = candidate.source as PlanItem
      if (!hasPlanItem(plan, source.text)) {
        plan.weeklyStrategicObjectives.push({ ...source, id: newId() })
        added += 1
      }
    } else if (candidate.type === 'open-follow-up') {
      const source = candidate.source as FollowUp
      if (!hasFollowUp(followUps, source)) {
        const { dueDate: _dueDate, sourceActivityId: _sourceActivityId, ...safeSource } = source
        followUps.push({ ...safeSource, id: newId(), weekKey: newWeekStart, status: 'open', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        added += 1
      }
    } else if (candidate.type === 'account-objective') {
      const source = candidate.source as { account: string; objective: PlanItem }
      if (!hasAccountObjective(plan, source.account, source.objective.text)) {
        const account = plan.keyAccountObjectives.find((item) => normalize(item.account) === normalize(source.account))
        if (account) account.objectives.push({ ...source.objective, id: newId() })
        else plan.keyAccountObjectives.push({ id: newId(), account: source.account, objectives: [{ ...source.objective, id: newId() }] })
        added += 1
      }
    } else {
      const source = candidate.source as CommercialPriority
      if (!hasCommercialPriority(plan, source)) {
        plan.commercialPriorities.push({ ...source, id: newId() })
        added += 1
      }
    }
  }
  plan.weekStart = newWeekStart
  return { plan, followUps, added }
}
