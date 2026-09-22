import { buildReportComparison, validateReportComparison } from '../src/report/reportComparison.ts'
import type { ReportHistoryEntry } from '../src/storage/reportHistoryStorage.ts'
import type { WeeklyPlan } from '../src/types/weeklyPlan.ts'
import type { WeekFlowTemplate } from '../src/config/templates.ts'

const workspaceId = 'workspace-a'
const plan = (weekStart: string): WeeklyPlan => ({
  weekStart,
  weeklyStrategicObjectives: [{ id: `objective-${weekStart}`, text: 'Document progress' }],
  days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].map((id, index) => ({ id: id as WeeklyPlan['days'][number]['id'], label: id, date: weekStart, categories: { facilities: index === 0 ? [{ id: 'facility', text: 'Area' }] : [], hcps: [], primaryObjectives: [], virtualEngagements: [], accountObjectives: [], commercialPriorities: [], successMeasures: [] } })),
  virtualEngagementPlan: [], keyAccountObjectives: [], commercialPriorities: [], successMeasures: [],
})
const template = (id: string, name: string): WeekFlowTemplate => ({ id, name, terminology: {} as WeekFlowTemplate['terminology'], planningCategories: [], activityTypes: [], structuredOutcomes: { enabled: false, types: [] }, intelligence: { fallbackCategory: 'progress', structuredOutcomeCategories: {}, opportunityScoreWeights: {} }, activityFields: [], report: { title: `${name} Report`, sections: [] } })
const report = (weekKey: string, templateValue = template('personal', 'Personal Productivity'), workspace = workspaceId): ReportHistoryEntry => ({ weekKey, weekLabel: weekKey, plan: plan(weekKey), activities: [], followUps: [], template: templateValue, workspaceId: workspace, generatedAt: `${weekKey}T00:00:00.000Z`, updatedAt: `${weekKey}T00:00:00.000Z` })
const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message) }

const baseline = report('2026-09-07')
const comparison = report('2026-09-14')
assert(validateReportComparison(baseline, comparison, workspaceId).valid, 'same-template reports should compare')
const model = buildReportComparison(baseline, comparison, workspaceId)
assert(model.metrics.some((metric) => metric.key === 'activity-count'), 'universal activity metric missing')
assert(model.metrics.some((metric) => metric.key === 'planned-items' && metric.baseline.state === 'measured'), 'planned metric should preserve measured state')
assert(!validateReportComparison(baseline, baseline, workspaceId).valid, 'same report/week should be rejected')
assert(!validateReportComparison(baseline, report('2026-09-14', template('project-management', 'Project Management')), workspaceId).valid, 'different templates should be rejected')
assert(!validateReportComparison(baseline, comparison, 'workspace-b').valid, 'workspace mismatch should be rejected')
assert(!validateReportComparison({ ...baseline, template: undefined }, comparison, workspaceId).valid, 'missing template should be rejected')
assert(model.baseline.activities === baseline.activities && model.comparison.activities === comparison.activities, 'comparison must retain snapshot references')
console.log('Report comparison validation passed: compatibility, workspace/week/template guards, universal metrics, section model, and snapshot-only behavior.')
