import { getReportSectionDescriptors } from './reportTemplateAdapter.ts'
import { mapReportSectionData, type MappedReportSection } from './reportDataMapper.ts'
import type { ReportHistoryEntry } from '../storage/reportHistoryStorage.ts'

export type ComparisonValueState = 'measured' | 'no-data' | 'not-applicable' | 'unsupported'

export type ComparisonValue = {
  value: number | string | null
  state: ComparisonValueState
}

export type ComparisonMetric = {
  key: string
  label: string
  baseline: ComparisonValue
  comparison: ComparisonValue
  delta?: number
}

export type ComparisonSection = {
  id: string
  title: string
  baseline: { state: ComparisonValueState; content: string }
  comparison: { state: ComparisonValueState; content: string }
}

export type ReportComparison = {
  workspaceId: string
  templateId: string
  baseline: ReportHistoryEntry
  comparison: ReportHistoryEntry
  metrics: ComparisonMetric[]
  sections: ComparisonSection[]
}

export type ComparisonValidation =
  | { valid: true }
  | { valid: false; message: string }

function numeric(value: number, state: ComparisonValueState = 'measured'): ComparisonValue {
  return { value, state }
}

function countMeaningfulPlanItems(report: ReportHistoryEntry) {
  const dayItems = report.plan.days.flatMap((day) => Object.values(day.categories).flat())
  const weeklyItems = [
    ...(report.plan.weeklyStrategicObjectives ?? []),
    ...(report.plan.virtualEngagementPlan ?? []).flatMap((item) => [...item.priorityContacts, { id: item.id, text: `${item.coverage} ${item.objective}` }]),
    ...(report.plan.keyAccountObjectives ?? []).flatMap((item) => item.objectives),
    ...(report.plan.commercialPriorities ?? []),
    ...(report.plan.successMeasures ?? []),
  ]
  return [...dayItems, ...weeklyItems].filter((item) => item.text.trim()).length
}

function countCapturedPlanItems(report: ReportHistoryEntry) {
  const planned = countMeaningfulPlanItems(report)
  if (planned === 0) return numeric(0, 'no-data')
  const activeDays = new Set(report.activities.map((activity) => activity.date)).size
  return numeric(Math.min(planned, activeDays > 0 ? report.activities.length : 0))
}

function activeDays(report: ReportHistoryEntry) {
  const days = new Set(report.activities.map((activity) => activity.date).filter(Boolean))
  return numeric(days.size)
}

function distinctWorkAreas(report: ReportHistoryEntry) {
  const values = new Set(report.activities.map((activity) => activity.account.trim()).filter(Boolean))
  return values.size > 0 ? numeric(values.size) : numeric(0, 'no-data')
}

function readiness(report: ReportHistoryEntry): ComparisonValue {
  const template = report.template
  if (!template) return { value: null, state: 'unsupported' }
  return { value: deriveWeeklyIntelligenceImpl({ selectedWeek: report.weekKey, plan: report.plan, activities: report.activities, followUps: report.followUps, template }).reportReadiness.status, state: 'measured' }
}

import { deriveWeeklyIntelligence as deriveWeeklyIntelligenceImpl } from '../intelligence/intelligenceEngine.ts'

function metric(key: string, label: string, baseline: ComparisonValue, comparison: ComparisonValue): ComparisonMetric {
  const delta = baseline.state === 'measured' && comparison.state === 'measured' && typeof baseline.value === 'number' && typeof comparison.value === 'number'
    ? comparison.value - baseline.value
    : undefined
  return { key, label, baseline, comparison, ...(delta === undefined ? {} : { delta }) }
}

function metricsFor(report: ReportHistoryEntry) {
  const completed = report.followUps.filter((followUp) => followUp.status === 'completed').length
  const open = report.followUps.filter((followUp) => followUp.status === 'open').length
  const outcomes = report.activities.reduce((total, activity) => total + activity.structuredOutcomes.length, 0)
  const planned = countMeaningfulPlanItems(report)
  return {
    activityCount: numeric(report.activities.length),
    activeDays: activeDays(report),
    followUpTotal: numeric(report.followUps.length),
    openFollowUps: numeric(open),
    completedFollowUps: numeric(completed),
    structuredOutcomes: numeric(outcomes),
    plannedItems: planned > 0 ? numeric(planned) : numeric(0, 'no-data'),
    capturedPlannedItems: countCapturedPlanItems(report),
    distinctWorkAreas: distinctWorkAreas(report),
    readiness: readiness(report),
  }
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'No recorded data.'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.length ? value.map(displayValue).join('; ') : 'No recorded data.'
  if (typeof value === 'object') return Object.entries(value as Record<string, unknown>).map(([key, item]) => `${key}: ${displayValue(item)}`).join(' | ')
  return 'No recorded data.'
}

function sectionContent(section: MappedReportSection) {
  const values = Object.values(section.groups).filter((value) => value !== undefined)
  if (values.length === 0) return { state: section.unsupportedGroups.length > 0 ? 'unsupported' as const : 'no-data' as const, content: section.unsupportedGroups.length > 0 ? 'Not available in this report.' : 'No recorded data.' }
  const content = values.map(displayValue).filter(Boolean).join('\n')
  return { state: content === 'No recorded data.' ? 'no-data' as const : 'measured' as const, content: content || 'No recorded data.' }
}

export function validateReportComparison(baseline: ReportHistoryEntry | null, comparison: ReportHistoryEntry | null, workspaceId: string | null): ComparisonValidation {
  if (!baseline || !comparison) return { valid: false, message: 'Select two reports from the same template to compare.' }
  if (!workspaceId || baseline.workspaceId !== workspaceId || comparison.workspaceId !== workspaceId || baseline.workspaceId !== comparison.workspaceId) return { valid: false, message: 'These reports are not from the active workspace.' }
  if (baseline.weekKey === comparison.weekKey) return { valid: false, message: 'These reports are from the same reporting week. Select a different week.' }
  if (!baseline.template?.id || !comparison.template?.id) return { valid: false, message: 'Both reports need template information before they can be compared.' }
  if (baseline.template.id !== comparison.template.id) return { valid: false, message: 'These reports use different templates and cannot be compared.' }
  return { valid: true }
}

export function buildReportComparison(baseline: ReportHistoryEntry, comparison: ReportHistoryEntry, workspaceId: string): ReportComparison {
  const validation = validateReportComparison(baseline, comparison, workspaceId)
  if (!validation.valid) throw new Error(validation.message)
  const baselineMetrics = metricsFor(baseline)
  const comparisonMetrics = metricsFor(comparison)
  const metrics = [
    metric('activity-count', 'Activities', baselineMetrics.activityCount, comparisonMetrics.activityCount),
    metric('active-days', 'Active days', baselineMetrics.activeDays, comparisonMetrics.activeDays),
    metric('follow-up-total', 'Follow-ups', baselineMetrics.followUpTotal, comparisonMetrics.followUpTotal),
    metric('open-follow-ups', 'Open follow-ups', baselineMetrics.openFollowUps, comparisonMetrics.openFollowUps),
    metric('completed-follow-ups', 'Completed follow-ups', baselineMetrics.completedFollowUps, comparisonMetrics.completedFollowUps),
    metric('structured-outcomes', 'Structured outcomes', baselineMetrics.structuredOutcomes, comparisonMetrics.structuredOutcomes),
    metric('planned-items', 'Planned items', baselineMetrics.plannedItems, comparisonMetrics.plannedItems),
    metric('captured-planned-items', 'Captured planned items', baselineMetrics.capturedPlannedItems, comparisonMetrics.capturedPlannedItems),
    metric('distinct-work-areas', 'Distinct work areas', baselineMetrics.distinctWorkAreas, comparisonMetrics.distinctWorkAreas),
    metric('readiness', 'Readiness', baselineMetrics.readiness, comparisonMetrics.readiness),
  ]
  const template = baseline.template!
  const customSections = baseline.customReportConfig?.reportSections
  const descriptors = getReportSectionDescriptors(template, customSections).filter((section) => section.enabled).sort((left, right) => left.order - right.order)
  const baselineSections = descriptors.map((section) => mapReportSectionData(baseline, section, template))
  const comparisonSections = descriptors.map((section) => mapReportSectionData(comparison, section, template))
  const sections = descriptors.map((descriptor, index) => ({ id: descriptor.id, title: descriptor.title, baseline: sectionContent(baselineSections[index]), comparison: sectionContent(comparisonSections[index]) }))
  return { workspaceId, templateId: template.id, baseline, comparison, metrics, sections }
}
