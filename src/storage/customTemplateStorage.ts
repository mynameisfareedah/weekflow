import { CUSTOM_FIELD_TYPES, CUSTOM_REPORT_SECTION_TYPES, CUSTOM_TARGET_TYPES, DEFAULT_CUSTOM_REPORT_SECTIONS, DEFAULT_CUSTOM_TEMPLATE_CONFIG, type CustomCategory, type CustomField, type CustomReportSection, type CustomStatus, type CustomTarget, type CustomTemplateConfig } from '../types/customTemplate'
import { getCurrentWorkspaceId } from './workspaceStorage'

const STORAGE_PREFIX = 'weekflow-custom-template:'

function getStorageKey(workspaceId = getCurrentWorkspaceId()) {
  return workspaceId ? `${STORAGE_PREFIX}${workspaceId}` : null
}

function normalizeConfig(value: unknown): CustomTemplateConfig {
  if (!value || typeof value !== 'object') return { ...DEFAULT_CUSTOM_TEMPLATE_CONFIG }
  const candidate = value as Partial<CustomTemplateConfig>
  const normalizeFields = (value: unknown): CustomField[] => Array.isArray(value)
    ? value.filter((field): field is CustomField => Boolean(field) && typeof field === 'object' && typeof (field as CustomField).id === 'string' && typeof (field as CustomField).name === 'string' && typeof (field as CustomField).type === 'string' && CUSTOM_FIELD_TYPES.includes((field as CustomField).type)).map((field, index) => ({
      id: field.id,
      name: field.name.trim(),
      archived: field.archived === true,
      ...(typeof field.description === 'string' && field.description.trim() ? { description: field.description.trim() } : {}),
      type: field.type,
      required: Boolean(field.required === true),
      ...((field.type === 'dropdown' || field.type === 'multi-select') && Array.isArray(field.options) ? { options: field.options.filter((option): option is string => typeof option === 'string' && Boolean(option.trim())).map((option) => option.trim()) } : {}),
      order: Number.isFinite(field.order) ? field.order : index + 1,
    })).sort((left, right) => left.order - right.order).map((field, index) => ({ ...field, order: index + 1 }))
    : []
  const categories = Array.isArray(candidate.categories)
    ? candidate.categories.filter((category): category is CustomCategory => Boolean(category) && typeof category === 'object' && typeof (category as CustomCategory).id === 'string' && typeof (category as CustomCategory).name === 'string').map((category, index) => ({
      id: category.id,
      name: category.name.trim(),
      archived: category.archived === true,
      ...(typeof category.description === 'string' && category.description.trim() ? { description: category.description.trim() } : {}),
      icon: typeof category.icon === 'string' && category.icon.trim() ? category.icon : 'custom',
      showInPlanning: Boolean(category.showInPlanning !== false),
      showInReporting: Boolean(category.showInReporting !== false),
      supportsStatus: Boolean(category.supportsStatus !== false),
      supportsDueDate: category.supportsDueDate === true,
      order: Number.isFinite(category.order) ? category.order : index + 1,
      fields: normalizeFields(category.fields),
    })).sort((left, right) => left.order - right.order).map((category, index) => ({ ...category, order: index + 1 }))
    : []
  const statuses: CustomStatus[] = Array.isArray(candidate.statuses)
    ? candidate.statuses.filter((status): status is CustomStatus => Boolean(status) && typeof status === 'object' && typeof (status as CustomStatus).id === 'string' && typeof (status as CustomStatus).name === 'string').map((status, index) => ({
      id: status.id,
      name: status.name.trim(),
      ...(typeof status.description === 'string' && status.description.trim() ? { description: status.description.trim() } : {}),
      order: Number.isFinite(status.order) ? status.order : index + 1,
    })).filter((status) => status.name).sort((left, right) => left.order - right.order).map((status, index) => ({ ...status, order: index + 1 }))
    : []
  const categoryIds = new Set(categories.map((category) => category.id))
  const fieldTypes = new Map(categories.flatMap((category) => category.fields.map((field) => [field.id, field.type] as const)))
  const targets: CustomTarget[] = Array.isArray(candidate.targets)
    ? candidate.targets.filter((target): target is CustomTarget => Boolean(target) && typeof target === 'object' && typeof (target as CustomTarget).id === 'string' && typeof (target as CustomTarget).name === 'string' && CUSTOM_TARGET_TYPES.includes((target as CustomTarget).type)).map((target, index) => ({
      id: target.id,
      name: target.name.trim(),
      ...(typeof target.description === 'string' && target.description.trim() ? { description: target.description.trim() } : {}),
      type: target.type,
      targetValue: Number.isFinite(target.targetValue) && target.targetValue >= 0 ? target.targetValue : 0,
      ...(typeof target.categoryId === 'string' && categoryIds.has(target.categoryId) ? { categoryId: target.categoryId } : {}),
      ...(typeof target.fieldId === 'string' && fieldTypes.get(target.fieldId) === target.type ? { fieldId: target.fieldId } : {}),
      order: Number.isFinite(target.order) ? target.order : index + 1,
    })).filter((target) => target.name).sort((left, right) => left.order - right.order).map((target, index) => ({ ...target, order: index + 1 }))
    : []
  const defaultReportSections = DEFAULT_CUSTOM_REPORT_SECTIONS.map((section) => ({ ...section }))
  const reportSections: CustomReportSection[] = Array.isArray(candidate.reportSections)
    ? candidate.reportSections.filter((section): section is CustomReportSection => Boolean(section) && typeof section === 'object' && typeof (section as CustomReportSection).id === 'string' && typeof (section as CustomReportSection).name === 'string' && CUSTOM_REPORT_SECTION_TYPES.includes((section as CustomReportSection).type)).map((section, index) => ({
      id: section.id,
      name: section.name.trim(),
      ...(typeof section.description === 'string' && section.description.trim() ? { description: section.description.trim() } : {}),
      type: section.type,
      ...(typeof section.categoryId === 'string' && categoryIds.has(section.categoryId) ? { categoryId: section.categoryId } : {}),
      showInReport: section.showInReport !== false,
      order: Number.isFinite(section.order) ? section.order : index + 1,
    })).filter((section) => section.name).sort((left, right) => left.order - right.order).map((section, index) => ({ ...section, order: index + 1 }))
    : [...defaultReportSections, ...(targets.length > 0 ? [{ id: 'report-targets', name: 'Weekly Targets & Measurements', type: 'targets' as const, showInReport: true, order: defaultReportSections.length + 1 }] : [])]
  return {
    name: typeof candidate.name === 'string' && candidate.name.trim() ? candidate.name.trim() : DEFAULT_CUSTOM_TEMPLATE_CONFIG.name,
    description: typeof candidate.description === 'string' ? candidate.description : DEFAULT_CUSTOM_TEMPLATE_CONFIG.description,
    purpose: typeof candidate.purpose === 'string' && ['Personal', 'Business', 'Project', 'Operations', 'Education', 'Research', 'NGO', 'Other'].includes(candidate.purpose) ? candidate.purpose as CustomTemplateConfig['purpose'] : DEFAULT_CUSTOM_TEMPLATE_CONFIG.purpose,
    icon: typeof candidate.icon === 'string' && candidate.icon.trim() ? candidate.icon : DEFAULT_CUSTOM_TEMPLATE_CONFIG.icon,
    accent: typeof candidate.accent === 'string' && /^#[0-9a-f]{6}$/i.test(candidate.accent) ? candidate.accent : DEFAULT_CUSTOM_TEMPLATE_CONFIG.accent,
    categories,
    statuses,
    targets,
    reportSections,
  }
}

export function loadCustomTemplateConfig(workspaceId = getCurrentWorkspaceId()): CustomTemplateConfig {
  try {
    const key = getStorageKey(workspaceId)
    const saved = key ? window.localStorage.getItem(key) : null
    return saved ? normalizeConfig(JSON.parse(saved)) : { ...DEFAULT_CUSTOM_TEMPLATE_CONFIG }
  } catch {
    return { ...DEFAULT_CUSTOM_TEMPLATE_CONFIG }
  }
}

export function saveCustomTemplateConfig(config: CustomTemplateConfig, workspaceId = getCurrentWorkspaceId()) {
  try {
    const key = getStorageKey(workspaceId)
    if (!key) return
    window.localStorage.setItem(key, JSON.stringify(normalizeConfig(config)))
  } catch {
    // Configuration can be unavailable in restricted browsing modes.
  }
}
