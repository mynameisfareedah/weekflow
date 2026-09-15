import { getTemplateById, getWorkflowTemplateById } from '../config/templates.ts'
import { getCurrentWorkspaceId, getWorkspaceById } from './workspaceStorage'

export const TEMPLATE_STORAGE_KEY = 'weekflow-template'
export const DEFAULT_TEMPLATE_ID = 'field-sales'

function getWorkspaceTemplateStorageKey(workspaceId = getCurrentWorkspaceId()) {
  return workspaceId ? `${TEMPLATE_STORAGE_KEY}:${workspaceId}` : null
}

export function getSelectedTemplateId() {
  const workspaceId = getCurrentWorkspaceId()
  if (!workspaceId) return DEFAULT_TEMPLATE_ID
  const currentWorkspace = getWorkspaceById(workspaceId)
  const workspaceScopedValue = currentWorkspace && getTemplateById(currentWorkspace.templateId)?.id
  if (workspaceScopedValue) {
    return workspaceScopedValue
  }

  const workspaceKey = getWorkspaceTemplateStorageKey(workspaceId)
  const workspaceSpecificValue = workspaceKey ? window.localStorage.getItem(workspaceKey) : null
  if (workspaceSpecificValue && getTemplateById(workspaceSpecificValue)) {
    return workspaceSpecificValue
  }

  const legacyValue = window.localStorage.getItem(TEMPLATE_STORAGE_KEY)
  if (legacyValue && getTemplateById(legacyValue)) {
    return legacyValue
  }

  return DEFAULT_TEMPLATE_ID
}

export function getSelectedTemplate() {
  return getWorkflowTemplateById(getSelectedTemplateId())
}