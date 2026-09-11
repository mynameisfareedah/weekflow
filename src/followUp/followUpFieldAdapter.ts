import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from '../config/templates'
import { getTemplateSchemaById, type FollowUpFieldSchema, type TemplateFieldState } from '../config/templateSchema'

export interface FollowUpFieldDescriptor extends FollowUpFieldSchema {
  visible: boolean
  required: boolean
  conditional: boolean
}

export function getFollowUpFieldDescriptors(template: WeekFlowTemplate = FIELD_SALES_TEMPLATE): FollowUpFieldDescriptor[] {
  return (getTemplateSchemaById(template.id)?.followUps.fields ?? []).map((field) => ({
    ...field,
    visible: field.state !== 'hidden',
    required: field.state === 'required',
    conditional: field.state === 'conditional',
  }))
}

export function getFollowUpField(template: WeekFlowTemplate, key: string) {
  return getFollowUpFieldDescriptors(template).find((field) => field.key === key)
}

export function getFollowUpFieldState(template: WeekFlowTemplate, key: string): TemplateFieldState | undefined {
  return getFollowUpField(template, key)?.state
}