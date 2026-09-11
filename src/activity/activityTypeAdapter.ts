import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from '../config/templates'
import { getTemplateSchemaById } from '../config/templateSchema'

export interface ActivityTypeOption {
  value: string
  label: string
}

export function getActivityTypeOptions(template: WeekFlowTemplate = FIELD_SALES_TEMPLATE): ActivityTypeOption[] {
  const schema = getTemplateSchemaById(template.id)
  return (schema?.activities.types ?? []).map((value) => ({ value, label: value }))
}
