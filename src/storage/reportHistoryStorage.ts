import { supabase } from '../lib/supabase'
import type { ReportSnapshot } from '../utils/reportDocx'
import { getCurrentCloudWorkspaceId, getCurrentWorkspaceId } from './workspaceStorage'

export type ReportHistoryEntry = ReportSnapshot & {
  workspaceId: string
  generatedAt: string
  updatedAt: string
}

const STORAGE_PREFIX = 'weekflow-report-history:'

function getHistoryStorageKey(workspaceId = getCurrentWorkspaceId()) {
  return workspaceId ? `${STORAGE_PREFIX}${workspaceId}` : null
}

function isValidReportSnapshot(value: unknown): value is ReportSnapshot {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<ReportSnapshot>
  return typeof candidate.weekKey === 'string'
    && typeof candidate.weekLabel === 'string'
    && Boolean(candidate.plan)
    && Array.isArray(candidate.activities)
    && Array.isArray(candidate.followUps)
}

function normalizeReportHistoryEntry(value: unknown): ReportHistoryEntry | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<Record<string, unknown>>
  if (!isValidReportSnapshot(candidate as unknown)) return null
  if (typeof candidate.workspaceId !== 'string' || typeof candidate.generatedAt !== 'string' || typeof candidate.updatedAt !== 'string') return null

  return {
    weekKey: String(candidate.weekKey),
    weekLabel: String(candidate.weekLabel),
    workspaceName: typeof candidate.workspaceName === 'string' ? candidate.workspaceName : undefined,
    plan: candidate.plan as ReportSnapshot['plan'],
    activities: candidate.activities as ReportSnapshot['activities'],
    followUps: candidate.followUps as ReportSnapshot['followUps'],
    performance: candidate.performance as ReportSnapshot['performance'],
    template: candidate.template as ReportSnapshot['template'],
    reportMetadata: candidate.reportMetadata as ReportSnapshot['reportMetadata'],
    customReportConfig: candidate.customReportConfig as ReportSnapshot['customReportConfig'],
    workspaceId: candidate.workspaceId,
    generatedAt: candidate.generatedAt,
    updatedAt: candidate.updatedAt,
  }
}

export function loadReportHistoryEntries(workspaceId = getCurrentWorkspaceId()): ReportHistoryEntry[] {
  try {
    const key = getHistoryStorageKey(workspaceId)
    if (!key) return []
    const saved = window.localStorage.getItem(key)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeReportHistoryEntry)
      .filter((entry): entry is ReportHistoryEntry => entry !== null)
      .sort((left, right) => right.weekKey.localeCompare(left.weekKey))
  } catch {
    return []
  }
}

export function saveReportHistoryEntries(entries: ReportHistoryEntry[], workspaceId = getCurrentWorkspaceId()) {
  try {
    const key = getHistoryStorageKey(workspaceId)
    if (!key) return
    window.localStorage.setItem(key, JSON.stringify(entries))
  } catch {
    // Storage can be unavailable in private browsing or restricted environments.
  }
}

export async function loadReportHistoryEntriesAsync(workspaceId = getCurrentWorkspaceId()): Promise<ReportHistoryEntry[]> {
  if (!workspaceId) return []
  const localEntries = loadReportHistoryEntries(workspaceId)
  try {
    const cloudWorkspaceId = await getCurrentCloudWorkspaceId()
    if (!cloudWorkspaceId || !supabase) return localEntries

    const { data, error } = await supabase
      .from('report_history')
      .select('week_start, report_data, created_at, updated_at')
      .eq('workspace_id', cloudWorkspaceId)
      .order('week_start', { ascending: false })

    if (error) throw error
    if (!data) return localEntries

    const cloudEntries = data.map((row) => ({
      weekKey: row.week_start,
      weekLabel: row.report_data?.weekLabel ?? row.week_start,
      plan: row.report_data?.plan ?? { weekStart: row.week_start, weeklyStrategicObjectives: [], days: [], virtualEngagementPlan: [], keyAccountObjectives: [], commercialPriorities: [], successMeasures: [] },
      activities: Array.isArray(row.report_data?.activities) ? row.report_data.activities : [],
      followUps: Array.isArray(row.report_data?.followUps) ? row.report_data.followUps : [],
      performance: row.report_data?.performance,
      template: row.report_data?.template,
      reportMetadata: row.report_data?.reportMetadata,
      customReportConfig: row.report_data?.customReportConfig,
      workspaceId,
      generatedAt: row.created_at,
      updatedAt: row.updated_at,
    })) as ReportHistoryEntry[]

    if (cloudEntries.length > 0) {
      saveReportHistoryEntries(cloudEntries, workspaceId)
      return cloudEntries
    }

    return localEntries
  } catch {
    return localEntries
  }
}

export async function upsertReportHistoryEntry(snapshot: ReportSnapshot, workspaceId = getCurrentWorkspaceId()): Promise<ReportHistoryEntry> {
  if (!workspaceId) throw new Error('A workspace is required to save report history.')
  const entries = loadReportHistoryEntries(workspaceId)
  const existingIndex = entries.findIndex((entry) => entry.weekKey === snapshot.weekKey)
  const timestamp = new Date().toISOString()
  const nextEntry: ReportHistoryEntry = {
    ...snapshot,
    workspaceId,
    generatedAt: existingIndex >= 0 ? entries[existingIndex].generatedAt : timestamp,
    updatedAt: timestamp,
  }

  const nextEntries = existingIndex >= 0
    ? entries.map((entry, index) => index === existingIndex ? nextEntry : entry)
    : [nextEntry, ...entries]

  const ordered = nextEntries.sort((left, right) => right.weekKey.localeCompare(left.weekKey))
  saveReportHistoryEntries(ordered, workspaceId)

  try {
    const cloudWorkspaceId = await getCurrentCloudWorkspaceId()
    if (!cloudWorkspaceId || !supabase) return nextEntry

    const weekRecord = await supabase
      .from('workspace_weeks')
      .upsert({ workspace_id: cloudWorkspaceId, week_start: snapshot.weekKey }, { onConflict: 'workspace_id,week_start' })
    if (weekRecord.error) throw weekRecord.error

    const reportRecord = await supabase
      .from('report_history')
      .upsert({
        workspace_id: cloudWorkspaceId,
        week_start: snapshot.weekKey,
        report_data: { ...snapshot, template: snapshot.template ? { id: snapshot.template.id, name: snapshot.template.name, report: snapshot.template.report, terminology: snapshot.template.terminology } : undefined },
      }, { onConflict: 'workspace_id,week_start' })
    if (reportRecord.error) throw reportRecord.error
  } catch {
    // Keep the local snapshot even when cloud persistence is unavailable.
  }

  return nextEntry
}

export function getReportHistoryEntry(weekKey: string, workspaceId = getCurrentWorkspaceId()) {
  if (!workspaceId) return null
  return loadReportHistoryEntries(workspaceId).find((entry) => entry.weekKey === weekKey) ?? null
}
