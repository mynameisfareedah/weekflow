import { FIELD_SALES_TEMPLATE, type ReportSectionConfiguration, type WeekFlowTemplate } from '../config/templates.ts'
import { getReportSectionPresentation, getTemplateSchemaById } from '../config/templateSchema.ts'

export interface ReportSectionDescriptor extends ReportSectionConfiguration {
  dataGroups: readonly string[]
  order: number
  presentation: ReturnType<typeof getReportSectionPresentation>
}

export function getReportSectionDescriptors(template: WeekFlowTemplate = FIELD_SALES_TEMPLATE): ReportSectionDescriptor[] {
  return (getTemplateSchemaById(template.id)?.report.sections ?? []).map((section) => ({
    id: section.id,
    title: section.title,
    enabled: section.enabled,
    dataGroups: [...section.dataGroups],
    order: section.order,
    presentation: section.presentation ?? getReportSectionPresentation(template.id, section.id),
  }))
}