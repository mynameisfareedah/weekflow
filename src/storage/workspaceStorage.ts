import type { Workspace, WorkspaceWeekIdentity } from '../types/workspace'
import { createWorkspaceWeekIdentity, getWorkspaceWeekKey } from '../types/workspace'
import { getCurrentUser } from '../account'
import { supabase } from '../lib/supabase'

export const WORKSPACES_STORAGE_KEY = 'weekflow-workspaces'
export const CURRENT_WORKSPACE_STORAGE_KEY = 'weekflow-current-workspace'
export const DEFAULT_WORKSPACE_ID = 'default-workspace'
export const DEFAULT_WORKSPACE_NAME = 'Default workspace'
export const DEFAULT_ACCOUNT_ID = 'default-user'

function createTimestamp() {
  return new Date().toISOString()
}

function normalizeWorkspace(value: unknown): Workspace | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<Workspace>
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || typeof candidate.templateId !== 'string') {
    return null
  }

  return {
    id: candidate.id,
    ownerId: typeof candidate.ownerId === 'string' ? candidate.ownerId : DEFAULT_ACCOUNT_ID,
    ...(typeof candidate.cloudId === 'string' ? { cloudId: candidate.cloudId } : {}),
    name: candidate.name,
    templateId: candidate.templateId,
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : createTimestamp(),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : createTimestamp(),
    archived: typeof candidate.archived === 'boolean' ? candidate.archived : false,
  }
}

export function createDefaultWorkspace(templateId: string = 'field-sales'): Workspace {
  const timestamp = createTimestamp()
  return {
    id: DEFAULT_WORKSPACE_ID,
    ownerId: DEFAULT_ACCOUNT_ID,
    name: DEFAULT_WORKSPACE_NAME,
    templateId,
    createdAt: timestamp,
    updatedAt: timestamp,
    archived: false,
  }
}

export function normalizeWorkspaceName(name: string) {
  return name.trim().replace(/\s+/g, ' ')
}

export function isWorkspaceNameTaken(name: string, excludeWorkspaceId?: string) {
  const normalizedName = normalizeWorkspaceName(name).toLowerCase()
  if (!normalizedName) return false

  return loadWorkspaces().some((workspace) => {
    if (workspace.id === excludeWorkspaceId || workspace.archived) return false
    return normalizeWorkspaceName(workspace.name).toLowerCase() === normalizedName
  })
}

export function saveWorkspaces(workspaces: Workspace[]) {
  try {
    window.localStorage.setItem(WORKSPACES_STORAGE_KEY, JSON.stringify(workspaces))
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

export function loadWorkspaces(): Workspace[] {
  try {
    const saved = window.localStorage.getItem(WORKSPACES_STORAGE_KEY)
    if (!saved) {
      const defaultWorkspace = createDefaultWorkspace()
      saveWorkspaces([defaultWorkspace])
      return [defaultWorkspace]
    }

    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) {
      const defaultWorkspace = createDefaultWorkspace()
      saveWorkspaces([defaultWorkspace])
      return [defaultWorkspace]
    }

    const workspaces = parsed.map(normalizeWorkspace).filter((workspace): workspace is Workspace => workspace !== null)
    if (workspaces.length === 0) {
      const defaultWorkspace = createDefaultWorkspace()
      saveWorkspaces([defaultWorkspace])
      return [defaultWorkspace]
    }

    const hasDefaultWorkspace = workspaces.some((workspace) => workspace.id === DEFAULT_WORKSPACE_ID)
    if (!hasDefaultWorkspace) {
      const defaultWorkspace = createDefaultWorkspace(workspaces[0]?.templateId ?? 'field-sales')
      const nextWorkspaces = [defaultWorkspace, ...workspaces]
      saveWorkspaces(nextWorkspaces)
      return nextWorkspaces
    }

    return workspaces
  } catch {
    const fallbackWorkspace = createDefaultWorkspace()
    saveWorkspaces([fallbackWorkspace])
    return [fallbackWorkspace]
  }
}

export function getWorkspaceById(workspaceId: string | null | undefined) {
  if (!workspaceId) return undefined
  return loadWorkspaces().find((workspace) => workspace.id === workspaceId)
}

export function getCurrentWorkspaceId() {
  const storedId = window.localStorage.getItem(CURRENT_WORKSPACE_STORAGE_KEY)
  const workspaces = loadWorkspaces()
  const selectedWorkspace = storedId ? workspaces.find((workspace) => workspace.id === storedId) : undefined
  const fallbackWorkspace = selectedWorkspace ?? workspaces.find((workspace) => workspace.id === DEFAULT_WORKSPACE_ID) ?? workspaces[0]

  if (!fallbackWorkspace) {
    const defaultWorkspace = createDefaultWorkspace()
    saveWorkspaces([defaultWorkspace])
    window.localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, defaultWorkspace.id)
    return defaultWorkspace.id
  }

  if (storedId !== fallbackWorkspace.id) {
    window.localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, fallbackWorkspace.id)
  }

  return fallbackWorkspace.id
}

export function setCurrentWorkspaceId(workspaceId: string) {
  const workspace = getWorkspaceById(workspaceId)
  if (!workspace) return false
  try {
    window.localStorage.setItem(CURRENT_WORKSPACE_STORAGE_KEY, workspace.id)
    window.dispatchEvent(new CustomEvent('weekflow-workspace-change', { detail: workspace.id }))
    return true
  } catch {
    return false
  }
}

export function getCurrentWorkspace() {
  return getWorkspaceById(getCurrentWorkspaceId()) ?? createDefaultWorkspace()
}

export async function getCurrentCloudWorkspaceId() {
  if (!supabase) return null
  const user = await getCurrentUser()
  if (!user) return null

  const workspace = getCurrentWorkspace()
  if (!workspace.cloudId) return null
  const { data, error } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', workspace.cloudId)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (error) throw error
  return data?.id ?? null
}

export function upsertWorkspace(workspace: Workspace) {
  const workspaces = loadWorkspaces()
  const nextWorkspaces = workspaces.some((candidate) => candidate.id === workspace.id)
    ? workspaces.map((candidate) => candidate.id === workspace.id ? workspace : candidate)
    : [workspace, ...workspaces]

  saveWorkspaces(nextWorkspaces)
  return workspace
}

export function createWorkspace(name: string, templateId: string, ownerId: string = DEFAULT_ACCOUNT_ID) {
  const timestamp = createTimestamp()
  const workspace: Workspace = {
    id: `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'workspace'}-${timestamp.slice(0, 10).replace(/-/g, '')}`,
    ownerId,
    name: name.trim() || 'Untitled workspace',
    templateId,
    createdAt: timestamp,
    updatedAt: timestamp,
    archived: false,
  }

  upsertWorkspace(workspace)
  setCurrentWorkspaceId(workspace.id)
  return workspace
}

export async function provisionWorkspaceInCloud(workspace: Workspace): Promise<Workspace> {
  if (!supabase) return workspace
  const user = await getCurrentUser()
  if (!user || workspace.ownerId !== user.id) return workspace
  if (workspace.cloudId) return workspace

  const existing = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .eq('name', workspace.name)
    .eq('template_id', workspace.templateId)
    .eq('archived', false)
    .maybeSingle()

  if (existing.error) throw existing.error
  let cloudId = existing.data?.id
  if (!cloudId) {
    const created = await supabase
      .from('workspaces')
      .insert({
        owner_id: user.id,
        name: workspace.name,
        template_id: workspace.templateId,
        archived: false,
      })
      .select('id')
      .single()
    if (created.error) throw created.error
    cloudId = created.data?.id
  }

  if (!cloudId) throw new Error('Supabase did not return a workspace identity.')
  const provisionedWorkspace = { ...workspace, cloudId, ownerId: user.id, updatedAt: new Date().toISOString() }
  upsertWorkspace(provisionedWorkspace)
  return provisionedWorkspace
}

export function ensureDefaultWorkspace(templateId: string = 'field-sales') {
  const workspaces = loadWorkspaces()
  const existingDefaultWorkspace = workspaces.find((workspace) => workspace.id === DEFAULT_WORKSPACE_ID)
  if (existingDefaultWorkspace) {
    const nextWorkspace = {
      ...existingDefaultWorkspace,
      ownerId: existingDefaultWorkspace.ownerId || DEFAULT_ACCOUNT_ID,
      archived: existingDefaultWorkspace.archived ?? false,
      templateId,
      updatedAt: createTimestamp(),
    }

    if (existingDefaultWorkspace.templateId !== templateId || existingDefaultWorkspace.ownerId !== DEFAULT_ACCOUNT_ID || existingDefaultWorkspace.archived !== false) {
      upsertWorkspace(nextWorkspace)
    }
    setCurrentWorkspaceId(DEFAULT_WORKSPACE_ID)
    return existingDefaultWorkspace.templateId === templateId && (existingDefaultWorkspace.ownerId || DEFAULT_ACCOUNT_ID) === DEFAULT_ACCOUNT_ID && (existingDefaultWorkspace.archived ?? false) === false ? existingDefaultWorkspace : nextWorkspace
  }

  const defaultWorkspace = createDefaultWorkspace(templateId)
  saveWorkspaces([defaultWorkspace, ...workspaces])
  setCurrentWorkspaceId(defaultWorkspace.id)
  return defaultWorkspace
}

export function createWorkspaceWeekScope(workspaceId: string, weekStart: string): WorkspaceWeekIdentity {
  return createWorkspaceWeekIdentity(workspaceId, weekStart)
}

export function getWorkspaceScopedStorageKey(storagePrefix: string, weekStart: string, workspaceId: string) {
  return `${storagePrefix}${getWorkspaceWeekKey(workspaceId, weekStart)}`
}

export function getLegacyCompatibleWorkspaceId() {
  return DEFAULT_WORKSPACE_ID
}

export function getLegacyCompatibleWorkspaceWeekKey(weekStart: string): WorkspaceWeekIdentity {
  return createWorkspaceWeekIdentity(DEFAULT_WORKSPACE_ID, weekStart)
}

export function getLegacyCompatibleStorageKey(storagePrefix: string, weekStart: string) {
  return `${storagePrefix}${weekStart}`
}
