import { getWorkflowTemplateById } from '../src/config/templates.ts'
import { getReportSectionDescriptors } from '../src/report/reportTemplateAdapter.ts'
import { mapReportSections } from '../src/report/reportDataMapper.ts'
import type { ReportSnapshot } from '../src/utils/reportDocx.ts'
import type { WeeklyPlan } from '../src/types/weeklyPlan.ts'

const templateIds = ['field-sales', 'field-service', 'project-management', 'small-business', 'ngo-community', 'education', 'personal', 'custom']
const weekKey = '2026-09-07'
const emptyPlan: WeeklyPlan = {
  weekStart: weekKey,
  weeklyStrategicObjectives: [],
  days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((id, index) => ({
    id: id as WeeklyPlan['days'][number]['id'],
    label: id[0].toUpperCase() + id.slice(1),
    date: `2026-09-${String(7 + index).padStart(2, '0')}`,
    categories: {
      facilities: [], hcps: [], primaryObjectives: [], virtualEngagements: [], accountObjectives: [], commercialPriorities: [], successMeasures: [],
    },
  })),
  virtualEngagementPlan: [],
  keyAccountObjectives: [],
  commercialPriorities: [],
  successMeasures: [],
}

for (const templateId of templateIds) {
  const template = getWorkflowTemplateById(templateId)
  const snapshot: ReportSnapshot = {
    weekKey,
    weekLabel: 'September 7 - September 11, 2026',
    plan: emptyPlan,
    activities: [],
    followUps: [],
    template,
  }
  const sections = getReportSectionDescriptors(template)
  const mappings = mapReportSections(snapshot, sections, template)
  if (mappings.length !== sections.filter((section) => section.enabled).length) throw new Error(`${templateId}: enabled section count mismatch`)
  if (mappings.some((mapping) => mapping.unsupportedGroups.some((group) => mapping.groups[group] !== undefined))) throw new Error(`${templateId}: unsupported group was mapped`)
  if (mappings.some((mapping) => !mapping.presentation.displayType || !mapping.presentation.emptyState || mapping.presentation.showWhenEmpty !== true)) throw new Error(`${templateId}: presentation metadata is incomplete`)
  if (mappings.some((mapping, index) => mapping.order !== sections.filter((section) => section.enabled).sort((left, right) => left.order - right.order)[index].order)) throw new Error(`${templateId}: section order was not preserved`)
  if (templateId !== 'field-sales' && mappings.some((mapping) => mapping.groups.commercialOutcomes !== undefined || mapping.groups.patientJourney !== undefined)) throw new Error(`${templateId}: Field Sales outcome data leaked into another template`)
  if (templateId === 'small-business') {
    const expectedIds = ['business-summary', 'daily-business-activity', 'sales-opportunity-progress', 'customer-client-outcomes', 'orders-payments', 'supplier-operational-intelligence', 'priorities-coming-week', 'completed-follow-ups']
    if (mappings.map((mapping) => mapping.sectionId).join('|') !== expectedIds.join('|')) throw new Error('small-business: canonical section set or order is incorrect')
    if (mappings.some((mapping) => mapping.groups.commercialOutcomes !== undefined || mapping.groups.patientJourney !== undefined || mapping.groups.virtualEngagements !== undefined || mapping.groups.strategicAccounts !== undefined)) throw new Error('small-business: unrelated Field Sales groups leaked into report mapping')
  }
}

console.log('Report mapping validation passed: all registered templates preserve explicit supported and unsupported data groups.')