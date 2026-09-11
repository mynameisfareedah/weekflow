import { getTemplateById, getWorkflowTemplateById } from '../config/templates.ts'
import { DEFAULT_WORKSPACE_ID, ensureDefaultWorkspace, getCurrentWorkspaceId, getLegacyCompatibleWorkspaceId, getWorkspaceById, upsertWorkspace } from './workspaceStorage'

export const TEMPLATE_STORAGE_KEY = 'weekflow-template'
export const DEFAULT_TEMPLATE_ID = 'field-sales'

function getWorkspaceTemplateStorageKey(workspaceId = getCurrentWorkspaceId()) {
  return `${TEMPLATE_STORAGE_KEY}:${workspaceId}`
}

export function getSelectedTemplateId() {
  const workspaceId = getCurrentWorkspaceId()
  const currentWorkspace = getWorkspaceById(workspaceId)
  const workspaceScopedValue = currentWorkspace && getTemplateById(currentWorkspace.templateId)?.id
  if (workspaceScopedValue) {
    return workspaceScopedValue
  }

  const workspaceSpecificValue = window.localStorage.getItem(getWorkspaceTemplateStorageKey(workspaceId))
  if (workspaceSpecificValue && getTemplateById(workspaceSpecificValue)) {
    return workspaceSpecificValue
  }

  const legacyValue = window.localStorage.getItem(TEMPLATE_STORAGE_KEY)
  if (legacyValue && getTemplateById(legacyValue)) {
    return legacyValue
  }

  return DEFAULT_TEMPLATE_ID
}

export function saveSelectedTemplateId(templateId: string) {
  const template = getTemplateById(templateId)
  if (!template) return false

  const workspaceId = getCurrentWorkspaceId()
  const workspace = getWorkspaceById(workspaceId) ?? ensureDefaultWorkspace(template.id)
  const nextWorkspace = {
    ...workspace,
    templateId: template.id,
    updatedAt: new Date().toISOString(),
  }

  upsertWorkspace(nextWorkspace)
  window.localStorage.setItem(getWorkspaceTemplateStorageKey(workspaceId), template.id)

  if (workspaceId === getLegacyCompatibleWorkspaceId() || workspaceId === DEFAULT_WORKSPACE_ID) {
    window.localStorage.setItem(TEMPLATE_STORAGE_KEY, template.id)
  }

  return true
}

export function getSelectedTemplate() {
  return getWorkflowTemplateById(getSelectedTemplateId())
}