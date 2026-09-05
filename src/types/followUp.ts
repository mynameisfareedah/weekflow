export const FOLLOW_UP_PRIORITIES = ['normal', 'high'] as const
export type FollowUpPriority = (typeof FOLLOW_UP_PRIORITIES)[number]

export const FOLLOW_UP_STATUSES = ['open', 'completed'] as const
export type FollowUpStatus = (typeof FOLLOW_UP_STATUSES)[number]

export interface FollowUp {
  id: string
  weekKey: string
  task: string
  facility?: string
  hcpName?: string
  dueDate?: string
  priority: FollowUpPriority
  status: FollowUpStatus
  notes?: string
  sourceActivityId?: string
  createdAt: string
  updatedAt: string
}

export interface FollowUpDraft {
  task: string
  facility: string
  hcpName: string
  dueDate: string
  priority: FollowUpPriority
  notes: string
  sourceActivityId?: string
}
