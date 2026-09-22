import { FIELD_SALES_TEMPLATE } from '../config/templates'
import { saveDailyActivities } from '../storage/dailyActivityStorage'
import { upsertReportHistoryEntry } from '../storage/reportHistoryStorage'
import { loadWorkspaces, saveWorkspaces, setCurrentWorkspaceId, upsertWorkspace } from '../storage/workspaceStorage'
import { saveFollowUps } from '../storage/followUpsStorage'
import { saveWeeklyPlan, setSelectedWeekStart } from '../storage/weeklyPlanStorage'
import type { DailyActivity } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import type { WeeklyPlan } from '../types/weeklyPlan'

export const AUGUST_FIELD_SALES_TEST_WEEK_START = '2026-08-10'
export const AUGUST_FIELD_SALES_TEST_WORKSPACE_ID = 'weekflow-test-august-2026-field-sales'
export const AUGUST_FIELD_SALES_TEST_WORKSPACE_NAME = 'TEST: August 2026 Field Sales'
const PREVIOUS_FIXTURE_STATE_KEY = 'weekflow-test-previous-state'

function createEmptyWeeklyPlan(weekStart: string): WeeklyPlan {
  const labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const ids = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
  const categories = () => ({ facilities: [], hcps: [], primaryObjectives: [], virtualEngagements: [], accountObjectives: [], commercialPriorities: [], successMeasures: [] })
  return {
    weekStart,
    weeklyStrategicObjectives: [],
    days: ids.map((id, index) => ({ id, label: labels[index], date: weekStart, categories: categories() })),
    virtualEngagementPlan: [],
    keyAccountObjectives: [],
    commercialPriorities: [],
    successMeasures: [],
  }
}

function activity(id: string, account: string, intelligence: string, structuredOutcomes: DailyActivity['structuredOutcomes'] = [], nextAction = '', weekStart = AUGUST_FIELD_SALES_TEST_WEEK_START): DailyActivity {
  return {
    id,
    date: weekStart,
    weekStart,
    plannedActivityId: null,
    account,
    activityType: 'Physical Visit',
    hcpNames: [],
    outcome: '',
    intelligence,
    nextAction,
    structuredOutcomes,
    createdAt: weekStart,
    updatedAt: weekStart,
  }
}

export function getAugustFieldSalesFixture() {
  const weekStart = AUGUST_FIELD_SALES_TEST_WEEK_START
  const plan = createEmptyWeeklyPlan(weekStart)
  plan.days[0].categories.facilities = [{ id: 'upth', text: 'UPTH' }, { id: 'rsuth', text: 'RSUTH' }, { id: 'unth', text: 'UNTH' }]

  const activities: DailyActivity[] = [
    activity('zytiga-1', 'RSUTH', 'Prescription identified.', [{ id: 'outcome-1', type: 'Prescription Generated', details: 'Prescription identified.', product: 'ZYTIGA', quantity: '1' }], 'Follow up NHIS access.'),
    activity('zytiga-2', 'UPTH', 'Prescription identified.', [{ id: 'outcome-2', type: 'Prescription Generated', details: 'Prescription identified.', product: 'ZYTIGA', quantity: '1' }], 'Patient is mobilising funds.'),
    activity('invega-1', 'Alpha Pharmacy', 'Stock depleted.', [{ id: 'outcome-3', type: 'Prescription Generated', details: 'Prescription identified.', product: 'INVEGA SUSTENNA', quantity: '1' }, { id: 'outcome-4', type: 'Stock Issue', details: 'INVEGA SUSTENNA 50 mg stock depleted.', product: 'INVEGA SUSTENNA', stockStatus: 'Stock depleted' }]),
    activity('shalom-1', 'Shalom', 'Approximately 8 patients identified.', [{ id: 'outcome-5', type: 'Patient Identified', details: 'approximately 8 Shalom patients' }]),
    activity('upth-1', 'UPTH', 'Approximately 4 prostate and 3 breast cancer patients; UPTH MDT opportunity.', [{ id: 'outcome-6', type: 'Patient Identified', details: 'approximately 4 prostate and 3 breast cancer patients' }, { id: 'outcome-7', type: 'MDT Opportunity', details: 'UPTH MDT opportunity' }], 'Validate patient numbers.'),
    activity('peter-odili-1', 'Peter Odili', 'Approximately 2 prostate and 2-3 breast cancer patients.', [{ id: 'outcome-8', type: 'Patient Identified', details: 'approximately 2 prostate and 2-3 breast cancer patients' }]),
    activity('rsuth-1', 'RSUTH', 'Approximately 2 RSUTH prostate cancer patients.', [{ id: 'outcome-9', type: 'Patient Identified', details: 'approximately 2 RSUTH prostate cancer patients' }]),
  ]

  const followUps: FollowUp[] = [{ id: 'follow-up-1', weekKey: weekStart, task: 'Follow up NHIS access', facility: 'RSUTH', priority: 'high', status: 'open', createdAt: weekStart, updatedAt: weekStart }]

  return { weekStart, plan, activities, followUps }
}

function getPreviousFixtureState() {
  const raw = window.sessionStorage.getItem(PREVIOUS_FIXTURE_STATE_KEY)
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as {
      currentWorkspaceId: string | null
      selectedWeek: string | null
      selectedWeekSource: string | null
      workspaces: unknown[] | null
    }
  } catch {
    return null
  }
}

function persistPreviousFixtureState() {
  if (window.sessionStorage.getItem(PREVIOUS_FIXTURE_STATE_KEY)) return

  const currentWorkspaceId = window.localStorage.getItem('weekflow-current-workspace')
  const selectedWeek = currentWorkspaceId ? window.localStorage.getItem(`weekflow-selected-week:${currentWorkspaceId}`) : null
  const selectedWeekSource = currentWorkspaceId ? window.localStorage.getItem(`weekflow-week-selection-source:${currentWorkspaceId}`) : null
  const previousState = {
    currentWorkspaceId,
    selectedWeek,
    selectedWeekSource,
    workspaces: JSON.parse(window.localStorage.getItem('weekflow-workspaces') || '[]'),
  }
  window.sessionStorage.setItem(PREVIOUS_FIXTURE_STATE_KEY, JSON.stringify(previousState))
}

export function seedAugustFieldSalesTestWorkspace() {
  if (typeof window === 'undefined' || !('localStorage' in window) || !import.meta.env.DEV) return null

  persistPreviousFixtureState()

  const fixture = getAugustFieldSalesFixture()
  const workspace = {
    id: AUGUST_FIELD_SALES_TEST_WORKSPACE_ID,
    ownerId: '__weekflow_test__',
    name: AUGUST_FIELD_SALES_TEST_WORKSPACE_NAME,
    templateId: 'field-sales',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    archived: false,
  }

  const existingWorkspace = loadWorkspaces().find((candidate) => candidate.id === workspace.id)
  if (existingWorkspace) {
    upsertWorkspace({ ...existingWorkspace, ...workspace })
  } else {
    upsertWorkspace(workspace)
  }

  setCurrentWorkspaceId(workspace.id)
  setSelectedWeekStart(fixture.weekStart, 'explicit')
  saveWeeklyPlan(fixture.plan)
  saveDailyActivities(fixture.weekStart, fixture.activities)
  saveFollowUps(fixture.weekStart, fixture.followUps)

  const snapshot = {
    weekKey: fixture.weekStart,
    weekLabel: 'Aug 10 - Aug 16, 2026',
    workspaceName: workspace.name,
    plan: fixture.plan,
    activities: fixture.activities,
    followUps: fixture.followUps,
    template: FIELD_SALES_TEMPLATE,
  }

  void upsertReportHistoryEntry(snapshot, workspace.id)
  window.sessionStorage.setItem('weekflow-test-last-fixture', 'august-field-sales')

  return workspace
}

export function resetAugustFieldSalesTestWorkspace() {
  if (typeof window === 'undefined' || !('localStorage' in window) || !import.meta.env.DEV) return false

  const previousState = getPreviousFixtureState()
  const workspaces = loadWorkspaces().filter((candidate) => candidate.id !== AUGUST_FIELD_SALES_TEST_WORKSPACE_ID)
  const hadFixture = workspaces.length !== loadWorkspaces().length

  if (!hadFixture) {
    window.sessionStorage.removeItem('weekflow-test-last-fixture')
    window.sessionStorage.removeItem(PREVIOUS_FIXTURE_STATE_KEY)
    return true
  }

  saveWorkspaces(workspaces)
  const prefixes = [
    `weekflow-weekly-plan:${AUGUST_FIELD_SALES_TEST_WORKSPACE_ID}:`,
    `weekflow-daily-activities:${AUGUST_FIELD_SALES_TEST_WORKSPACE_ID}:`,
    `weekflow-follow-ups:${AUGUST_FIELD_SALES_TEST_WORKSPACE_ID}:`,
    `weekflow-report-history:${AUGUST_FIELD_SALES_TEST_WORKSPACE_ID}`,
    `weekflow-selected-week:${AUGUST_FIELD_SALES_TEST_WORKSPACE_ID}`,
    `weekflow-week-selection-source:${AUGUST_FIELD_SALES_TEST_WORKSPACE_ID}`,
  ]
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index)
    if (key && prefixes.some((prefix) => key.startsWith(prefix))) {
      window.localStorage.removeItem(key)
    }
  }

  const previousCurrentWorkspaceId = previousState?.currentWorkspaceId ?? 'default-workspace'
  const selectedWeek = previousState?.selectedWeek ?? null
  const selectedWeekSource = previousState?.selectedWeekSource ?? null

  if (previousCurrentWorkspaceId) {
    window.localStorage.setItem('weekflow-current-workspace', previousCurrentWorkspaceId)
  } else {
    window.localStorage.removeItem('weekflow-current-workspace')
  }

  if (previousCurrentWorkspaceId) {
    if (selectedWeek) {
      window.localStorage.setItem(`weekflow-selected-week:${previousCurrentWorkspaceId}`, selectedWeek)
    } else {
      window.localStorage.removeItem(`weekflow-selected-week:${previousCurrentWorkspaceId}`)
    }

    if (selectedWeekSource) {
      window.localStorage.setItem(`weekflow-week-selection-source:${previousCurrentWorkspaceId}`, selectedWeekSource)
    } else {
      window.localStorage.removeItem(`weekflow-week-selection-source:${previousCurrentWorkspaceId}`)
    }
  }

  window.sessionStorage.removeItem('weekflow-test-last-fixture')
  window.sessionStorage.removeItem(PREVIOUS_FIXTURE_STATE_KEY)
  return true
}

declare global {
  interface Window {
    __WEEKFLOW_TEST__?: {
      loadAugustFieldSales: typeof seedAugustFieldSalesTestWorkspace
      resetAugustFieldSales: typeof resetAugustFieldSalesTestWorkspace
    }
  }
}

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  window.__WEEKFLOW_TEST__ = {
    loadAugustFieldSales: seedAugustFieldSalesTestWorkspace,
    resetAugustFieldSales: resetAugustFieldSalesTestWorkspace,
  }
}
