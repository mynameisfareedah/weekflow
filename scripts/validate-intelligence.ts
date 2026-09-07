import { deriveWeeklyIntelligence } from '../src/intelligence/intelligenceEngine.ts'
import { getCarryForwardCandidateKey, mergeCarryForwardCandidates } from '../src/intelligence/smartStart.ts'
import type { CarryForwardCandidate } from '../src/intelligence/intelligenceTypes.ts'
import type { DailyActivity } from '../src/types/dailyActivity.ts'
import type { FollowUp } from '../src/types/followUp.ts'
import type { WeeklyPlan } from '../src/types/weeklyPlan.ts'

const week = '2026-08-10'

function createEmptyWeeklyPlan(weekStart: string): WeeklyPlan {
  const labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
  const ids = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const
  const categories = () => ({ facilities: [], hcps: [], primaryObjectives: [], virtualEngagements: [], accountObjectives: [], commercialPriorities: [], successMeasures: [] })
  return { weekStart, days: ids.map((id, index) => ({ id, label: labels[index], date: weekStart, categories: categories() })) }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function activity(id: string, account: string, intelligence: string, structuredOutcomes: DailyActivity['structuredOutcomes'] = [], nextAction = ''): DailyActivity {
  return { id, date: week, weekStart: week, plannedActivityId: null, account, activityType: 'Physical Visit', hcpNames: [], outcome: '', intelligence, nextAction, structuredOutcomes, createdAt: week, updatedAt: week }
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

const sourcePlan = createEmptyWeeklyPlan(week)
sourcePlan.days[0].categories.facilities.push({ id: 'source-item', text: 'Existing current-week account' })
const sourceSnapshot = JSON.stringify(sourcePlan)
const nextPlan = createEmptyWeeklyPlan('2026-08-17')
nextPlan.days[0].categories.accountObjectives.push({ id: 'existing-item', text: 'Validate UPTH patient numbers - UPTH' })
const carryCandidates: CarryForwardCandidate[] = [
  { title: 'Validate UPTH patient numbers', reason: 'Preliminary information requires confirmation.', category: 'patient', account: 'UPTH' },
  { title: 'Follow up NHIS access', reason: 'Open follow-up remains unfinished.', category: 'access-market', account: 'RSUTH' },
]
const merge = mergeCarryForwardCandidates(nextPlan, carryCandidates, [getCarryForwardCandidateKey(carryCandidates[0]), getCarryForwardCandidateKey(carryCandidates[1])], [
  { candidateKey: getCarryForwardCandidateKey(carryCandidates[0]), dayId: 'tuesday', category: 'primaryObjectives' },
  { candidateKey: getCarryForwardCandidateKey(carryCandidates[1]), dayId: 'thursday', category: 'accountObjectives' },
])
assert(merge.added === 1 && merge.existing === 1, 'Smart Start duplicate protection failed')
assert(merge.plan.days[3].categories.accountObjectives.some((item) => item.text.includes('Follow up NHIS access')), 'Approved carry-forward item was not added to its target day')
assert(merge.plan.days[0].categories.accountObjectives.length === 1, 'Duplicate carry-forward item was added')
assert(JSON.stringify(sourcePlan) === sourceSnapshot, 'Smart Start changed the source week')

console.log('Intelligence validation passed: August-pattern, empty-week, week-isolation, and Smart Start merge checks.')