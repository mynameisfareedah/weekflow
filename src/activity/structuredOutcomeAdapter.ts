import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from '../config/templates'
import { getTemplateSchemaById } from '../config/templateSchema'
import type { StructuredOutcomeType } from '../types/dailyActivity'

export interface StructuredOutcomeOption {
  value: StructuredOutcomeType
  label: string
}

export function getStructuredOutcomeOptions(template: WeekFlowTemplate = FIELD_SALES_TEMPLATE): StructuredOutcomeOption[] {
  const schema = getTemplateSchemaById(template.id)
  const types = schema ? Object.keys(schema.intelligence.outcomeCategories) as StructuredOutcomeType[] : []
  return types.map((value) => ({ value, label: value }))
}

export function isStructuredOutcomesEnabled(template: WeekFlowTemplate = FIELD_SALES_TEMPLATE) {
  return getStructuredOutcomeOptions(template).length > 0
}
