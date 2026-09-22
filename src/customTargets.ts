import type { DailyActivity } from './types/dailyActivity'
import type { CustomTarget, CustomTargetType } from './types/customTemplate'

export type CustomTargetStatus = 'No Data' | 'In Progress' | 'Achieved' | 'Exceeded' | 'No target threshold'

export interface CustomTargetProgress {
  target: CustomTarget
  actual: number | null
  progress: number | null
  status: CustomTargetStatus
  sampleCount: number
}

function getValues(target: CustomTarget, activities: DailyActivity[]) {
  if (!target.fieldId) return []
  return activities
    .filter((activity) => !target.categoryId || activity.customCategoryId === target.categoryId)
    .map((activity) => activity.customFieldValues?.[target.fieldId!])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
}

function calculateActual(type: CustomTargetType, values: number[]) {
  if (type === 'percentage') return values.reduce((sum, value) => sum + value, 0) / values.length
  return values.reduce((sum, value) => sum + value, 0)
}

export function deriveCustomTargetProgress(target: CustomTarget, activities: DailyActivity[]): CustomTargetProgress {
  const values = getValues(target, activities)
  if (values.length === 0) return { target, actual: null, progress: null, status: 'No Data', sampleCount: 0 }
  if (target.targetValue === 0) return { target, actual: calculateActual(target.type, values), progress: null, status: 'No target threshold', sampleCount: values.length }
  const actual = calculateActual(target.type, values)
  const progress = (actual / target.targetValue) * 100
  return { target, actual, progress, status: actual > target.targetValue ? 'Exceeded' : actual === target.targetValue ? 'Achieved' : 'In Progress', sampleCount: values.length }
}

export function formatCustomTargetValue(value: number, type: CustomTargetType) {
  if (type === 'percentage') return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`
  if (type === 'currency') return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(value)
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
}