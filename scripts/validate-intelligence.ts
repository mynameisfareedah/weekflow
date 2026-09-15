import { deriveWeeklyIntelligence } from '../src/intelligence/intelligenceEngine.ts'
import { deriveProjectPerformance } from '../src/report/projectPerformance.ts'
import { getSmartStartCandidates, mergeSmartStartSelections } from '../src/intelligence/smartStart.ts'
import { deriveNgoPerformance } from '../src/report/ngoPerformance.ts'
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

const ngoPreviousPlan = createEmptyWeeklyPlan('2026-09-14')
ngoPreviousPlan.weeklyStrategicObjectives = [{ id: 'ngo-objective-old', text: 'Complete unresolved outreach objective', successMeasure: 'Reach the partner group', priority: 'high' }]
ngoPreviousPlan.programmeActivities = [
  { id: 'ngo-programme-open', activity: 'Community mobilisation', target: '30 people', status: 'Planned' },
  { id: 'ngo-programme-complete', activity: 'Completed health session', target: '20 people', status: 'Completed' },
]
ngoPreviousPlan.communityEngagement = [{ id: 'ngo-engagement-open', communityGroup: 'Women 18–35', engagementActivity: 'Confirm outreach session', target: '30 people' }]
ngoPreviousPlan.volunteerPlan = [
  { id: 'ngo-volunteer-open', volunteer: 'Volunteer A', role: 'Registration', activity: 'Support outreach', status: 'Planned' },
  { id: 'ngo-volunteer-complete', volunteer: 'Volunteer B', role: 'Facilitation', activity: 'Completed session', status: 'Completed' },
]
ngoPreviousPlan.stakeholderPlan = [{ id: 'ngo-stakeholder-open', stakeholder: 'Local Health Centre', purpose: 'Referral support', actionRequired: 'Confirm referral contact', owner: 'Programme lead', due: '2026-09-20', status: 'Open' }]
ngoPreviousPlan.resourcesLogistics = [{ id: 'ngo-resource-open', resource: 'Educational flyers', required: '100', gap: '30 additional copies', action: 'Print additional copies' }]
ngoPreviousPlan.communicationsPlan = [{ id: 'ngo-communication-open', communication: 'Share outreach summary', audience: 'Programme team', channel: 'Email', status: 'Pending' }]
ngoPreviousPlan.documentationPlan = [{ id: 'ngo-documentation-open', documentation: 'Collect attendance evidence', required: 'Signed register', responsible: 'Programme lead', status: 'Pending' }]
ngoPreviousPlan.monitoringImpactTargets = [{ id: 'ngo-monitoring-open', kind: 'intended-outcomes', text: 'Increased awareness of community health issues' }]
const ngoPreviousFollowUps: FollowUp[] = [
  { id: 'ngo-follow-open', weekKey: '2026-09-14', task: 'Confirm referral contact', facility: 'Local Health Centre', priority: 'high', status: 'open', createdAt: '2026-09-14', updatedAt: '2026-09-14' },
  { id: 'ngo-follow-complete', weekKey: '2026-09-14', task: 'Completed stakeholder briefing', priority: 'normal', status: 'completed', createdAt: '2026-09-14', updatedAt: '2026-09-14' },
]
const ngoPreviousSnapshot = JSON.stringify({ plan: ngoPreviousPlan, followUps: ngoPreviousFollowUps })
const ngoCandidates = getSmartStartCandidates(ngoPreviousPlan, ngoPreviousFollowUps, 'ngo-community')
assert(ngoCandidates.length === 10, 'NGO Smart Start did not expose the expected unfinished planning candidates')
assert(!ngoCandidates.some((candidate) => candidate.title === 'Completed health session' || candidate.title === 'Completed session' || candidate.title === 'Completed stakeholder briefing'), 'Completed NGO work was offered for carry-forward')
assert(getSmartStartCandidates(ngoPreviousPlan, ngoPreviousFollowUps, 'field-sales').every((candidate) => !candidate.type.startsWith('ngo-')), 'NGO Smart Start candidates leaked into another template')
const ngoNextWeek = '2026-09-21'
const ngoMerge = mergeSmartStartSelections(createEmptyWeeklyPlan(ngoNextWeek), ngoNextWeek, [], ngoCandidates, ngoCandidates.map((candidate) => candidate.key))
assert(ngoMerge.added === 10, 'NGO Smart Start did not merge every selected planning candidate')
assert(ngoMerge.plan.weekStart === ngoNextWeek, 'NGO Smart Start did not scope the merged plan to the next week')
assert(ngoMerge.plan.programmeActivities?.every((item) => item.id !== 'ngo-programme-open') && ngoMerge.plan.programmeActivities?.some((item) => item.activity === 'Community mobilisation'), 'NGO programme activity was not copied with a fresh ID')
assert(ngoMerge.plan.volunteerPlan?.every((item) => item.id !== 'ngo-volunteer-complete'), 'Completed NGO volunteer planning was copied')
assert(ngoMerge.followUps.length === 1 && ngoMerge.followUps[0].id !== 'ngo-follow-open' && ngoMerge.followUps[0].weekKey === ngoNextWeek && ngoMerge.followUps[0].status === 'open', 'NGO open follow-up was not safely copied to the next week')
assert(JSON.stringify({ plan: ngoPreviousPlan, followUps: ngoPreviousFollowUps }) === ngoPreviousSnapshot, 'NGO previous-week data changed during Smart Start merge')

const ngoDashboardTemplate = getWorkflowTemplateById('ngo-community')
const ngoDashboardPlan = createEmptyWeeklyPlan('2026-09-14')
ngoDashboardPlan.weeklyStrategicObjectives = [{ id: 'dashboard-objective', text: 'Coordinate outreach sessions' }]
ngoDashboardPlan.programmeActivities = [{ id: 'dashboard-programme', activity: 'Community mobilisation', target: '30 people', status: 'Planned' }]
ngoDashboardPlan.monitoringImpactTargets = [{ id: 'dashboard-outcome', kind: 'intended-outcomes', text: 'Increased awareness' }]
const emptyNgoPerformance = deriveNgoPerformance(ngoDashboardPlan, [], [], '2026-09-14', ngoDashboardTemplate)
assert(emptyNgoPerformance.empty && emptyNgoPerformance.actualReach === null && emptyNgoPerformance.status === 'Insufficient evidence', 'Empty NGO dashboard state was not cautious')
const partialNgoDashboardActivity = activity('dashboard-partial', 'Community mobilisation', '', [], '', '2026-09-14')
partialNgoDashboardActivity.workPerformed = 'Delivered an introductory outreach visit.'
partialNgoDashboardActivity.actualResults = 'One introductory visit was recorded.'
const partialNgoPerformance = deriveNgoPerformance(ngoDashboardPlan, [partialNgoDashboardActivity], [], '2026-09-14', ngoDashboardTemplate)
assert(partialNgoPerformance.plannedActivities === 1 && partialNgoPerformance.completedActivities === 1 && partialNgoPerformance.actualReach === null, 'Partial NGO dashboard metrics confused actual delivery and reach')
assert(partialNgoPerformance.status === 'Insufficient evidence', 'Partial NGO dashboard status was not evidence-based')
const populatedNgoDashboardActivity = { ...partialNgoDashboardActivity, actualReach: '18', actualResults: '18 participants attended and completed the education session.', engagementResult: 'Participants engaged in discussion.', outcome: 'Participants engaged in discussion.', volunteer: 'Volunteer A', volunteerParticipation: 'Present', volunteerContribution: 'Supported registration.', stakeholder: 'Local Health Centre', stakeholderEngagement: 'Discussed referral coordination.', stakeholderResult: 'Referral coordination requirements were discussed.', resourceIssue: '30 additional copies required', resourceAction: 'Print additional copies' }
const populatedNgoPerformance = deriveNgoPerformance(ngoDashboardPlan, [populatedNgoDashboardActivity], [{ id: 'dashboard-follow-up', weekKey: '2026-09-14', task: 'Confirm referral contact', facility: 'Local Health Centre', priority: 'high', status: 'open', createdAt: '2026-09-14', updatedAt: '2026-09-14' }], '2026-09-14', ngoDashboardTemplate)
assert(populatedNgoPerformance.plannedReach === 30 && populatedNgoPerformance.actualReach === 18 && populatedNgoPerformance.reachVariance === -12, 'NGO dashboard reach variance was incorrect')
assert(populatedNgoPerformance.openFollowUps === 1 && populatedNgoPerformance.stakeholderEngagements === 1 && populatedNgoPerformance.resourceIssues.length > 0, 'NGO dashboard did not surface persisted follow-ups and evidence-backed issues')
assert(populatedNgoPerformance.status === 'Attention required', 'NGO dashboard status did not agree with the evidence-backed report assessment')

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

const personalTemplate = getWorkflowTemplateById('personal')
const personalWeek = '2026-08-11'
const personalPlan = createEmptyWeeklyPlan(personalWeek)
personalPlan.commercialPriorities = [{ id: 'personal-priority-1', text: 'Clean the study', opportunity: 'Personal focus', account: 'Home', product: 'Other', priority: 'high' }]
const personalActivities: DailyActivity[] = [
  { id: 'personal-activity-1', date: personalWeek, weekStart: personalWeek, plannedActivityId: null, account: 'Home', activityType: 'Task', hcpNames: [], outcome: '', workPerformed: 'Reviewed and sorted the home desk.', actualResults: 'The desk is clear and ready for next week.', timeSpent: '2h', dailySummary: 'A useful reset happened.', carryForward: '', intelligence: 'Desk reset went smoothly.', nextAction: 'Plan the next desk session.', structuredOutcomes: [], createdAt: personalWeek, updatedAt: personalWeek },
  { id: 'personal-activity-2', date: personalWeek, weekStart: personalWeek, plannedActivityId: null, account: 'Home', activityType: 'Task', hcpNames: [], outcome: '', workPerformed: 'Started the study cleanup.', actualResults: 'Still not complete enough for a final handoff.', timeSpent: '1h', dailySummary: '', carryForward: 'Clean the study', intelligence: 'The remaining work is small but visible.', nextAction: 'Finish the cleanup tomorrow.', structuredOutcomes: [], createdAt: personalWeek, updatedAt: personalWeek },
]
const personalFollowUps: FollowUp[] = [{ id: 'personal-follow-up-1', weekKey: personalWeek, task: 'Call the dentist', facility: 'Health', priority: 'high', status: 'open', createdAt: personalWeek, updatedAt: personalWeek }]
const personalIntelligence = deriveWeeklyIntelligence({ selectedWeek: personalWeek, plan: personalPlan, activities: personalActivities, followUps: personalFollowUps, template: personalTemplate })
assert(personalIntelligence.insights.progress.some((signal) => signal.title === 'Completed / Accomplished' && signal.detail.includes('desk')), 'Personal accomplishment signal was not detected')
assert(personalIntelligence.insights.progress.some((signal) => signal.title === 'Carry-forward work' && signal.detail.includes('Clean the study')), 'Personal carry-forward signal was not detected')
assert(personalIntelligence.insights.stakeholders.some((signal) => signal.title === 'Open follow-up' && signal.detail.includes('Call the dentist')), 'Personal open follow-up signal was not detected')
assert(personalIntelligence.insights.progress.some((signal) => signal.title === 'Time / effort pattern' && signal.detail.includes('3 hours')), 'Personal time/effort pattern was not detected')
assert(personalIntelligence.insights.risks.some((signal) => signal.title === 'Priority attention' && signal.detail.includes('Clean the study')), 'Personal priority-attention signal was not detected')
assert(personalIntelligence.insights.progress.some((signal) => signal.title === 'Next-step signal'), 'Personal next-step signal was not detected')

const genericCompleteActivity = activity('personal-generic-complete', 'Home', '', [], 'Complete the cleanup.', personalWeek)
genericCompleteActivity.actualResults = 'Complete'
const genericComplete = deriveWeeklyIntelligence({ selectedWeek: personalWeek, plan: createEmptyWeeklyPlan(personalWeek), activities: [genericCompleteActivity], followUps: [], template: personalTemplate })
assert(!genericComplete.insights.progress.some((signal) => signal.title === 'Completed / Accomplished'), 'Generic completion word alone was incorrectly treated as accomplishment evidence')

const personalMissingActivity = deriveWeeklyIntelligence({ selectedWeek: personalWeek, plan: createEmptyWeeklyPlan(personalWeek), activities: [], followUps: [], template: personalTemplate })
assert(personalMissingActivity.insights.progress.length === 0 && personalMissingActivity.insights.risks.length === 0 && personalMissingActivity.insights.stakeholders.length === 0, 'Empty Personal week fabricated personal intelligence')

const personalTimeOnly = deriveWeeklyIntelligence({ selectedWeek: personalWeek, plan: createEmptyWeeklyPlan(personalWeek), activities: [{ ...activity('personal-time-only', 'Home', '', [], 'Keep focus.', personalWeek), timeSpent: '12 hours', workPerformed: 'Focused on chores', actualResults: '', nextAction: 'Keep the day simple.' }], followUps: [], template: personalTemplate })
assert(personalTimeOnly.insights.progress.some((signal) => signal.title === 'Time / effort pattern' && signal.detail.includes('12 hours')), 'Personal time-only evidence was not surfaced as a factual time insight')
assert(!personalTimeOnly.insights.progress.some((signal) => signal.title === 'Completed / Accomplished'), 'Personal time-only evidence was incorrectly used as an accomplishment signal')

const reverseLeakingTemplate = deriveWeeklyIntelligence({ selectedWeek: personalWeek, plan: createEmptyWeeklyPlan(personalWeek), activities: personalActivities, followUps: personalFollowUps, template: getWorkflowTemplateById('field-sales') })
assert(reverseLeakingTemplate.insights.progress.length === 0 && reverseLeakingTemplate.insights.risks.length === 0 && reverseLeakingTemplate.insights.stakeholders.length === 0, 'Personal intelligence leaked into another template')

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

const projectManagementTemplate = getWorkflowTemplateById('project-management')
const pmPlan = createEmptyWeeklyPlan(serviceWeek)
pmPlan.virtualEngagementPlan = [{ id: 'pm-dependency', coverage: 'Deployment', priorityContacts: [], objective: 'Release deployment', dependency: 'Office access', status: 'Planned' }]
const pmActivities = [
  activity('pm-issue', 'QA Workstream', 'Connectivity issue identified.', [], '', serviceWeek),
  { ...activity('pm-risk', 'QA Workstream', '', [], '', serviceWeek), dailySummary: 'Vendor access may delay implementation.' },
  { ...activity('pm-blocked', 'QA Workstream', '', [], '', serviceWeek), workPerformed: 'Attempted configuration.', actualResults: 'Unable to proceed because required credentials were not available.' },
  { ...activity('pm-delayed', 'QA Workstream', '', [], '', serviceWeek), actualResults: 'Task was postponed due to unavailable access.' },
  { ...activity('pm-resource', 'QA Workstream', '', [], '', serviceWeek), dailySummary: 'Implementation is constrained by insufficient technical resources.' },
  { ...activity('pm-schedule', 'QA Workstream', '', [], '', serviceWeek), dailySummary: 'Friday delivery is at risk because the remaining work cannot be completed within the available time.' },
  { ...activity('pm-follow-up', 'QA Workstream', '', [], 'Confirm deployment approval.', serviceWeek) },
  { ...activity('pm-false-positive', 'QA Workstream', '', [], '', serviceWeek), timeSpent: '3', dailySummary: 'Estimated hours: 2. Time spent: 3.' },
  { ...activity('pm-normal-dependency', 'QA Workstream', '', [], '', serviceWeek), dailySummary: 'Dependency: Office access.' },
]
const pmIntelligence = deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: pmPlan, activities: pmActivities, followUps: [], template: projectManagementTemplate })
const pmKinds = pmIntelligence.projectSignals.map((signal) => signal.kind)
assert(pmKinds.includes('issue'), 'Project Management issue signal was not detected')
assert(pmKinds.includes('risk'), 'Project Management risk signal was not detected')
assert(pmKinds.includes('dependency-risk'), 'Project Management dependency risk signal was not detected')
assert(pmKinds.includes('dependency'), 'Project Management dependency signal was not detected')
assert(pmKinds.includes('blocked-work'), 'Project Management blocked-work signal was not detected')
assert(pmKinds.includes('delayed-work'), 'Project Management delayed-work signal was not detected')
assert(pmKinds.includes('resource-capacity'), 'Project Management resource concern was not detected')
assert(pmKinds.includes('schedule-risk'), 'Project Management schedule risk was not detected')
assert(pmKinds.includes('follow-up-required'), 'Project Management follow-up signal was not detected')
assert(!pmIntelligence.projectSignals.some((signal) => signal.sourceActivityId === 'pm-false-positive' || (signal.sourceActivityId === 'pm-normal-dependency' && ['risk', 'dependency-risk', 'blocked-work', 'delayed-work', 'issue'].includes(signal.kind))), 'Project Management false-positive protection failed')
assert(deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: pmPlan, activities: pmActivities, followUps: [], template: fieldSalesTemplate }).projectSignals.length === 0, 'Project Management signals leaked into Field Sales')

const performancePlan = createEmptyWeeklyPlan(serviceWeek)
performancePlan.weeklyStrategicObjectives = [
  { id: 'perf-1', text: 'Complete network assessment' },
  { id: 'perf-2', text: 'Resolve user IT issues' },
  { id: 'perf-3', text: 'Complete account review' },
  { id: 'perf-4', text: 'Update asset register' },
  { id: 'perf-5', text: 'Prepare status report' },
  { id: 'perf-6', text: 'Review access controls' },
  { id: 'perf-7', text: 'Confirm vendor handover' },
  { id: 'perf-8', text: 'Document support process' },
]
const performanceActivities = [
  { ...activity('perf-a1', 'Complete network assessment', '', [], '', serviceWeek), actualResults: 'Network assessment completed.' },
  { ...activity('perf-a2', 'Resolve user IT issues', '', [], '', serviceWeek), actualResults: 'Completed user IT issues.' },
  { ...activity('perf-a3', 'Complete account review', '', [], '', serviceWeek), progressStatus: 'Completed' },
  { ...activity('perf-a4', 'Update asset register', '', [], '', serviceWeek), dailySummary: 'Completed the asset register.' },
  { ...activity('perf-a5', 'Prepare status report', '', [], '', serviceWeek), outcome: 'Status report delivered and complete.' },
  { ...activity('perf-a6', 'Review access controls', '', [], '', serviceWeek), progressStatus: 'In progress' },
  { ...activity('perf-a7', 'Confirm vendor handover', '', [], '', serviceWeek), carryForward: 'Carry forward vendor handover.' },
  { ...activity('perf-a8', 'Document support process', '', [], '', serviceWeek), dailySummary: 'Work is underway and in progress.' },
]
const performanceIntelligence = deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: performancePlan, activities: performanceActivities, followUps: [], template: projectManagementTemplate })
const performance = deriveProjectPerformance(performancePlan, performanceActivities, [], performanceIntelligence)
assert(performance.plannedTasks === 8 && performance.completedTasks === 5 && performance.inProgressTasks === 2 && performance.carriedForwardTasks === 1, 'PM task performance counts were incorrect')
assert(performance.completionRate === 62.5, 'PM completion rate was incorrect')
const timePlan = createEmptyWeeklyPlan(serviceWeek)
timePlan.virtualEngagementPlan = [{ id: 'hours-1', coverage: 'Network', priorityContacts: [], objective: 'Assessment', estimatedHours: '20' }]
const timePerformance = deriveProjectPerformance(timePlan, [{ ...activity('hours-1', 'Network Assessment', '', [], '', serviceWeek), timeSpent: '18' }], [], deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: timePlan, activities: [], followUps: [], template: projectManagementTemplate }))
assert(timePerformance.plannedHours === 20 && timePerformance.actualHours === 18 && timePerformance.timeVariance === -2, 'PM favourable time variance was incorrect')
const overrunPerformance = deriveProjectPerformance(timePlan, [{ ...activity('hours-2', 'Network Assessment', '', [], '', serviceWeek), timeSpent: '25' }], [], deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: timePlan, activities: [], followUps: [], template: projectManagementTemplate }))
assert(overrunPerformance.timeVariance === 5 && overrunPerformance.issuesIdentified === 0 && overrunPerformance.activeRisks === 0, 'PM time overrun created a false issue or risk')
const emptyPerformance = deriveProjectPerformance(performancePlan, [], [], deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: performancePlan, activities: [], followUps: [], template: projectManagementTemplate }))
assert(emptyPerformance.completedTasks === 0 && emptyPerformance.objectives.every((objective) => objective.status === 'no-recorded-progress'), 'PM empty-week performance created false completion')
const followUpPerformance = deriveProjectPerformance(createEmptyWeeklyPlan(serviceWeek), [], [
  { id: 'perf-follow-1', weekKey: serviceWeek, task: 'One', priority: 'normal', status: 'completed', createdAt: serviceWeek, updatedAt: serviceWeek },
  { id: 'perf-follow-2', weekKey: serviceWeek, task: 'Two', priority: 'normal', status: 'completed', createdAt: serviceWeek, updatedAt: serviceWeek },
  { id: 'perf-follow-3', weekKey: serviceWeek, task: 'Three', priority: 'normal', status: 'completed', createdAt: serviceWeek, updatedAt: serviceWeek },
  { id: 'perf-follow-4', weekKey: serviceWeek, task: 'Four', priority: 'normal', status: 'open', createdAt: serviceWeek, updatedAt: serviceWeek },
  { id: 'perf-follow-5', weekKey: serviceWeek, task: 'Five', priority: 'normal', status: 'open', createdAt: serviceWeek, updatedAt: serviceWeek },
], deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: createEmptyWeeklyPlan(serviceWeek), activities: [], followUps: [], template: projectManagementTemplate }))
assert(followUpPerformance.followUpsCreated === 5 && followUpPerformance.followUpsCompleted === 3 && followUpPerformance.followUpsOutstanding === 2, 'PM follow-up performance counts were incorrect')

const ngoTemplate = getWorkflowTemplateById('ngo-community')
const ngoPlan = createEmptyWeeklyPlan(serviceWeek)
ngoPlan.programmeActivities = [{ id: 'ngo-programme-1', activity: 'Community mobilisation', programmeArea: 'Outreach', location: 'Gwagwalada', target: '30 people', plannedDate: 'Monday', status: 'Planned' }]
ngoPlan.monitoringImpactTargets = [{ id: 'ngo-outcome-1', kind: 'intended-outcomes', text: 'Increased awareness of women\'s health issues' }]
const ngoActivity: DailyActivity = {
  ...activity('ngo-activity-1', 'Community mobilisation', 'Participants requested additional information.', [], 'Confirm referral contact.', serviceWeek),
  plannedActivityId: 'programme:ngo-programme-1',
  workPerformed: 'Delivered a community health education session.',
  actualResults: '18 participants attended and completed the education session.',
  actualReach: '18',
  engagementResult: 'Participants engaged in discussion and requested additional information.',
  resourceIssue: '30 additional copies required',
  resourceAction: 'Print additional copies',
  stakeholder: 'Local Health Centre',
  stakeholderNextStep: 'Confirm referral contact.',
}
const ngoIntelligence = deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: ngoPlan, activities: [ngoActivity], followUps: [], template: ngoTemplate })
assert(ngoIntelligence.insights.risks.some((signal) => signal.title === 'Participation below target' && signal.detail.includes('18 participants reached against a planned target of 30')), 'NGO below-target signal was not detected')
assert(ngoIntelligence.insights.risks.some((signal) => signal.title === 'Resource / logistics issue'), 'NGO resource-gap signal was not detected')
assert(ngoIntelligence.insights.risks.some((signal) => signal.title === 'Outcome evidence pending'), 'NGO pending-outcome signal was not detected')
assert(ngoIntelligence.insights.stakeholders.some((signal) => signal.title === 'Stakeholder follow-up required'), 'NGO stakeholder follow-up signal was not detected')
assert(!ngoIntelligence.insights.risks.some((signal) => signal.title === 'Participation below target' && signal.detail.includes('30 participants reached')), 'NGO target was incorrectly reported as actual reach')
const ngoFalsePositive = deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: ngoPlan, activities: [{ ...activity('ngo-generic-1', 'Community meeting', '', [], '', serviceWeek), actualResults: 'Meeting completed successfully.' }], followUps: [], template: ngoTemplate })
assert(!ngoFalsePositive.insights.risks.some((signal) => signal.title === 'Resource / logistics issue' || signal.title === 'Participation below target'), 'NGO generic activity created a false issue or below-target risk')
assert(deriveWeeklyIntelligence({ selectedWeek: serviceWeek, plan: ngoPlan, activities: [ngoActivity], followUps: [], template: fieldSalesTemplate }).insights.risks.length === 0, 'NGO intelligence leaked into Field Sales')

console.log('Intelligence validation passed: August-pattern, empty-week, week-isolation, Smart Start merge checks, Field Service checks, Small Business outcome/scoring checks, and template isolation checks.')