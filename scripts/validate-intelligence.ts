import { deriveWeeklyIntelligence } from '../src/intelligence/intelligenceEngine.ts'
import { getSmartStartCandidates, mergeSmartStartSelections } from '../src/intelligence/smartStart.ts'
import { getWorkflowTemplateById } from '../src/config/templates.ts'
import type { DailyActivity } from '../src/types/dailyActivity.ts'
import type { FollowUp } from '../src/types/followUp.ts'
import type { WeeklyPlan } from '../src/types/weeklyPlan.ts'

const week = '2026-08-10'

function createEmptyWeeklyPlan(weekStart: string): WeeklyPlan {
  const labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const ids = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
  const categories = () => ({ facilities: [], hcps: [], primaryObjectives: [], virtualEngagements: [], accountObjectives: [], commercialPriorities: [], successMeasures: [] })
  return { weekStart, weeklyStrategicObjectives: [], days: ids.map((id, index) => ({ id, label: labels[index], date: weekStart, categories: categories() })), virtualEngagementPlan: [], keyAccountObjectives: [], commercialPriorities: [], successMeasures: [] }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function activity(id: string, account: string, intelligence: string, structuredOutcomes: DailyActivity['structuredOutcomes'] = [], nextAction = '', weekStart = week): DailyActivity {
  return { id, date: weekStart, weekStart, plannedActivityId: null, account, activityType: 'Physical Visit', hcpNames: [], outcome: '', intelligence, nextAction, structuredOutcomes, createdAt: weekStart, updatedAt: weekStart }
}

const augustActivities: DailyActivity[] = [
  activity('zytiga-1', 'RSUTH', 'Prescription identified.', [{ id: 'outcome-1', type: 'Prescription Generated', details: 'Prescription identified.', product: 'ZYTIGA', quantity: '1' }], 'Follow up NHIS access.'),
  activity('zytiga-2', 'UPTH', 'Prescription identified.', [{ id: 'outcome-2', type: 'Prescription Generated', details: 'Prescription identified.', product: 'ZYTIGA', quantity: '1' }], 'Patient is mobilising funds.'),
  activity('invega-1', 'Alpha Pharmacy', 'Stock depleted.', [{ id: 'outcome-3', type: 'Prescription Generated', details: 'Prescription identified.', product: 'INVEGA SUSTENNA', quantity: '1' }, { id: 'outcome-4', type: 'Stock Issue', details: 'INVEGA SUSTENNA 50 mg stock depleted.', product: 'INVEGA SUSTENNA', stockStatus: 'Stock depleted' }]),
  activity('shalom-1', 'Shalom', 'Approximately 8 patients identified.', [{ id: 'outcome-5', type: 'Patient Identified', details: 'approximately 8 Shalom patients' }]),
  activity('upth-1', 'UPTH', 'Approximately 4 prostate and 3 breast cancer patients; UPTH MDT opportunity.', [{ id: 'outcome-6', type: 'Patient Identified', details: 'approximately 4 prostate and 3 breast cancer patients' }, { id: 'outcome-7', type: 'MDT Opportunity', details: 'UPTH MDT opportunity' }], 'Validate patient numbers.'),
  activity('peter-odili-1', 'Peter Odili', 'Approximately 2 prostate and 2-3 breast cancer patients.', [{ id: 'outcome-8', type: 'Patient Identified', details: 'approximately 2 prostate and 2-3 breast cancer patients' }]),
  activity('rsuth-1', 'RSUTH', 'Approximately 2 RSUTH prostate cancer patients.', [{ id: 'outcome-9', type: 'Patient Identified', details: 'approximately 2 RSUTH prostate cancer patients' }]),
]

const augustPlan = createEmptyWeeklyPlan(week)
augustPlan.days[0].categories.facilities = [{ id: 'upth', text: 'UPTH' }, { id: 'rsuth', text: 'RSUTH' }, { id: 'unth', text: 'UNTH' }]
const augustFollowUps: FollowUp[] = [{ id: 'follow-up-1', weekKey: week, task: 'Follow up NHIS access', facility: 'RSUTH', priority: 'high', status: 'open', createdAt: week, updatedAt: week }]
const intelligence = deriveWeeklyIntelligence({ selectedWeek: week, plan: augustPlan, activities: augustActivities, followUps: augustFollowUps })

assert(intelligence.opportunitySignals.some((signal) => signal.title.includes('ZYTIGA')), 'ZYTIGA opportunity was not detected')
assert(intelligence.opportunitySignals.some((signal) => signal.title === 'Stock issue'), 'Stock issue was not detected')
assert(intelligence.opportunitySignals.some((signal) => signal.title === 'MDT opportunity'), 'MDT opportunity was not detected')
assert(intelligence.dataQualityWarnings.some((warning) => warning.title.includes('requires confirmation')), 'Patient confirmation warning was not detected')
assert(intelligence.followUpSuggestions.length === 1 && intelligence.followUpSuggestions[0].title === 'Validate patient numbers.', 'Actionable next-step suggestions were not detected or duplicate suppression failed')
assert(intelligence.planGaps.some((gap) => gap.item === 'UNTH' && gap.status === 'not evidenced'), 'UNTH plan gap was not detected')
assert(intelligence.reportReadiness.status === 'review', 'August fixture should require review')

const empty = deriveWeeklyIntelligence({ selectedWeek: week, plan: createEmptyWeeklyPlan(week), activities: [], followUps: [] })
assert(empty.reportReadiness.status === 'empty', 'Empty week did not return empty readiness')
assert(empty.reportReadiness.summary.includes("Your week hasn't started yet"), 'Empty week did not return the calm empty-state summary')
assert(empty.opportunitySignals.length === 0 && empty.recommendations.length === 0, 'Empty week produced false intelligence')

const plannedNoActivityPlan = createEmptyWeeklyPlan(week)
plannedNoActivityPlan.days[0].categories.facilities = [{ id: 'planned-upth', text: 'UPTH' }, { id: 'planned-rsuth', text: 'RSUTH' }]
const plannedNoActivity = deriveWeeklyIntelligence({ selectedWeek: week, plan: plannedNoActivityPlan, activities: [], followUps: [] })
assert(plannedNoActivity.reportReadiness.status === 'review', 'Planned week with no activity should require attention')
assert(plannedNoActivity.reportReadiness.summary.includes('no Daily Activity'), 'Planned week did not explain missing activity')

const partialPlan = createEmptyWeeklyPlan(week)
partialPlan.days[0].categories.facilities = [{ id: 'partial-upth', text: 'UPTH' }, { id: 'partial-rsuth', text: 'RSUTH' }, { id: 'partial-unth', text: 'UNTH' }]
const partial = deriveWeeklyIntelligence({ selectedWeek: week, plan: partialPlan, activities: [activity('partial-1', 'UPTH', 'Visit captured.')], followUps: [] })
assert(partial.reportReadiness.status === 'review', 'Partially completed week should require attention')
assert(partial.reportReadiness.plannedItemCount === 3 && partial.reportReadiness.capturedPlannedItemCount === 1, 'Partial planned-versus-actual counts were incorrect')

const readyPlan = createEmptyWeeklyPlan(week)
readyPlan.days[0].categories.facilities = [{ id: 'ready-upth', text: 'UPTH' }]
const ready = deriveWeeklyIntelligence({ selectedWeek: week, plan: readyPlan, activities: [activity('ready-1', 'UPTH', 'Visit captured.')], followUps: [] })
assert(ready.reportReadiness.status === 'ready', 'Sufficiently captured week should be ready to review')

const openFollowUp = deriveWeeklyIntelligence({ selectedWeek: week, plan: readyPlan, activities: [activity('follow-up-1', 'UPTH', 'Visit captured.')], followUps: [{ id: 'open-follow-up', weekKey: week, task: 'Review next step', facility: 'UPTH', priority: 'high', status: 'open', createdAt: week, updatedAt: week }] })
assert(openFollowUp.reportReadiness.status === 'ready' && openFollowUp.reportReadiness.openFollowUpCount === 1, 'Open follow-ups should remain visible without invalidating readiness')

const incompleteActivity = deriveWeeklyIntelligence({ selectedWeek: week, plan: createEmptyWeeklyPlan(week), activities: [activity('incomplete-1', 'UPTH', '')], followUps: [] })
assert(incompleteActivity.reportReadiness.status === 'review' && incompleteActivity.reportReadiness.warningCount > 0, 'Missing activity detail should require review')

const otherWeek = deriveWeeklyIntelligence({ selectedWeek: '2026-08-17', plan: createEmptyWeeklyPlan('2026-08-17'), activities: augustActivities, followUps: augustFollowUps })
assert(otherWeek.reportReadiness.status === 'empty' && otherWeek.opportunitySignals.length === 0, 'Week isolation failed')

const previousPlan = createEmptyWeeklyPlan(week)
previousPlan.weeklyStrategicObjectives = [{ id: 'objective-old', text: 'Prepare unresolved account review' }, { id: 'objective-skip', text: 'Another objective for later' }]
previousPlan.keyAccountObjectives = [{ id: 'account-old', account: 'UPTH', objectives: [{ id: 'account-objective-old', text: 'Confirm account pathway' }] }]
previousPlan.commercialPriorities = [{ id: 'priority-old', text: 'Resolve stock availability', opportunity: 'Stock recovery', account: 'UPTH', product: 'ZYTIGA' }]
previousPlan.successMeasures = [{ id: 'measure-old', text: 'Do not copy automatically' }]
const previousFollowUps: FollowUp[] = [
  { id: 'follow-open-old', weekKey: week, task: 'Review NHIS access', facility: 'RSUTH', hcpName: 'Dr Example', priority: 'high', status: 'open', notes: 'Bring access update', sourceActivityId: 'activity-old', dueDate: '2026-08-14', createdAt: week, updatedAt: week },
  { id: 'follow-completed-old', weekKey: week, task: 'Completed task', priority: 'normal', status: 'completed', createdAt: week, updatedAt: week },
]
const previousSnapshot = JSON.stringify({ plan: previousPlan, followUps: previousFollowUps })
const smartCandidates = getSmartStartCandidates(previousPlan, previousFollowUps)
assert(smartCandidates.length === 5, 'Smart Start candidate filtering returned the wrong items')
assert(!smartCandidates.some((candidate) => candidate.type === 'open-follow-up' && candidate.title === 'Completed task'), 'Completed follow-up was offered for carry-forward')
assert(!smartCandidates.some((candidate) => candidate.title === 'Do not copy automatically'), 'Success measure was offered for carry-forward')
const selectedSmartCandidates = smartCandidates.filter((candidate) => candidate.title !== 'Another objective for later')
const newWeek = '2026-08-17'
const merge = mergeSmartStartSelections(createEmptyWeeklyPlan(newWeek), newWeek, [], smartCandidates, selectedSmartCandidates.map((candidate) => candidate.key))
assert(merge.added === 4, 'Smart Start did not add each selected item exactly once')
assert(merge.plan.weeklyStrategicObjectives.length === 1 && merge.plan.weeklyStrategicObjectives[0].id !== 'objective-old', 'Weekly objective was not copied with a fresh ID')
assert(merge.plan.keyAccountObjectives[0].account === 'UPTH' && merge.plan.keyAccountObjectives[0].objectives[0].id !== 'account-objective-old', 'Account objective was not copied with a fresh ID')
assert(merge.plan.commercialPriorities[0].opportunity === 'Stock recovery' && merge.plan.commercialPriorities[0].product === 'ZYTIGA', 'Commercial priority metadata was not preserved')
assert(merge.followUps.length === 1 && merge.followUps[0].weekKey === newWeek && merge.followUps[0].id !== 'follow-open-old' && !merge.followUps[0].sourceActivityId && !merge.followUps[0].dueDate, 'Open follow-up was not safely scoped to the new week')
assert(JSON.stringify({ plan: previousPlan, followUps: previousFollowUps }) === previousSnapshot, 'Smart Start changed previous-week data')
const repeat = mergeSmartStartSelections(merge.plan, newWeek, merge.followUps, smartCandidates, selectedSmartCandidates.map((candidate) => candidate.key))
assert(repeat.added === 0, 'Smart Start duplicate protection failed')

const serviceWeek = '2026-09-09'
const serviceActivities: DailyActivity[] = [
  {
    id: 'service-1', date: serviceWeek, weekStart: serviceWeek, plannedActivityId: null, account: 'Benazir Org', activityType: 'Repair / Troubleshooting', hcpNames: ['Customer'], outcome: 'Issue unresolved', intelligence: 'Equipment is still down after reset and customer is concerned. SLA risk due to critical priority.', nextAction: 'Escalate to engineering and confirm SLA', structuredOutcomes: [{ id: 'so-1', type: 'Issue Unresolved', details: 'Issue remains unresolved', product: 'Other' }, { id: 'so-2', type: 'Escalation Required', details: 'Escalation required', product: 'Other' }], workOrderJob: 'WO-102', equipmentAsset: 'Generator-T12', issueProblem: 'Generator overheating', resolution: '', serviceStatus: 'Open', partsMaterialsUsed: 'No parts used', escalation: 'Engineering escalation pending', slaPriority: 'Critical priority', downtime: '6 hours', customerSignOff: '', createdAt: serviceWeek, updatedAt: serviceWeek,
  },
  {
    id: 'service-2', date: serviceWeek, weekStart: serviceWeek, plannedActivityId: null, account: 'Benazir Org', activityType: 'Repair / Troubleshooting', hcpNames: ['Customer'], outcome: 'Repeat issue captured', intelligence: 'Same equipment fault reported again. Safety concern due to heat build-up. Customer concern on service quality.', nextAction: 'Review parts requirement and service quality review.', structuredOutcomes: [{ id: 'so-3', type: 'Equipment Fault Identified', details: 'Same fault repeated on Generator-T12', product: 'Other' }, { id: 'so-4', type: 'Parts Required', details: 'Fan assembly needed', product: 'Other' }], workOrderJob: 'WO-103', equipmentAsset: 'Generator-T12', issueProblem: 'Generator overheating', resolution: 'Temporary reset performed', serviceStatus: 'Monitoring', partsMaterialsUsed: 'Fan assembly not yet installed', escalation: 'Escalation previously raised', slaPriority: 'Critical priority', downtime: '8 hours', customerSignOff: '', createdAt: serviceWeek, updatedAt: serviceWeek,
  },
  {
    id: 'service-3', date: serviceWeek, weekStart: serviceWeek, plannedActivityId: null, account: 'Site 24', activityType: 'Preventive Maintenance', hcpNames: ['Operations'], outcome: 'PM completed', intelligence: 'Preventive maintenance performed on compressor set and service quality review logged.', nextAction: 'Schedule next inspection', structuredOutcomes: [{ id: 'so-5', type: 'Preventive Maintenance Completed', details: 'Preventive maintenance completed', product: 'Other' }, { id: 'so-6', type: 'Customer Sign-off Obtained', details: 'Customer sign-off obtained', product: 'Other' }], equipmentAsset: 'Compressor-03', issueProblem: '', resolution: 'Routine maintenance complete', serviceStatus: 'Completed', partsMaterialsUsed: 'Filters replaced', escalation: '', slaPriority: 'Standard', downtime: '1 hour', customerSignOff: 'Signed', createdAt: serviceWeek, updatedAt: serviceWeek,
  },
]
const fieldServiceTemplate = getWorkflowTemplateById('field-service')
const serviceIntelligence = deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: createEmptyWeeklyPlan(serviceWeek), activities: serviceActivities, followUps: [], template: fieldServiceTemplate })
assert(serviceIntelligence.insights.risks.some((signal) => signal.title.includes('Unresolved service issue') || signal.detail.toLowerCase().includes('unresolved')), 'Field Service unresolved issue signal was not detected')
assert(serviceIntelligence.opportunitySignals.some((signal) => signal.title.toLowerCase() === 'recurring equipment problem' || signal.title.toLowerCase().includes('recurring equipment problem')), 'Field Service recurring equipment problem signal was not detected')
assert(serviceIntelligence.opportunitySignals.some((signal) => signal.title.toLowerCase().includes('escalation required')), 'Field Service escalation signal was not detected')
assert(serviceIntelligence.opportunitySignals.some((signal) => signal.title.toLowerCase().includes('downtime') || signal.reason.toLowerCase().includes('downtime')), 'Field Service downtime signal was not detected')
assert(serviceIntelligence.insights.risks.some((signal) => signal.title === 'Safety concern' && signal.detail.toLowerCase().includes('safety concern')), 'Field Service safety concern signal was not detected')
assert(serviceIntelligence.opportunitySignals.some((signal) => signal.title.toLowerCase().includes('repeat fault') || signal.title.toLowerCase().includes('equipment fault')), 'Field Service repeat-fault signal was not detected')
assert(serviceIntelligence.opportunitySignals.some((signal) => signal.title.toLowerCase().includes('preventive maintenance')), 'Field Service preventive maintenance opportunity was not detected')
assert(serviceIntelligence.insights.risks.some((signal) => signal.title === 'SLA risk' && (signal.detail.toLowerCase().includes('sla') || signal.detail.toLowerCase().includes('critical priority'))), 'Field Service SLA risk signal was not detected')
assert(serviceIntelligence.insights.deliverables.some((signal) => signal.title.toLowerCase().includes('parts') || signal.detail.toLowerCase().includes('parts')), 'Field Service parts requirement signal was not detected as service context')
assert(serviceIntelligence.insights.stakeholders.some((signal) => signal.title === 'Customer concern' && signal.detail.toLowerCase().includes('customer concern')), 'Field Service customer concern signal was not detected')
assert(serviceIntelligence.insights.stakeholders.some((signal) => signal.title === 'Customer concern' && signal.detail.toLowerCase().includes('service quality')), 'Field Service service quality signal was not detected')
assert(serviceIntelligence.insights.stakeholders.some((signal) => signal.title.toLowerCase().includes('customer sign-off') || signal.detail.toLowerCase().includes('customer')), 'Field Service customer sign-off signal was not detected')

const fieldSalesTemplate = getWorkflowTemplateById('field-sales')
const salesFixture: DailyActivity[] = [
  activity('sales-1', 'North Hospital', 'Prescription identified.', [{ id: 'sales-outcome-1', type: 'Prescription Generated', details: 'Prescription identified.', product: 'ZYTIGA', quantity: '1' }], 'Follow up NHIS access.', serviceWeek),
  activity('sales-2', 'Lakeside Clinic', 'Stock depleted in clinic.', [{ id: 'sales-outcome-2', type: 'Stock Issue', details: 'Stock depleted in clinic.', product: 'INVEGA SUSTENNA', stockStatus: 'Stock depleted' }], 'Confirm replenishment.', serviceWeek),
  activity('sales-3', 'Mercy Hospital', 'MDT held with oncology team.', [{ id: 'sales-outcome-3', type: 'MDT Opportunity', details: 'MDT held with oncology team.' }], 'Arrange follow-up referral.', serviceWeek),
]
const salesIsolation = deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: createEmptyWeeklyPlan(serviceWeek), activities: salesFixture, followUps: [], template: fieldSalesTemplate })
assert(!salesIsolation.opportunitySignals.some((signal) => signal.title.toLowerCase().includes('escalation required') || signal.title.toLowerCase().includes('downtime') || signal.title.toLowerCase().includes('equipment fault')), 'Field Sales received Field Service signals')
assert(salesIsolation.opportunitySignals.some((signal) => signal.title.toLowerCase().includes('stock issue') || signal.title.toLowerCase().includes('mdt opportunity') || signal.title.toLowerCase().includes('prescription identified')), 'Field Sales baseline signals were not available')

const serviceSignalTitles = ['unresolved service issue', 'repeat fault', 'recurring equipment problem', 'escalation required', 'downtime', 'safety concern', 'preventive maintenance', 'sla risk', 'parts required', 'customer concern', 'service quality']
const reverseIsolation = deriveWeeklyIntelligence({
  selectedWeek: serviceWeek,
  plan: createEmptyWeeklyPlan(serviceWeek),
  activities: [{
    id: 'service-like-sales-1',
    date: serviceWeek,
    weekStart: serviceWeek,
    plannedActivityId: null,
    account: 'Sales Account',
    activityType: 'Sales Activity',
    hcpNames: ['Rep'],
    outcome: 'Customer follow-up',
    intelligence: 'Customer concern on service quality and repeated safety risk with downtime and SLA pressure. Parts are discussed in the meeting.',
    nextAction: 'Maintain relationship and update the sales pipeline.',
    structuredOutcomes: [{ id: 'sales-service-1', type: 'Follow-up Required', details: 'Customer concern on service quality', product: 'ZYTIGA' }],
    createdAt: serviceWeek,
    updatedAt: serviceWeek,
  }],
  followUps: [],
  template: fieldSalesTemplate,
})
assert(!reverseIsolation.opportunitySignals.some((signal) => serviceSignalTitles.some((title) => signal.title.toLowerCase().includes(title))), 'Field Sales template incorrectly produced Field Service-specific intelligence from service-like text')
assert(!reverseIsolation.insights.risks.some((signal) => serviceSignalTitles.some((title) => signal.title.toLowerCase().includes(title))), 'Field Sales template incorrectly produced Field Service risk intelligence from service-like text')
assert(!reverseIsolation.insights.deliverables.some((signal) => signal.title.toLowerCase().includes('parts')), 'Field Sales template incorrectly produced Field Service parts intelligence')
assert(!reverseIsolation.insights.stakeholders.some((signal) => signal.title.toLowerCase().includes('customer concern') || signal.detail.toLowerCase().includes('service quality')), 'Field Sales template incorrectly produced Field Service customer service intelligence')

const freeTextLeakage = deriveWeeklyIntelligence({
  selectedWeek: serviceWeek,
  plan: createEmptyWeeklyPlan(serviceWeek),
  activities: [{
    id: 'neutral-free-text-1',
    date: serviceWeek,
    weekStart: serviceWeek,
    plannedActivityId: null,
    account: 'Neutral Site',
    activityType: 'Other',
    hcpNames: ['Team'],
    outcome: 'General meeting',
    intelligence: 'We discussed safety, spare parts, customer concern, service quality, SLA, and downtime in a general project review.',
    nextAction: 'Keep the team aligned.',
    structuredOutcomes: [],
    createdAt: serviceWeek,
    updatedAt: serviceWeek,
  }],
  followUps: [],
  template: fieldServiceTemplate,
})
assert(!freeTextLeakage.opportunitySignals.some((signal) => serviceSignalTitles.some((title) => signal.title.toLowerCase().includes(title))), 'Generic free-text leaked into Field Service intelligence')
assert(!freeTextLeakage.insights.risks.some((signal) => serviceSignalTitles.some((title) => signal.title.toLowerCase().includes(title))), 'Generic free-text leaked into Field Service risks')
assert(!freeTextLeakage.insights.deliverables.some((signal) => signal.title.toLowerCase().includes('parts')), 'Generic free-text leaked into Field Service parts intelligence')
assert(!freeTextLeakage.insights.stakeholders.some((signal) => signal.title.toLowerCase().includes('customer concern') || signal.detail.toLowerCase().includes('service quality')), 'Generic free-text leaked into Field Service customer intelligence')

const smallBusinessTemplate = getWorkflowTemplateById('small-business')
const smallBusinessOutcomes: Array<{ type: DailyActivity['structuredOutcomes'][number]['type']; category: string; account: string }> = [
  { type: 'Sale / Order Won', category: 'commercial', account: 'Test Customer' },
  { type: 'Lead Qualified', category: 'commercial', account: 'Test Opportunity' },
  { type: 'Customer Retained', category: 'stakeholders', account: 'Test Customer Retained' },
  { type: 'Payment Received', category: 'commercial', account: 'Test Payment' },
  { type: 'Supplier Issue Identified', category: 'risks', account: 'Test Supplier' },
  { type: 'Operational Improvement', category: 'progress', account: 'Test Business Area' },
  { type: 'Follow-up Required', category: 'stakeholders', account: 'Test Follow-up' },
]
const smallBusinessActivities = smallBusinessOutcomes.map((item, index) => activity(`small-business-${index}`, item.account, '', [{ id: `small-business-outcome-${index}`, type: item.type, details: `Synthetic ${item.type} evidence.` }], item.type === 'Follow-up Required' ? 'Follow up with Test Customer.' : '', serviceWeek))
const smallBusinessIntelligence = deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: createEmptyWeeklyPlan(serviceWeek), activities: smallBusinessActivities, followUps: [], template: smallBusinessTemplate })
for (const item of smallBusinessOutcomes) {
  const insight = smallBusinessIntelligence.insights[item.category as keyof typeof smallBusinessIntelligence.insights].find((signal) => signal.title === item.type)
  assert(Boolean(insight), `Small Business ${item.type} insight was not detected`)
  const signal = smallBusinessIntelligence.opportunitySignals.find((candidate) => candidate.account === item.account && candidate.title === item.type)
  assert(Boolean(signal), `Small Business ${item.type} opportunity signal was not detected`)
  assert(signal?.category === item.category, `Small Business ${item.type} category was incorrect`)
}
assert(smallBusinessIntelligence.opportunityScores.every((score) => score.score > 0), 'Small Business structured outcomes did not produce opportunity scores')
assert(smallBusinessIntelligence.followUpSuggestions.length === 1 && smallBusinessIntelligence.followUpSuggestions[0].title === 'Follow up with Test Customer.', 'Small Business follow-up outcome did not connect to follow-up intelligence')
const smallBusinessWithExistingFollowUp = deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: createEmptyWeeklyPlan(serviceWeek), activities: smallBusinessActivities, followUps: [{ id: 'small-business-follow-up', weekKey: serviceWeek, task: 'Follow up with Test Customer.', facility: 'Test Follow-up', priority: 'normal', status: 'open', sourceActivityId: 'small-business-6', createdAt: serviceWeek, updatedAt: serviceWeek }], template: smallBusinessTemplate })
assert(smallBusinessWithExistingFollowUp.followUpSuggestions.length === 0, 'Small Business follow-up intelligence duplicated an existing follow-up')

const smallBusinessOnlyActivities = smallBusinessActivities.filter((activity) => activity.structuredOutcomes[0]?.type !== 'Follow-up Required')
const smallBusinessFieldSalesIsolation = deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: createEmptyWeeklyPlan(serviceWeek), activities: smallBusinessOnlyActivities, followUps: [], template: fieldSalesTemplate })
assert(smallBusinessFieldSalesIsolation.opportunitySignals.length === 0, 'Small Business outcomes leaked into Field Sales opportunity signals')
assert(!smallBusinessFieldSalesIsolation.insights.patient.some((signal) => signal.account.startsWith('Test ')), 'Small Business outcomes leaked into Field Sales patient intelligence')
const fieldSalesSmallBusinessIsolation = deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: createEmptyWeeklyPlan(serviceWeek), activities: salesFixture, followUps: [], template: smallBusinessTemplate })
assert(fieldSalesSmallBusinessIsolation.opportunitySignals.length === 0, 'Field Sales outcomes leaked into Small Business opportunity signals')
assert(!fieldSalesSmallBusinessIsolation.insights.patient.some((signal) => signal.account === 'North Hospital'), 'Field Sales patient intelligence leaked into Small Business')
const fieldServiceOnlyActivities = serviceActivities.map((activity) => ({ ...activity, structuredOutcomes: activity.structuredOutcomes.filter((outcome) => outcome.type !== 'Follow-up Required') }))
const fieldServiceSmallBusinessIsolation = deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: createEmptyWeeklyPlan(serviceWeek), activities: fieldServiceOnlyActivities, followUps: [], template: smallBusinessTemplate })
assert(fieldServiceSmallBusinessIsolation.opportunitySignals.length === 0, 'Field Service outcomes leaked into Small Business opportunity signals')
const genericSmallBusinessText = deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: createEmptyWeeklyPlan(serviceWeek), activities: [activity('small-business-generic', 'Test Business Area', 'Had a productive meeting with the customer.', [], '', serviceWeek)], followUps: [], template: smallBusinessTemplate })
assert(!genericSmallBusinessText.opportunitySignals.some((signal) => signal.title === 'Sales opportunity'), 'Generic Small Business meeting text produced an unsupported sales opportunity')

console.log('Intelligence validation passed: August-pattern, empty-week, week-isolation, Smart Start merge checks, Field Service checks, Small Business outcome/scoring checks, and template isolation checks.')