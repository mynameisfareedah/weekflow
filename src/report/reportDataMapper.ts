import type { ReportSectionPresentation, ReportSectionSchema } from '../config/templateSchema.ts'
import type { WeekFlowTemplate } from '../config/templates.ts'
import type { ReportSnapshot } from '../utils/reportDocx.ts'

export type ReportDataGroupValue = unknown

export interface MappedReportSection {
  sectionId: string
  title: string
  order: number
  enabled: boolean
  presentation: ReportSectionPresentation
  groups: Record<string, ReportDataGroupValue>
  unsupportedGroups: string[]
}

export type ReportDataMappingResult = MappedReportSection

function getSupportedGroup(snapshot: ReportSnapshot, group: string): ReportDataGroupValue | undefined {
  switch (group) {
    case 'weeklyPlan':
      return snapshot.plan
    case 'dailyActivities':
      return snapshot.activities
    case 'followUps':
      return snapshot.followUps
    case 'outcomes':
      return snapshot.activities.flatMap((activity) => activity.structuredOutcomes)
    case 'virtualEngagements':
      return snapshot.activities.filter((activity) => activity.activityType === 'Virtual Engagement')
    case 'commercialOutcomes':
      return snapshot.activities.flatMap((activity) => activity.structuredOutcomes.filter((outcome) => outcome.type === 'Prescription Generated'))
    case 'patientJourney':
      return snapshot.activities.flatMap((activity) => activity.structuredOutcomes.filter((outcome) => outcome.type === 'Patient Identified' || outcome.type === 'Patient Access / Access Barrier'))
    case 'priorities':
      return snapshot.plan.commercialPriorities
    case 'intelligence':
      return snapshot.activities.flatMap((activity) => [
        ...activity.structuredOutcomes.map((outcome) => ({ account: activity.account, type: outcome.type, details: outcome.details })),
        ...(activity.intelligence.trim() ? [{ account: activity.account, type: 'Business Notes', details: activity.intelligence }] : []),
      ])
    case 'projectPerformance':
      return snapshot.performance
    case 'projectProgress':
      return snapshot.performance ? snapshot.performance.objectives : undefined
    case 'deliverables':
      return snapshot.performance ? snapshot.performance.objectives.filter((objective) => objective.status === 'completed') : undefined
    case 'risks':
      return snapshot.performance ? snapshot.performance.activeRisks : undefined
    case 'blockers':
      return snapshot.performance ? snapshot.performance.blockedWork : undefined
    case 'decisions':
      return snapshot.performance ? snapshot.activities.filter((activity) => activity.decision?.trim()) : undefined
    case 'stakeholders':
      return snapshot.performance ? snapshot.activities.filter((activity) => activity.hcpNames.length > 0) : undefined
    default:
      return undefined
  }
}

export function mapReportSectionData(
  snapshot: ReportSnapshot,
  section: ReportSectionSchema,
  _template?: WeekFlowTemplate,
): ReportDataMappingResult {
  const groups: Record<string, ReportDataGroupValue> = {}
  const unsupportedGroups: string[] = []

  for (const group of section.dataGroups) {
    const value = getSupportedGroup(snapshot, group)
    if (value === undefined) unsupportedGroups.push(group)
    else groups[group] = value
  }

  return {
    sectionId: section.id,
    title: section.title,
    order: section.order,
    enabled: section.enabled,
    presentation: section.presentation ?? { displayType: 'unsupported', emptyState: 'This section is not currently available from the shared report data.', showWhenEmpty: true },
    groups,
    unsupportedGroups,
  }
}

export function mapReportSections(
  snapshot: ReportSnapshot,
  sections: readonly ReportSectionSchema[],
  template?: WeekFlowTemplate,
): ReportDataMappingResult[] {
  return sections
    .filter((section) => section.enabled)
    .sort((left, right) => left.order - right.order)
    .map((section) => mapReportSectionData(snapshot, section, template))
}
