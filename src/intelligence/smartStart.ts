import type { FollowUp } from '../types/followUp'
import type {
  CommercialPriority,
  CommunicationPlanItem,
  DocumentationPlanItem,
  MonitoringImpactTarget,
  PlanItem,
  ProgrammeActivity,
  ResourceLogisticsItem,
  StakeholderPlanItem,
  VolunteerPlanItem,
  WeeklyPlan,
} from '../types/weeklyPlan'

export type SmartStartCandidateType = 'weekly-objective' | 'open-follow-up' | 'account-objective' | 'commercial-priority' | 'ngo-programme-activity' | 'ngo-community-engagement' | 'ngo-volunteer' | 'ngo-stakeholder' | 'ngo-resource' | 'ngo-communication' | 'ngo-documentation' | 'ngo-monitoring'

type NgoSmartStartSource =
  | { kind: 'programme-activity'; item: ProgrammeActivity }
  | { kind: 'community-engagement'; item: NonNullable<WeeklyPlan['communityEngagement']>[number] }
  | { kind: 'volunteer'; item: VolunteerPlanItem }
  | { kind: 'stakeholder'; item: StakeholderPlanItem }
  | { kind: 'resource'; item: ResourceLogisticsItem }
  | { kind: 'communication'; item: CommunicationPlanItem }
  | { kind: 'documentation'; item: DocumentationPlanItem }
  | { kind: 'monitoring'; item: MonitoringImpactTarget }

export interface SmartStartCandidate {
  key: string
  type: SmartStartCandidateType
  title: string
  detail?: string
  sourceId: string
  source: PlanItem | FollowUp | { account: string; objective: PlanItem } | CommercialPriority | NgoSmartStartSource
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

function isUnfinished(status?: string) {
  return !/^(complete|completed|done|closed|achieved|resolved|cancelled)$/i.test(clean(status))
}

function addNgoCandidates<T extends { id: string }, K extends NgoSmartStartSource['kind']>(candidates: SmartStartCandidate[], type: SmartStartCandidateType, items: T[] | undefined, isEligible: (item: T) => boolean, title: (item: T) => string, detail: (item: T) => string | undefined, kind: K) {
  for (const item of items ?? []) {
    const itemTitle = clean(title(item))
    if (!itemTitle || !isEligible(item)) continue
    candidates.push({ key: candidateKey(type, item.id), type, title: itemTitle, detail: detail(item), sourceId: item.id, source: { kind, item } as unknown as Extract<NgoSmartStartSource, { kind: K }> })
  }
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

function hasNgoItem(plan: WeeklyPlan, source: NgoSmartStartSource) {
  const items = source.kind === 'programme-activity' ? plan.programmeActivities
    : source.kind === 'community-engagement' ? plan.communityEngagement
      : source.kind === 'volunteer' ? plan.volunteerPlan
        : source.kind === 'stakeholder' ? plan.stakeholderPlan
          : source.kind === 'resource' ? plan.resourcesLogistics
            : source.kind === 'communication' ? plan.communicationsPlan
              : source.kind === 'documentation' ? plan.documentationPlan
                : plan.monitoringImpactTargets
  return (items ?? []).some((item) => {
    if (source.kind === 'programme-activity') return normalize((item as ProgrammeActivity).activity) === normalize(source.item.activity)
    if (source.kind === 'community-engagement') return normalize((item as NonNullable<WeeklyPlan['communityEngagement']>[number]).engagementActivity) === normalize(source.item.engagementActivity) && normalize((item as NonNullable<WeeklyPlan['communityEngagement']>[number]).communityGroup) === normalize(source.item.communityGroup)
    if (source.kind === 'volunteer') return normalize((item as VolunteerPlanItem).activity) === normalize(source.item.activity) && normalize((item as VolunteerPlanItem).volunteer) === normalize(source.item.volunteer)
    if (source.kind === 'stakeholder') return normalize((item as StakeholderPlanItem).actionRequired || (item as StakeholderPlanItem).purpose) === normalize(source.item.actionRequired || source.item.purpose) && normalize((item as StakeholderPlanItem).stakeholder) === normalize(source.item.stakeholder)
    if (source.kind === 'resource') return normalize(clean((item as ResourceLogisticsItem).resource)) === normalize(clean(source.item.resource)) && normalize(clean((item as ResourceLogisticsItem).gap)) === normalize(clean(source.item.gap))
    if (source.kind === 'communication') return normalize((item as CommunicationPlanItem).communication) === normalize(source.item.communication)
    if (source.kind === 'documentation') return normalize((item as DocumentationPlanItem).documentation) === normalize(source.item.documentation)
    return normalize((item as MonitoringImpactTarget).text) === normalize(source.item.text) && (item as MonitoringImpactTarget).kind === source.item.kind
  })
}

function hasFollowUp(followUps: FollowUp[], source: FollowUp) {
  return followUps.some((followUp) => normalize(followUp.task) === normalize(source.task) && normalize(followUp.facility ?? '') === normalize(source.facility ?? ''))
}

export function getSmartStartCandidates(plan: WeeklyPlan, followUps: FollowUp[], templateId?: string) {
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
  if (templateId === 'ngo-community') {
    addNgoCandidates(candidates, 'ngo-programme-activity', plan.programmeActivities, (item) => isUnfinished(item.status), (item) => item.activity, (item) => [item.programmeArea, item.location, item.target].filter(Boolean).join(' · ') || undefined, 'programme-activity')
    addNgoCandidates(candidates, 'ngo-community-engagement', plan.communityEngagement, () => true, (item) => item.engagementActivity, (item) => item.communityGroup || undefined, 'community-engagement')
    addNgoCandidates(candidates, 'ngo-volunteer', plan.volunteerPlan, (item) => isUnfinished(item.status), (item) => item.activity, (item) => [item.volunteer, item.role].filter(Boolean).join(' · ') || undefined, 'volunteer')
    addNgoCandidates(candidates, 'ngo-stakeholder', plan.stakeholderPlan, (item) => isUnfinished(item.status), (item) => item.actionRequired || item.purpose, (item) => [item.stakeholder, item.owner, item.due].filter(Boolean).join(' · ') || undefined, 'stakeholder')
    addNgoCandidates(candidates, 'ngo-resource', plan.resourcesLogistics, (item) => isUnfinished(item.action) && Boolean(item.gap?.trim() || item.required?.trim()), (item) => item.resource, (item) => [item.gap, item.action].filter(Boolean).join(' · ') || undefined, 'resource')
    addNgoCandidates(candidates, 'ngo-communication', plan.communicationsPlan, (item) => isUnfinished(item.status), (item) => item.communication, (item) => [item.audience, item.channel].filter(Boolean).join(' · ') || undefined, 'communication')
    addNgoCandidates(candidates, 'ngo-documentation', plan.documentationPlan, (item) => isUnfinished(item.status), (item) => item.documentation, (item) => [item.required, item.responsible].filter(Boolean).join(' · ') || undefined, 'documentation')
    addNgoCandidates(candidates, 'ngo-monitoring', plan.monitoringImpactTargets, () => true, (item) => item.text, (item) => item.kind === 'intended-outcomes' ? 'Intended outcome' : 'Output target', 'monitoring')
  }
  return candidates
}

function carryForwardKey(title: string, account?: string) {
  return `${title}-${account ?? ''}`
}

function candidateCarryForwardAccount(candidate: SmartStartCandidate) {
  if (candidate.type === 'account-objective') {
    const source = candidate.source as { account: string; objective: PlanItem }
    return source.account
  }
  if (candidate.type === 'commercial-priority') {
    const source = candidate.source as CommercialPriority
    return source.account
  }
  return undefined
}

export function getSmartStartCandidateKeysFromCarryForwardSelection(candidates: SmartStartCandidate[], carryForwardKeys: string[]) {
  const selected = new Set<string>()
  const requested = new Set(carryForwardKeys.map((value) => normalize(value)))
  for (const candidate of candidates) {
    const key = normalize(carryForwardKey(candidate.title, candidateCarryForwardAccount(candidate)))
    if (requested.has(key)) selected.add(candidate.key)
  }
  return [...selected]
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
    programmeActivities: (newPlan.programmeActivities ?? []).map((item) => ({ ...item })),
    communityEngagement: (newPlan.communityEngagement ?? []).map((item) => ({ ...item })),
    volunteerPlan: (newPlan.volunteerPlan ?? []).map((item) => ({ ...item })),
    stakeholderPlan: (newPlan.stakeholderPlan ?? []).map((item) => ({ ...item })),
    resourcesLogistics: (newPlan.resourcesLogistics ?? []).map((item) => ({ ...item })),
    communicationsPlan: (newPlan.communicationsPlan ?? []).map((item) => ({ ...item })),
    documentationPlan: (newPlan.documentationPlan ?? []).map((item) => ({ ...item })),
    monitoringImpactTargets: (newPlan.monitoringImpactTargets ?? []).map((item) => ({ ...item })),
  }
  const followUps = newFollowUps.map((followUp) => ({ ...followUp }))
  let added = 0
  for (const candidate of candidates) {
    if (!selectedKeys.includes(candidate.key)) continue
    if (candidate.type.startsWith('ngo-')) {
      const source = candidate.source as NgoSmartStartSource
      if (hasNgoItem(plan, source)) continue
      if (source.kind === 'programme-activity') plan.programmeActivities?.push({ ...source.item, id: newId() })
      else if (source.kind === 'community-engagement') plan.communityEngagement?.push({ ...source.item, id: newId() })
      else if (source.kind === 'volunteer') plan.volunteerPlan?.push({ ...source.item, id: newId() })
      else if (source.kind === 'stakeholder') plan.stakeholderPlan?.push({ ...source.item, id: newId() })
      else if (source.kind === 'resource') plan.resourcesLogistics?.push({ ...source.item, id: newId() })
      else if (source.kind === 'communication') plan.communicationsPlan?.push({ ...source.item, id: newId() })
      else if (source.kind === 'documentation') plan.documentationPlan?.push({ ...source.item, id: newId() })
      else plan.monitoringImpactTargets?.push({ ...source.item, id: newId() })
      added += 1
    } else if (candidate.type === 'weekly-objective') {
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
