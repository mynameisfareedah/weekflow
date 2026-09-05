import {
  ACTIVITY_TYPES,
  PORTFOLIO_PRODUCTS,
  STRUCTURED_OUTCOME_TYPES,
  type ActivityType,
  type DailyActivity,
  type PortfolioProduct,
  type StructuredOutcome,
  type StructuredOutcomeType,
} from '../types/dailyActivity'

const STORAGE_PREFIX = 'weekflow-daily-activities:'

function isActivityType(value: unknown): value is ActivityType {
  return typeof value === 'string' && ACTIVITY_TYPES.includes(value as ActivityType)
}

function isOutcomeType(value: unknown): value is StructuredOutcomeType {
  return typeof value === 'string' && STRUCTURED_OUTCOME_TYPES.includes(value as StructuredOutcomeType)
}

function isProduct(value: unknown): value is PortfolioProduct {
  return typeof value === 'string' && PORTFOLIO_PRODUCTS.includes(value as PortfolioProduct)
}

function normalizeOutcome(outcome: unknown): StructuredOutcome | null {
  if (!outcome || typeof outcome !== 'object') return null
  const candidate = outcome as Partial<StructuredOutcome>
  if (typeof candidate.id !== 'string' || !isOutcomeType(candidate.type) || typeof candidate.details !== 'string') return null

  return {
    id: candidate.id,
    type: candidate.type,
    details: candidate.details,
    ...(isProduct(candidate.product) ? { product: candidate.product } : {}),
    ...(typeof candidate.quantity === 'string' ? { quantity: candidate.quantity } : {}),
    ...(typeof candidate.stockStatus === 'string' ? { stockStatus: candidate.stockStatus } : {}),
  }
}

function normalizeActivity(activity: unknown): DailyActivity | null {
  if (!activity || typeof activity !== 'object') return null
  const candidate = activity as Partial<DailyActivity>
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.date !== 'string' ||
    typeof candidate.weekStart !== 'string' ||
    typeof candidate.account !== 'string' ||
    !isActivityType(candidate.activityType)
  ) return null

  return {
    id: candidate.id,
    date: candidate.date,
    weekStart: candidate.weekStart,
    plannedActivityId: typeof candidate.plannedActivityId === 'string' ? candidate.plannedActivityId : null,
    account: candidate.account,
    activityType: candidate.activityType,
    hcpNames: Array.isArray(candidate.hcpNames) ? candidate.hcpNames.filter((name): name is string => typeof name === 'string') : [],
    outcome: typeof candidate.outcome === 'string' ? candidate.outcome : '',
    intelligence: typeof candidate.intelligence === 'string' ? candidate.intelligence : '',
    nextAction: typeof candidate.nextAction === 'string' ? candidate.nextAction : '',
    structuredOutcomes: Array.isArray(candidate.structuredOutcomes)
      ? candidate.structuredOutcomes.map(normalizeOutcome).filter((outcome): outcome is StructuredOutcome => outcome !== null)
      : [],
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
  }
}

export function loadDailyActivities(weekStart: string) {
  try {
    const saved = window.localStorage.getItem(`${STORAGE_PREFIX}${weekStart}`)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    return Array.isArray(parsed)
      ? parsed.map(normalizeActivity).filter((activity): activity is DailyActivity => activity !== null)
      : []
  } catch {
    return []
  }
}

export function saveDailyActivities(weekStart: string, activities: DailyActivity[]) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${weekStart}`, JSON.stringify(activities))
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}
