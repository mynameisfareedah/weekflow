import {
  FOLLOW_UP_PRIORITIES,
  FOLLOW_UP_STATUSES,
  type FollowUp,
  type FollowUpPriority,
  type FollowUpStatus,
} from '../types/followUp'

const STORAGE_PREFIX = 'weekflow-follow-ups:'
const PENDING_FOLLOW_UP_KEY = 'weekflow-pending-follow-up'

function isPriority(value: unknown): value is FollowUpPriority {
  return typeof value === 'string' && FOLLOW_UP_PRIORITIES.includes(value as FollowUpPriority)
}

function isStatus(value: unknown): value is FollowUpStatus {
  return typeof value === 'string' && FOLLOW_UP_STATUSES.includes(value as FollowUpStatus)
}

function normalizeFollowUp(value: unknown): FollowUp | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<FollowUp>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.weekKey !== 'string' ||
    typeof candidate.task !== 'string' ||
    !isPriority(candidate.priority) ||
    !isStatus(candidate.status)
  ) return null

  return {
    id: candidate.id,
    weekKey: candidate.weekKey,
    task: candidate.task,
    ...(typeof candidate.facility === 'string' && candidate.facility ? { facility: candidate.facility } : {}),
    ...(typeof candidate.hcpName === 'string' && candidate.hcpName ? { hcpName: candidate.hcpName } : {}),
    ...(typeof candidate.dueDate === 'string' && candidate.dueDate ? { dueDate: candidate.dueDate } : {}),
    priority: candidate.priority,
    status: candidate.status,
    ...(typeof candidate.notes === 'string' && candidate.notes ? { notes: candidate.notes } : {}),
    ...(typeof candidate.sourceActivityId === 'string' ? { sourceActivityId: candidate.sourceActivityId } : {}),
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
  }
}

export function loadFollowUps(weekKey: string): FollowUp[] {
  try {
    const saved = window.localStorage.getItem(`${STORAGE_PREFIX}${weekKey}`)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    return Array.isArray(parsed)
      ? parsed.map(normalizeFollowUp).filter((followUp): followUp is FollowUp => followUp !== null)
      : []
  } catch {
    return []
  }
}

export function saveFollowUps(weekKey: string, followUps: FollowUp[]) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${weekKey}`, JSON.stringify(followUps))
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

export function queueFollowUpPrefill(prefill: Partial<FollowUp> & { weekKey: string }) {
  try {
    window.sessionStorage.setItem(PENDING_FOLLOW_UP_KEY, JSON.stringify(prefill))
  } catch {
    // Session storage can be unavailable in restricted environments.
  }
}

export function consumeFollowUpPrefill(weekKey: string): Partial<FollowUp> | null {
  try {
    const saved = window.sessionStorage.getItem(PENDING_FOLLOW_UP_KEY)
    if (!saved) return null
    window.sessionStorage.removeItem(PENDING_FOLLOW_UP_KEY)
    const parsed: unknown = JSON.parse(saved)
    if (!parsed || typeof parsed !== 'object' || (parsed as { weekKey?: string }).weekKey !== weekKey) return null
    return parsed as Partial<FollowUp>
  } catch {
    return null
  }
}
