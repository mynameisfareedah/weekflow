import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from '../config/templates.ts'

export function getOpportunityScoreWeights(template: WeekFlowTemplate = FIELD_SALES_TEMPLATE): Record<string, number> {
  const weights = { ...template.intelligence.opportunityScoreWeights }
  if (template.id === 'field-service') {
    return {
      ...weights,
      'unresolved service issue': 28,
      'escalation required': 30,
      'downtime': 24,
      'repeat fault': 22,
      'safety concern': 26,
      'preventive maintenance opportunity': 18,
    }
  }
  return weights
}
