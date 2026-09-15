import type { Workspace, WorkspaceWeekIdentity } from '../types/workspace'
import { createWorkspaceWeekIdentity, getWorkspaceWeekKey } from '../types/workspace'
import { getCurrentUser } from '../account'
import { supabase } from '../lib/supabase'

export const WORKSPACES_STORAGE_KEY = 'weekflow-workspaces'
export const CURRENT_WORKSPACE_STORAGE_KEY = 'weekflow-current-workspace'
export const DEFAULT_WORKSPACE_ID = 'default-workspace'
export const DEFAULT_WORKSPACE_NAME = 'Default workspace'
export const DEFAULT_ACCOUNT_ID = 'default-user'

let activeWorkspaceOwnerId: string | null = null

export function setWorkspaceOwner(ownerId: string | null) {
  activeWorkspaceOwnerId = ownerId?.trim() || null
}

export function clearWorkspaceOwnerLocalData(ownerId: string) {
  const ownerKey = (key: string) => `${key}:${ownerId}`
  let workspaceIds: string[] = []
  try {
    const stored = window.localStorage.getItem(ownerKey(WORKSPACES_STORAGE_KEY))
    const parsed: unknown = stored ? JSON.parse(stored) : []
    if (Array.isArray(parsed)) workspaceIds = parsed.flatMap((workspace) => typeof workspace?.id === 'string' ? [workspace.id] : [])
  } catch {
    // Continue removing the owner-scoped registry even if its contents are invalid.
  }

  const workspacePrefixes = workspaceIds.flatMap((workspaceId) => [
    `weekflow-weekly-plan:${workspaceId}:`,
    `weekflow-daily-activities:${workspaceId}:`,
    `weekflow-follow-ups:${workspaceId}:`,
    `weekflow-smart-start:${workspaceId}:`,
    `weekflow-report-history:${workspaceId}`,
    `weekflow-template:${workspaceId}`,
    `weekflow-selected-week:${workspaceId}`,
    `weekflow-week-selection-source:${workspaceId}`,
  ])
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index)
    if (key && (key === ownerKey(WORKSPACES_STORAGE_KEY) || key === ownerKey(CURRENT_WORKSPACE_STORAGE_KEY) || workspacePrefixes.some((prefix) => key.startsWith(prefix)))) {
      window.localStorage.removeItem(key)
    }
  }
}

function getOwnerStorageKey(key: string) {
  return activeWorkspaceOwnerId ? `${key}:${activeWorkspaceOwnerId}` : key
}

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
    window.localStorage.setItem(getOwnerStorageKey(WORKSPACES_STORAGE_KEY), JSON.stringify(workspaces))
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

export function loadWorkspaces(): Workspace[] {
  try {
    const saved = window.localStorage.getItem(getOwnerStorageKey(WORKSPACES_STORAGE_KEY))
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
    if (workspaces.length === 0) return []

    const hasDefaultWorkspace = workspaces.some((workspace) => workspace.id === DEFAULT_WORKSPACE_ID)
    if (!hasDefaultWorkspace && !activeWorkspaceOwnerId) {
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
  const storedId = window.localStorage.getItem(getOwnerStorageKey(CURRENT_WORKSPACE_STORAGE_KEY))
  const workspaces = loadWorkspaces()
  if (workspaces.length === 0) {
    window.localStorage.removeItem(getOwnerStorageKey(CURRENT_WORKSPACE_STORAGE_KEY))
    return null
  }
  const selectedWorkspace = storedId ? workspaces.find((workspace) => workspace.id === storedId) : undefined
  const fallbackWorkspace = selectedWorkspace ?? workspaces.find((workspace) => workspace.id === DEFAULT_WORKSPACE_ID) ?? workspaces[0]

  if (storedId !== fallbackWorkspace.id) {
    window.localStorage.setItem(getOwnerStorageKey(CURRENT_WORKSPACE_STORAGE_KEY), fallbackWorkspace.id)
  }

  return fallbackWorkspace.id
}

export function setCurrentWorkspaceId(workspaceId: string) {
  const workspace = getWorkspaceById(workspaceId)
  if (!workspace) return false
  try {
    window.localStorage.setItem(getOwnerStorageKey(CURRENT_WORKSPACE_STORAGE_KEY), workspace.id)
    window.dispatchEvent(new CustomEvent('weekflow-workspace-change', { detail: workspace.id }))
    return true
  } catch {
    return false
  }
}

function removeWorkspaceLocalData(workspaceIds: string[]) {
  const localPrefixes = workspaceIds.flatMap((workspaceId) => [
    `weekflow-weekly-plan:${workspaceId}:`,
    `weekflow-daily-activities:${workspaceId}:`,
    `weekflow-follow-ups:${workspaceId}:`,
    `weekflow-smart-start:${workspaceId}:`,
    `weekflow-report-history:${workspaceId}`,
    `weekflow-template:${workspaceId}`,
    `weekflow-selected-week:${workspaceId}`,
  ])

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index)
    if (key && localPrefixes.some((prefix) => key.startsWith(prefix))) window.localStorage.removeItem(key)
  }

  for (const workspaceId of workspaceIds) {
    const carryForwardKey = `weekflow-carry-forward-selection:${workspaceId}`
    window.sessionStorage.removeItem(carryForwardKey)
  }

  const pendingFollowUp = window.sessionStorage.getItem('weekflow-pending-follow-up')
  if (pendingFollowUp) {
    try {
      const parsed = JSON.parse(pendingFollowUp) as { workspaceId?: unknown }
      if (workspaceIds.includes(typeof parsed.workspaceId === 'string' ? parsed.workspaceId : '')) window.sessionStorage.removeItem('weekflow-pending-follow-up')
    } catch {
      // Leave an unrelated pending action untouched if its payload is invalid.
    }
  }

  if (workspaceIds.includes(DEFAULT_WORKSPACE_ID)) {
    const legacyPrefixes = ['weekflow-weekly-plan:', 'weekflow-daily-activities:', 'weekflow-follow-ups:', 'weekflow-smart-start:']
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index)
      if (key === 'weekflow-template' || key === 'weekflow-selected-week' || legacyPrefixes.some((prefix) => key?.startsWith(prefix) && !key.includes(':default-workspace:'))) {
        window.localStorage.removeItem(key as string)
      }
    }
  }
}

export async function deleteWorkspace(workspaceId: string) {
  const workspaces = loadWorkspaces()
  const workspace = workspaces.find((candidate) => candidate.id === workspaceId && !candidate.archived)
  if (!workspace) throw new Error('Workspace not found.')

  if (supabase) {
    const user = await getCurrentUser()
    if (!user || workspace.ownerId !== user.id) throw new Error('You can only delete a workspace you own.')

    if (workspace.cloudId) {
      const { data, error } = await supabase
        .from('workspaces')
        .delete()
        .eq('id', workspace.cloudId)
        .eq('owner_id', user.id)
        .select('id')

      if (error) throw error
      if (!data?.some((row) => row.id === workspace.cloudId)) throw new Error('The workspace could not be deleted from the account.')
    }
  }

  const remainingWorkspaces = workspaces.filter((candidate) => candidate.id !== workspace.id)
  const wasCurrent = getCurrentWorkspaceId() === workspace.id
  const nextWorkspace = wasCurrent ? remainingWorkspaces.find((candidate) => !candidate.archived) ?? remainingWorkspaces[0] ?? null : getCurrentWorkspace()
  saveWorkspaces(remainingWorkspaces)
  removeWorkspaceLocalData([workspace.id, ...(workspace.cloudId && workspace.cloudId !== workspace.id ? [workspace.cloudId] : [])])

  if (wasCurrent && nextWorkspace) {
    setCurrentWorkspaceId(nextWorkspace.id)
  } else if (wasCurrent) {
    window.localStorage.removeItem(getOwnerStorageKey(CURRENT_WORKSPACE_STORAGE_KEY))
    window.dispatchEvent(new CustomEvent('weekflow-workspace-change', { detail: null }))
  }

  return { deletedWorkspaceId: workspace.id, currentWorkspace: nextWorkspace }
}

export function getCurrentWorkspace() {
  const workspaceId = getCurrentWorkspaceId()
  return workspaceId ? getWorkspaceById(workspaceId) ?? null : null
}

export async function getCurrentCloudWorkspaceId() {
  if (!supabase) return null
  const user = await getCurrentUser()
  if (!user) return null

  const workspace = getCurrentWorkspace()
  if (!workspace) return null
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

export async function renameWorkspace(workspaceId: string, name: string) {
  const normalizedName = normalizeWorkspaceName(name)
  if (!normalizedName) throw new Error('Workspace name is required.')

  const workspace = loadWorkspaces().find((candidate) => candidate.id === workspaceId && !candidate.archived)
  if (!workspace) throw new Error('Workspace not found.')
  if (isWorkspaceNameTaken(normalizedName, workspace.id)) throw new Error('A workspace with this name already exists.')

  const updatedAt = createTimestamp()
  let nextWorkspace = { ...workspace, name: normalizedName, updatedAt }

  if (supabase) {
    const user = await getCurrentUser()
    if (!user || workspace.ownerId !== user.id) throw new Error('You can only rename a workspace you own.')

    if (workspace.cloudId) {
      const { data, error } = await supabase
        .from('workspaces')
        .update({ name: normalizedName, updated_at: updatedAt })
        .eq('id', workspace.cloudId)
        .eq('owner_id', user.id)
        .select('id, name, template_id, created_at, updated_at, archived')
        .maybeSingle()

      if (error) throw error
      if (!data) throw new Error('The workspace could not be renamed in the account.')
      nextWorkspace = {
        ...workspace,
        cloudId: data.id,
        ownerId: user.id,
        name: data.name,
        templateId: data.template_id,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
        archived: data.archived,
      }
    }
  }

  upsertWorkspace(nextWorkspace)
  window.dispatchEvent(new CustomEvent('weekflow-workspace-rename', { detail: nextWorkspace.id }))
  return nextWorkspace
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

export async function ensureFirstWorkspaceForOwner(ownerId: string, defaultName = 'My Workspace', templateId = 'personal') {
  if (!ownerId || !ownerId.trim()) return null

  const workspaces = loadWorkspaces().filter((workspace) => !workspace.archived)

  if (supabase) {
    const existingCloud = await supabase
      .from('workspaces')
      .select('id, name, template_id, created_at, updated_at, archived')
      .eq('owner_id', ownerId)
      .eq('archived', false)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => ({ data: data ?? [], error }))

    if (existingCloud.error) throw existingCloud.error
    if (existingCloud.data.length > 0) {
      const storedCurrentId = window.localStorage.getItem(getOwnerStorageKey(CURRENT_WORKSPACE_STORAGE_KEY))
      const localByCloudId = new Map(workspaces.filter((workspace) => workspace.cloudId).map((workspace) => [workspace.cloudId, workspace]))
      const localCurrentWorkspace = workspaces.find((workspace) => workspace.id === storedCurrentId)
      const reconciledWorkspaces = existingCloud.data.map((cloudWorkspace) => {
        const localWorkspace = localByCloudId.get(cloudWorkspace.id)
        return {
          id: localWorkspace?.id ?? cloudWorkspace.id,
          cloudId: cloudWorkspace.id,
          ownerId,
          name: cloudWorkspace.name,
          templateId: cloudWorkspace.template_id,
          createdAt: cloudWorkspace.created_at,
          updatedAt: cloudWorkspace.updated_at,
          archived: cloudWorkspace.archived,
        }
      })
      saveWorkspaces(reconciledWorkspaces)

      const selectedWorkspace = reconciledWorkspaces.find((workspace) => workspace.id === storedCurrentId)
        ?? (localCurrentWorkspace?.cloudId ? reconciledWorkspaces.find((workspace) => workspace.cloudId === localCurrentWorkspace.cloudId) : undefined)
        ?? reconciledWorkspaces[0]
      if (selectedWorkspace) setCurrentWorkspaceId(selectedWorkspace.id)
      return selectedWorkspace ?? reconciledWorkspaces[0]
    }
  }

  const currentWorkspace = getCurrentWorkspace()
  const preserveCurrentWorkspace = currentWorkspace?.ownerId === ownerId && !currentWorkspace.archived
  const existingOwnedWorkspace = workspaces.find((workspace) => workspace.ownerId === ownerId)
  if (existingOwnedWorkspace) {
    const workspaceToUse = preserveCurrentWorkspace ? currentWorkspace : existingOwnedWorkspace
    if (!preserveCurrentWorkspace) setCurrentWorkspaceId(workspaceToUse.id)
    return workspaceToUse
  }

  const localDefaultWorkspace = workspaces.find((workspace) => workspace.id === DEFAULT_WORKSPACE_ID && workspace.ownerId === DEFAULT_ACCOUNT_ID)
  if (localDefaultWorkspace) {
    const firstWorkspace = {
      ...localDefaultWorkspace,
      ownerId,
      name: defaultName,
      templateId,
      updatedAt: createTimestamp(),
    }
    upsertWorkspace(firstWorkspace)
    setCurrentWorkspaceId(firstWorkspace.id)
    return firstWorkspace
  }

  return null
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
