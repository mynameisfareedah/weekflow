export interface UserProfile {
  id: string
  displayName: string
  email: string
  createdAt: string
  updatedAt: string
}

export interface Workspace {
  id: string
  ownerId: string
  cloudId?: string
  name: string
  templateId: string
  createdAt: string
  updatedAt: string
  archived?: boolean
}

export interface WorkspaceState {
  currentWorkspaceId: string | null
  currentWorkspace: Workspace | null
  workspaces: Workspace[]
  selectWorkspace: (workspaceId: string) => void
  createWorkspace: (input: Pick<Workspace, 'name' | 'templateId' | 'ownerId'> & Partial<Pick<Workspace, 'id' | 'createdAt' | 'updatedAt' | 'archived'>>) => Workspace
}

export type WorkspaceWeekIdentity = {
  workspaceId: string
  weekStart: string
}

export function createWorkspaceWeekIdentity(workspaceId: string, weekStart: string): WorkspaceWeekIdentity {
  return { workspaceId, weekStart }
}

export function getWorkspaceWeekKey(workspaceId: string, weekStart: string): string {
  return `${workspaceId}:${weekStart}`
}
