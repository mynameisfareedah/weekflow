import { getTemplateById, getWorkflowTemplateById } from '../config/templates.ts'
import { getCurrentWorkspaceId, getWorkspaceById, shouldUseLegacyStorageFallback } from './workspaceStorage'
import { loadCustomTemplateConfig } from './customTemplateStorage'

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

  const legacyValue = shouldUseLegacyStorageFallback() ? window.localStorage.getItem(TEMPLATE_STORAGE_KEY) : null
  if (legacyValue && getTemplateById(legacyValue)) {
    return legacyValue
  }

  return DEFAULT_TEMPLATE_ID
}

export function getSelectedTemplate() {
  const template = getWorkflowTemplateById(getSelectedTemplateId())
  if (template.id !== 'custom') return template
  const config = loadCustomTemplateConfig()
  const workspace = getWorkspaceById(getCurrentWorkspaceId())
  return { ...template, name: config.name === 'Custom Workspace' && workspace?.name ? workspace.name : config.name }
}