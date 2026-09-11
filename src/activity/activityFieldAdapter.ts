import { FIELD_SALES_TEMPLATE, type ActivityFieldKey, type WeekFlowTemplate } from '../config/templates'
import { getTemplateSchemaById, type TemplateFieldState } from '../config/templateSchema'

export type { ActivityFieldKey } from '../config/templates'

export interface ActivityFieldDescriptor {
  key: ActivityFieldKey
  label: string
  state: TemplateFieldState
  enabled: boolean
  required: boolean
  conditional: boolean
  applicableActivityTypes?: readonly string[]
}

export function getActivityFieldDescriptors(template: WeekFlowTemplate = FIELD_SALES_TEMPLATE): ActivityFieldDescriptor[] {
  const schema = getTemplateSchemaById(template.id)
  return (schema?.activities.fields ?? []).map((field) => ({
    key: field.key as ActivityFieldKey,
    label: field.label,
    state: field.state,
    enabled: field.state !== 'hidden',
    required: field.state === 'required',
    conditional: field.state === 'conditional',
    applicableActivityTypes: field.applicableActivityTypes,
  }))
}

export function isActivityFieldEnabled(template: WeekFlowTemplate, key: ActivityFieldKey, activityType?: string) {
  return getActivityFieldDescriptors(template).some((field) => {
    if (field.key !== key || !field.enabled) return false
    return !field.applicableActivityTypes || !activityType || field.applicableActivityTypes.includes(activityType)
  })
}

export function isActivityFieldRequired(template: WeekFlowTemplate, key: ActivityFieldKey) {
  return getActivityFieldDescriptors(template).some((field) => field.key === key && field.required)
}

export function isActivityFieldConditional(template: WeekFlowTemplate, key: ActivityFieldKey) {
  return getActivityFieldDescriptors(template).some((field) => field.key === key && field.conditional)
}
