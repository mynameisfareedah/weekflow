export const CUSTOM_TEMPLATE_PURPOSES = ['Personal', 'Business', 'Project', 'Operations', 'Education', 'Research', 'NGO', 'Other'] as const
export type CustomTemplatePurpose = typeof CUSTOM_TEMPLATE_PURPOSES[number]

export const CUSTOM_FIELD_TYPES = ['text', 'long-text', 'number', 'date', 'datetime', 'dropdown', 'multi-select', 'checkbox', 'percentage', 'currency', 'url'] as const
export type CustomFieldType = typeof CUSTOM_FIELD_TYPES[number]

export interface CustomField {
  id: string
  name: string
  archived?: boolean
  description?: string
  type: CustomFieldType
  required: boolean
  options?: string[]
  order: number
}

export interface CustomStatus {
  id: string
  name: string
  description?: string
  order: number
}

export const CUSTOM_TARGET_TYPES = ['number', 'percentage', 'currency'] as const
export type CustomTargetType = typeof CUSTOM_TARGET_TYPES[number]

export interface CustomTarget {
  id: string
  name: string
  description?: string
  type: CustomTargetType
  targetValue: number
  categoryId?: string
  fieldId?: string
  order: number
}

export const CUSTOM_REPORT_SECTION_TYPES = ['weekly-summary', 'activities', 'category', 'targets', 'follow-ups', 'review', 'next-week', 'custom'] as const
export type CustomReportSectionType = typeof CUSTOM_REPORT_SECTION_TYPES[number]

export interface CustomReportSection {
  id: string
  name: string
  description?: string
  type: CustomReportSectionType
  categoryId?: string
  showInReport: boolean
  order: number
}

export interface CustomCategory {
  id: string
  name: string
  archived?: boolean
  description?: string
  icon: string
  showInPlanning: boolean
  showInReporting: boolean
  supportsStatus: boolean
  supportsDueDate: boolean
  order: number
  fields: CustomField[]
}

export interface CustomTemplateConfig {
  name: string
  description: string
  purpose: CustomTemplatePurpose
  icon: string
  accent: string
  categories: CustomCategory[]
  statuses: CustomStatus[]
  targets: CustomTarget[]
  reportSections: CustomReportSection[]
}

export const DEFAULT_CUSTOM_REPORT_SECTIONS: CustomReportSection[] = [
  { id: 'report-weekly-summary', name: 'Weekly Summary', type: 'weekly-summary', showInReport: true, order: 1 },
  { id: 'report-activities', name: 'Activities', type: 'activities', showInReport: true, order: 2 },
  { id: 'report-follow-ups', name: 'Follow-Ups', type: 'follow-ups', showInReport: true, order: 3 },
  { id: 'report-review', name: 'Review', type: 'review', showInReport: true, order: 4 },
  { id: 'report-next-week', name: 'Next Week', type: 'next-week', showInReport: true, order: 5 },
]

export const DEFAULT_CUSTOM_TEMPLATE_CONFIG: CustomTemplateConfig = {
  name: 'Custom Workspace',
  description: '',
  purpose: 'Other',
  icon: 'custom',
  accent: '#a95f39',
  categories: [],
  statuses: [
    { id: 'status-not-started', name: 'Not Started', order: 1 },
    { id: 'status-in-progress', name: 'In Progress', order: 2 },
    { id: 'status-completed', name: 'Completed', order: 3 },
  ],
  targets: [],
  reportSections: DEFAULT_CUSTOM_REPORT_SECTIONS.map((section) => ({ ...section })),
}

export const DEFAULT_CUSTOM_STATUSES: CustomStatus[] = DEFAULT_CUSTOM_TEMPLATE_CONFIG.statuses.map((status) => ({ ...status }))

export const CUSTOM_TEMPLATE_ICON_OPTIONS = [
  { id: 'custom', label: 'Spark' },
  { id: 'project-management', label: 'Project' },
  { id: 'field-service', label: 'Operations' },
  { id: 'education', label: 'Education' },
  { id: 'personal', label: 'Personal' },
] as const

export const CUSTOM_TEMPLATE_ACCENT_OPTIONS = [
  { value: '#a95f39', label: 'Terracotta' },
  { value: '#2f6f68', label: 'Teal' },
  { value: '#4169a1', label: 'Blue' },
  { value: '#7b5a91', label: 'Plum' },
  { value: '#58704a', label: 'Moss' },
] as const
