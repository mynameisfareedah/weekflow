import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from '../config/templates.ts'
import type { StructuredOutcomeType } from '../types/dailyActivity.ts'
import type { IntelligenceCategory } from './intelligenceTypes.ts'

export function getStructuredOutcomeIntelligenceCategory(
  template: WeekFlowTemplate = FIELD_SALES_TEMPLATE,
  type: StructuredOutcomeType,
): IntelligenceCategory {
  return template.intelligence.structuredOutcomeCategories[type] ?? template.intelligence.fallbackCategory
}

export function classifyIntelligenceText(
  template: WeekFlowTemplate = FIELD_SALES_TEMPLATE,
  text: string,
): IntelligenceCategory {
  const lower = text.toLowerCase()
  for (const rule of template.intelligence.textRules ?? []) if (new RegExp(rule.pattern, 'i').test(lower)) return rule.category
  if (template.id !== 'field-sales') return template.intelligence.fallbackCategory
  if (/patient|treatment|cancer|population/.test(lower)) return 'patient'
  if (/mdt|referral|account|stakeholder/.test(lower)) return 'strategic-accounts'
  if (/cme|meeting|journal|scientific|clinical/.test(lower)) return 'scientific-engagement'
  if (/nhis|access|fund|stock|inventory|availability|afford/.test(lower)) return 'access-market'
  return template.intelligence.fallbackCategory
}

export function getStructuredOutcomeSignal(
  template: WeekFlowTemplate = FIELD_SALES_TEMPLATE,
  type: StructuredOutcomeType,
  outcome: { product?: string; details?: string } = {},
): { title: string; category: IntelligenceCategory } | undefined {
  const configured = Object.prototype.hasOwnProperty.call(template.intelligence.structuredOutcomeCategories, type)
  if (!configured) return undefined

  if (template.id === 'project-management') {
    const category = template.intelligence.structuredOutcomeCategories[type] ?? template.intelligence.fallbackCategory
    return { title: outcome.details || type, category }
  }

  if (template.id === 'field-service') {
    const mapping: Partial<Record<StructuredOutcomeType, { title: string; category: IntelligenceCategory }>> = {
      'Issue Resolved': { title: 'Service issue resolved', category: 'progress' },
      'Issue Partially Resolved': { title: 'Service issue partially unresolved', category: 'risks' },
      'Issue Unresolved': { title: 'Unresolved service issue', category: 'risks' },
      'Installation Completed': { title: 'Installation completed', category: 'progress' },
      'Preventive Maintenance Completed': { title: 'Preventive maintenance completed', category: 'progress' },
      'Inspection Completed': { title: 'Inspection completed', category: 'progress' },
      'Customer Sign-off Obtained': { title: 'Customer sign-off obtained', category: 'stakeholders' },
      'Parts Required': { title: 'Parts required', category: 'deliverables' },
      'Escalation Required': { title: 'Escalation required', category: 'risks' },
      'Follow-up Required': { title: 'Follow-up required', category: 'stakeholders' },
      'Equipment Fault Identified': { title: 'Equipment fault identified', category: 'risks' },
    }

    return mapping[type] ?? { title: outcome.details || type, category: template.intelligence.structuredOutcomeCategories[type] ?? template.intelligence.fallbackCategory }
  }

  if (template.id === 'small-business') {
    const mapping: Partial<Record<StructuredOutcomeType, { title: string; category: IntelligenceCategory }>> = {
      'Sale / Order Won': { title: 'Sale / Order Won', category: 'commercial' },
      'Lead Qualified': { title: 'Lead Qualified', category: 'commercial' },
      'Customer Retained': { title: 'Customer Retained', category: 'stakeholders' },
      'Payment Received': { title: 'Payment Received', category: 'commercial' },
      'Supplier Issue Identified': { title: 'Supplier Issue Identified', category: 'risks' },
      'Operational Improvement': { title: 'Operational Improvement', category: 'progress' },
      'Follow-up Required': { title: 'Follow-up Required', category: 'stakeholders' },
    }
    return mapping[type] ?? { title: outcome.details || type, category: template.intelligence.structuredOutcomeCategories[type] ?? template.intelligence.fallbackCategory }
  }

  const mapping: Partial<Record<StructuredOutcomeType, { title: string; category: IntelligenceCategory }>> = {
    'Prescription Generated': { title: `Prescription identified: ${outcome.product ?? outcome.details ?? 'Product'}`, category: 'commercial' },
    'Patient Identified': { title: 'Patient population identified', category: 'patient' },
    'Patient Access / Access Barrier': { title: 'Unresolved patient access issue', category: 'access-market' },
    'Stock Issue': { title: 'Stock issue', category: 'access-market' },
    'MDT Opportunity': { title: 'MDT opportunity', category: 'strategic-accounts' },
    'Referral Opportunity': { title: 'Referral/pathway opportunity', category: 'strategic-accounts' },
    'Scientific Engagement': { title: 'Scientific engagement opportunity', category: 'scientific-engagement' },
    'CME / Meeting Opportunity': { title: 'Scientific engagement opportunity', category: 'scientific-engagement' },
    'Follow-up Required': { title: 'Follow-up required', category: 'scientific-engagement' },
    Other: { title: 'Scientific engagement opportunity', category: 'scientific-engagement' },
  }

  return mapping[type] ?? { title: type, category: template.intelligence.structuredOutcomeCategories[type] ?? template.intelligence.fallbackCategory }
}
