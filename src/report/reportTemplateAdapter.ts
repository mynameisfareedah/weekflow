import { FIELD_SALES_TEMPLATE, type ReportSectionConfiguration, type WeekFlowTemplate } from '../config/templates.ts'
import { getReportSectionPresentation, getTemplateSchemaById } from '../config/templateSchema.ts'
import type { CustomReportSection } from '../types/customTemplate.ts'

export interface ReportSectionDescriptor extends ReportSectionConfiguration {
  dataGroups: readonly string[]
  order: number
  presentation: ReturnType<typeof getReportSectionPresentation>
}

export function getReportSectionDescriptors(template: WeekFlowTemplate = FIELD_SALES_TEMPLATE, customSections?: readonly CustomReportSection[]): ReportSectionDescriptor[] {
  if (template.id === 'custom' && customSections) {
    return [...customSections].sort((left, right) => left.order - right.order).filter((section) => section.showInReport).map((section) => ({
      id: section.id,
      title: section.name,
      enabled: section.showInReport,
      dataGroups: section.type === 'category' && section.categoryId ? [`custom-category:${section.categoryId}`] : section.type === 'targets' ? ['custom-targets'] : section.type === 'activities' ? ['dailyActivities'] : section.type === 'follow-ups' || section.type === 'next-week' ? ['followUps'] : section.type === 'weekly-summary' ? ['weeklyPlan', 'dailyActivities'] : section.type === 'review' ? ['weeklyPlan'] : [`custom-section:${section.id}`],
      order: section.order,
      presentation: section.type === 'activities' || section.type === 'category' ? getReportSectionPresentation('custom', 'daily-activity-breakdown') : section.type === 'follow-ups' || section.type === 'next-week' ? getReportSectionPresentation('custom', 'priorities-coming-week') : getReportSectionPresentation('custom', 'weekly-summary'),
    }))
  }
  return (getTemplateSchemaById(template.id)?.report.sections ?? []).map((section) => ({
    id: section.id,
    title: section.title,
    enabled: section.enabled,
    dataGroups: [...section.dataGroups],
    order: section.order,
    presentation: section.presentation ?? getReportSectionPresentation(template.id, section.id),
  }))
}