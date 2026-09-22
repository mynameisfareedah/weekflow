import {
  EDUCATION_ASSESSMENT_STATUSES,
  EDUCATION_ASSESSMENT_TYPES,
  EDUCATION_TASK_STATUSES,
  EDUCATION_TASK_TYPES,
  type EducationAcademicTask,
  type EducationAssessment,
  type EducationAttendance,
  type EducationRecord,
} from '../types/educationRecords'
import { getCurrentCloudWorkspaceId, getCurrentWorkspace, getCurrentWorkspaceId, getWorkspaceScopedStorageKey } from './workspaceStorage'
import { supabase } from '../lib/supabase'

const STORAGE_PREFIX = 'weekflow-education-records:'
let educationWriteQueue: Promise<boolean> = Promise.resolve(true)
const educationCloudEnabled = Boolean(supabase) && import.meta.env.VITE_ENABLE_EDUCATION_RECORDS_CLOUD === 'true'

type RecordKind = EducationRecord['kind']

function getStorageKey(weekStart: string) {
  const workspaceId = getCurrentWorkspaceId()
  return workspaceId ? getWorkspaceScopedStorageKey(STORAGE_PREFIX, weekStart, workspaceId) : null
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === 'string' && values.includes(value)
}

function normalizeNonNegativeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : 0
}

function normalizeAttendance(value: unknown): EducationAttendance | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<EducationAttendance>
  if (candidate.kind !== 'attendance' || typeof candidate.id !== 'string' || typeof candidate.date !== 'string') return null
  const registeredLearners = normalizeNonNegativeNumber(candidate.registeredLearners)
  const present = normalizeNonNegativeNumber(candidate.present)
  if (present > registeredLearners) return null
  return {
    id: candidate.id,
    kind: 'attendance',
    date: candidate.date,
    classGroup: typeof candidate.classGroup === 'string' ? candidate.classGroup : '',
    courseProgramme: typeof candidate.courseProgramme === 'string' ? candidate.courseProgramme : '',
    registeredLearners,
    present,
    notes: typeof candidate.notes === 'string' ? candidate.notes : '',
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
  }
}

function normalizeTask(value: unknown): EducationAcademicTask | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<EducationAcademicTask>
  if (candidate.kind !== 'academic-task' || typeof candidate.id !== 'string' || typeof candidate.task !== 'string') return null
  if (!isOneOf(candidate.type, EDUCATION_TASK_TYPES) || !isOneOf(candidate.status, EDUCATION_TASK_STATUSES)) return null
  const expectedSubmissions = normalizeNonNegativeNumber(candidate.expectedSubmissions)
  const submissions = normalizeNonNegativeNumber(candidate.submissions)
  if (submissions > expectedSubmissions) return null
  return {
    id: candidate.id,
    kind: 'academic-task',
    task: candidate.task,
    type: candidate.type,
    classGroup: typeof candidate.classGroup === 'string' ? candidate.classGroup : '',
    courseProgramme: typeof candidate.courseProgramme === 'string' ? candidate.courseProgramme : '',
    assignedDate: typeof candidate.assignedDate === 'string' ? candidate.assignedDate : '',
    dueDate: typeof candidate.dueDate === 'string' ? candidate.dueDate : '',
    expectedSubmissions,
    submissions,
    status: candidate.status,
    notes: typeof candidate.notes === 'string' ? candidate.notes : '',
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
  }
}

function normalizeAssessment(value: unknown): EducationAssessment | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<EducationAssessment>
  if (candidate.kind !== 'assessment' || typeof candidate.id !== 'string' || typeof candidate.assessment !== 'string') return null
  if (!isOneOf(candidate.type, EDUCATION_ASSESSMENT_TYPES) || !isOneOf(candidate.status, EDUCATION_ASSESSMENT_STATUSES)) return null
  const learners = normalizeNonNegativeNumber(candidate.learners)
  const averageScore = typeof candidate.averageScore === 'number' && Number.isFinite(candidate.averageScore) && candidate.averageScore >= 0 && candidate.averageScore <= 100 ? candidate.averageScore : 0
  return {
    id: candidate.id,
    kind: 'assessment',
    assessment: candidate.assessment,
    type: candidate.type,
    classGroup: typeof candidate.classGroup === 'string' ? candidate.classGroup : '',
    courseProgramme: typeof candidate.courseProgramme === 'string' ? candidate.courseProgramme : '',
    date: typeof candidate.date === 'string' ? candidate.date : '',
    learners,
    averageScore,
    status: candidate.status,
    notes: typeof candidate.notes === 'string' ? candidate.notes : '',
    createdAt: typeof candidate.createdAt === 'string' ? candidate.createdAt : new Date().toISOString(),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString(),
  }
}

function normalizeRecord(value: unknown): EducationRecord | null {
  if (!value || typeof value !== 'object') return null
  const kind = (value as { kind?: unknown }).kind as RecordKind
  if (kind === 'attendance') return normalizeAttendance(value)
  if (kind === 'academic-task') return normalizeTask(value)
  if (kind === 'assessment') return normalizeAssessment(value)
  return null
}

function parseRecords(value: unknown) {
  return Array.isArray(value)
    ? value.map(normalizeRecord).filter((record): record is EducationRecord => record !== null)
    : []
}

function loadLocal(weekStart: string) {
  try {
    const key = getStorageKey(weekStart)
    const workspace = getCurrentWorkspace()
    if (!key || workspace?.templateId !== 'education') return []
    const saved = window.localStorage.getItem(key)
    return saved ? parseRecords(JSON.parse(saved)) : []
  } catch {
    return []
  }
}

function saveLocal(weekStart: string, records: EducationRecord[]) {
  try {
    const key = getStorageKey(weekStart)
    const workspace = getCurrentWorkspace()
    if (!key || workspace?.templateId !== 'education') return
    window.localStorage.setItem(key, JSON.stringify(records))
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

function hasLocalSnapshot(weekStart: string) {
  try {
    const key = getStorageKey(weekStart)
    return key ? window.localStorage.getItem(key) !== null : false
  } catch {
    return false
  }
}

export function loadEducationRecords(weekStart: string) {
  return loadLocal(weekStart)
}

export function saveEducationRecords(weekStart: string, records: EducationRecord[]) {
  saveLocal(weekStart, records)
}

export async function loadEducationRecordsAsync(weekStart: string): Promise<EducationRecord[]> {
  const localRecords = loadLocal(weekStart)
  try {
    if (!educationCloudEnabled) return localRecords
    const workspaceId = await getCurrentCloudWorkspaceId()
    if (!workspaceId || !supabase) return localRecords
    const { data, error } = await supabase.from('education_records').select('data').eq('workspace_id', workspaceId).eq('week_start', weekStart).maybeSingle()
    if (error) throw error
    if (hasLocalSnapshot(weekStart)) return localRecords
    return data?.data ? parseRecords(data.data) : localRecords
  } catch {
    return localRecords
  }
}

export async function saveEducationRecordsAsync(weekStart: string, records: EducationRecord[]): Promise<boolean> {
  saveLocal(weekStart, records)
  if (!educationCloudEnabled) return Promise.resolve(false)
  educationWriteQueue = educationWriteQueue.then(async () => {
    try {
      const workspaceId = await getCurrentCloudWorkspaceId()
      if (!workspaceId || !supabase) return false
      const weekRecord = await supabase.from('workspace_weeks').upsert({ workspace_id: workspaceId, week_start: weekStart }, { onConflict: 'workspace_id,week_start' })
      if (weekRecord.error) throw weekRecord.error
      const record = await supabase.from('education_records').upsert({ workspace_id: workspaceId, week_start: weekStart, data: records }, { onConflict: 'workspace_id,week_start' })
      if (record.error) throw record.error
      return true
    } catch {
      return false
    }
  })
  return educationWriteQueue
}
