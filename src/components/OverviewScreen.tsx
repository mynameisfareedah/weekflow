import { useMemo, useState } from 'react'
import { loadDailyActivities } from '../storage/dailyActivityStorage'
import { loadFollowUps } from '../storage/followUpsStorage'
import { getCurrentWeekStart, getNextWeekStart, loadWeeklyPlan, saveWeeklyPlan, setSelectedWeekStart } from '../storage/weeklyPlanStorage'
import { deriveWeeklyIntelligence } from '../intelligence/intelligenceEngine'
import type { WeeklyIntelligence } from '../intelligence/intelligenceTypes'
import { getCarryForwardCandidateKey, mergeCarryForwardCandidates } from '../intelligence/smartStart'
import type { DailyActivity, StructuredOutcome } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import type { CarryForwardCandidate, IntelligenceCategory, WeeklyInsight } from '../intelligence/intelligenceTypes'
import { PLAN_CATEGORIES, type DayId, type DayPlan, type PlanCategory, type WeeklyPlan } from '../types/weeklyPlan'
import { exportReportWord, getFixedReportWeekLabel } from '../utils/reportDocx'
import './OverviewScreen.css'

interface OverviewScreenProps {
  selectedWeek: string
  onNavigate: (screen: string) => void
}

interface OverviewData {
  plan: WeeklyPlan
  activities: DailyActivity[]
  followUps: FollowUp[]
  intelligence: WeeklyIntelligence
}

function formatWeekRange(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  const startLabel = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(start)
  const endLabel = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(end)
  return `${startLabel} - ${endLabel}`
}

function formatCompactWeekHeading(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  const format = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  return `${format.format(start).toUpperCase()} - ${format.format(end).toUpperCase()}`
}

function formatDayDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function getDayActivities(day: DayPlan, activities: DailyActivity[]) {
  return activities.filter((activity) => activity.date === day.date)
}

function countPlannedItems(plan: WeeklyPlan) {
  return plan.days.reduce((total, day) => total + day.categories.facilities.length + day.categories.virtualEngagements.length, 0)
}

function countUniqueHcps(activities: DailyActivity[]) {
  return new Set(activities.flatMap((activity) => activity.hcpNames)).size
}

function hasPlanContent(day: DayPlan) {
  return PLAN_CATEGORIES.some((category) => day.categories[category].length > 0)
}

function deriveOverviewData(selectedWeek: string): OverviewData {
  const plan = loadWeeklyPlan(selectedWeek)
  const activities = loadDailyActivities(selectedWeek)
  const followUps = loadFollowUps(selectedWeek)
  return { plan, activities, followUps, intelligence: deriveWeeklyIntelligence({ selectedWeek, plan, activities, followUps }) }
}

function getStatus(day: DayPlan, activities: DailyActivity[]) {
  const count = getDayActivities(day, activities).length
  if (count > 0) return 'Captured'
  if (hasPlanContent(day)) return 'In progress'
  return 'Not started'
}

function getPriorityFollowUps(followUps: FollowUp[]) {
  const today = new Date().toISOString().slice(0, 10)
  return followUps
    .filter((followUp) => followUp.status === 'open')
    .sort((left, right) => {
      const getRank = (followUp: FollowUp) => {
        if (followUp.priority === 'high') return 0
        if (followUp.dueDate && followUp.dueDate < today) return 1
        if (followUp.dueDate) return 2
        return 3
      }
      if (getRank(left) !== getRank(right)) return getRank(left) - getRank(right)
      if (!left.dueDate && !right.dueDate) return 0
      if (!left.dueDate) return 1
      if (!right.dueDate) return -1
      return left.dueDate.localeCompare(right.dueDate)
    })
    .slice(0, 3)
}

interface OutcomeCard {
  title: string
  detail?: string
}

interface KeyOutcomes {
  commercial: OutcomeCard[]
  patient: OutcomeCard[]
  market: OutcomeCard[]
}

function outcomeTitle(outcome: StructuredOutcome) {
  if (outcome.type === 'Prescription Generated') return `${outcome.quantity ?? '1'} ${outcome.product ?? 'Product'} prescription${outcome.quantity === '1' ? '' : 's'}`
  return outcome.type
}

function deriveKeyOutcomes(activities: DailyActivity[]): KeyOutcomes {
  const structuredOutcomes = activities.flatMap((activity) => activity.structuredOutcomes)
  const commercial = structuredOutcomes
    .filter((outcome) => outcome.type === 'Prescription Generated')
    .map((outcome) => ({ title: outcomeTitle(outcome), detail: outcome.details }))
  const patient = structuredOutcomes
    .filter((outcome) => outcome.type === 'Patient Identified')
    .map((outcome) => ({ title: outcome.details }))
  const market = structuredOutcomes
    .filter((outcome) => outcome.type === 'Stock Issue' || outcome.type === 'Patient Access / Access Barrier')
    .map((outcome) => ({ title: outcome.details }))
  const intelligence = activities.flatMap((activity) => {
    if (!activity.intelligence) return []
    const hasCoveredOutcome = activity.structuredOutcomes.some((outcome) => ['Patient Identified', 'Stock Issue', 'Prescription Generated'].includes(outcome.type))
    if (hasCoveredOutcome) return []
    const text = activity.intelligence.toLowerCase()
    const group = text.includes('patient') || text.includes('schizophrenia') ? 'patient' : 'market'
    const existing = group === 'patient' ? patient : market
    if (existing.some((card) => text.includes(card.title.toLowerCase()) || card.title.toLowerCase().includes(text))) return []
    return [{ group, card: { title: activity.intelligence } }]
  })
  for (const item of intelligence) {
    if (item.group === 'patient') patient.push(item.card)
    else market.push(item.card)
  }
  const uniqueCards = (cards: OutcomeCard[]) => cards.filter((card, index) => cards.findIndex((candidate) => candidate.title === card.title && candidate.detail === card.detail) === index)
  return { commercial: uniqueCards(commercial), patient: uniqueCards(patient), market: uniqueCards(market) }
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return <article className="overview-metric"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>
}

function SectionHeader({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) {
  return <div className="overview-section-header"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action && onAction && <button className="overview-text-action" type="button" onClick={onAction}>{action} <span aria-hidden="true">→</span></button>}</div>
}

const intelligenceCategoryLabels: Record<IntelligenceCategory, string> = {
  commercial: 'Commercial',
  patient: 'Patient Intelligence',
  'access-market': 'Access / Market',
  'strategic-accounts': 'Strategic Accounts',
  'scientific-engagement': 'Scientific Engagement',
}

const intelligenceCategoryOrder: IntelligenceCategory[] = ['commercial', 'patient', 'access-market', 'strategic-accounts', 'scientific-engagement']

function getTopInsights(insights: WeeklyIntelligence['insights']) {
  return intelligenceCategoryOrder.flatMap((category) => insights[category].slice(0, 2).map((insight) => ({ ...insight, category }))).slice(0, 6)
}

function getAttentionItems(intelligence: WeeklyIntelligence, followUps: FollowUp[]) {
  const followUpItems = followUps.filter((followUp) => followUp.status === 'open' && followUp.priority === 'high').slice(0, 3).map((followUp) => ({
    title: followUp.task,
    reason: 'This follow-up remains open and is marked high priority.',
    level: 'Priority',
    action: 'follow-ups',
  }))
  const warningItems = intelligence.dataQualityWarnings.slice(0, 3).map((warning) => ({
    title: warning.title,
    reason: warning.reason,
    level: 'Needs review',
    action: warning.sourceActivityId ? 'daily-activity' : 'follow-ups',
  }))
  const gapItems = intelligence.planGaps.filter((gap) => gap.status !== 'covered').slice(0, 3).map((gap) => ({
    title: gap.item,
    reason: gap.reason,
    level: gap.status === 'not evidenced' ? 'Needs review' : 'Moderate',
    action: 'weekly-plan',
  }))
  return [...followUpItems, ...warningItems, ...gapItems].filter((item, index, all) => all.findIndex((candidate) => candidate.title === item.title) === index).slice(0, 5)
}

const dayOptions: { id: DayId; label: string }[] = [
  { id: 'monday', label: 'Monday' },
  { id: 'tuesday', label: 'Tuesday' },
  { id: 'wednesday', label: 'Wednesday' },
  { id: 'thursday', label: 'Thursday' },
  { id: 'friday', label: 'Friday' },
]

const carryForwardCategoryLabels: Record<PlanCategory, string> = {
  facilities: 'Facilities / Accounts',
  hcps: 'HCPs / Stakeholders',
  primaryObjectives: 'Primary Objectives',
  virtualEngagements: 'Virtual Engagements',
  accountObjectives: 'Account-Specific Objectives',
  commercialPriorities: 'Commercial Priorities',
  successMeasures: 'Success Measures',
}

function defaultCandidateCategory(candidate: CarryForwardCandidate): PlanCategory {
  if (candidate.category === 'commercial') return 'commercialPriorities'
  if (candidate.category === 'scientific-engagement') return 'virtualEngagements'
  if (candidate.category === 'patient') return 'primaryObjectives'
  return 'accountObjectives'
}

export default function OverviewScreen({ selectedWeek, onNavigate }: OverviewScreenProps) {
  const { plan, activities, followUps, intelligence } = useMemo(() => deriveOverviewData(selectedWeek), [selectedWeek])
  const [isExporting, setIsExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const currentWeek = getCurrentWeekStart()
  const isHistorical = selectedWeek !== currentWeek
  const openFollowUps = followUps.filter((followUp) => followUp.status === 'open')
  const plannedItems = countPlannedItems(plan)
  const activeWorkdays = plan.days.filter((day) => getDayActivities(day, activities).length > 0).length
  const uniqueHcps = countUniqueHcps(activities)
  const priorityAccounts = unique(activities.map((activity) => activity.account)).length
  const progress = plannedItems > 0 ? Math.min(100, Math.round((activities.length / plannedItems) * 100)) : 0
  const today = new Date().toISOString().slice(0, 10)
  const selectedDay = plan.days.find((day) => day.date === today) ?? [...plan.days].reverse().find((day) => getDayActivities(day, activities).length > 0) ?? plan.days[plan.days.length - 1]
  const selectedDayActivities = getDayActivities(selectedDay, activities)
  const selectedDayPlanned = selectedDay.categories.facilities.length + selectedDay.categories.virtualEngagements.length
  const selectedDayFollowUps = openFollowUps.filter((followUp) => followUp.dueDate === selectedDay.date).length
  const priorityFollowUps = getPriorityFollowUps(followUps)
  const keyOutcomes = deriveKeyOutcomes(activities)
  const highPriorityFollowUps = openFollowUps.filter((followUp) => followUp.priority === 'high').length
  const reportReady = intelligence.reportReadiness.status !== 'empty'
  const isTrulyEmpty = plannedItems === 0 && activities.length === 0
  const carryForwardCandidates = intelligence.carryForwardCandidates
  const nextWeekStart = getNextWeekStart(selectedWeek)
  const defaultTargetDays = Object.fromEntries(carryForwardCandidates.map((candidate) => [getCarryForwardCandidateKey(candidate), 'monday'])) as Record<string, DayId>
  const defaultTargetCategories = Object.fromEntries(carryForwardCandidates.map((candidate) => [getCarryForwardCandidateKey(candidate), defaultCandidateCategory(candidate)])) as Record<string, PlanCategory>
  const [smartStartState, setSmartStartState] = useState<{ week: string; selected: string[]; targetDays: Record<string, DayId>; targetCategories: Record<string, PlanCategory>; showConfirmation: boolean; result: { added: number; existing: number } | null }>(() => ({ week: selectedWeek, selected: [], targetDays: defaultTargetDays, targetCategories: defaultTargetCategories, showConfirmation: false, result: null }))
  const smartStart = smartStartState.week === selectedWeek ? smartStartState : { week: selectedWeek, selected: [], targetDays: defaultTargetDays, targetCategories: defaultTargetCategories, showConfirmation: false, result: null }
  const { selected: selectedCarryForward, targetDays, targetCategories, showConfirmation: showStartConfirmation, result: carryForwardResult } = smartStart

  function updateSmartStart(changes: Partial<typeof smartStart>) {
    setSmartStartState({ ...smartStart, ...changes })
  }

  function toggleCarryForward(candidate: CarryForwardCandidate, selected: boolean) {
    const key = getCarryForwardCandidateKey(candidate)
    updateSmartStart({ selected: selected ? [...selectedCarryForward, key] : selectedCarryForward.filter((item) => item !== key) })
  }

  function prepareNextWeek() {
    const nextPlan = loadWeeklyPlan(nextWeekStart)
    const result = mergeCarryForwardCandidates(nextPlan, carryForwardCandidates, selectedCarryForward, carryForwardCandidates.map((candidate) => {
      const key = getCarryForwardCandidateKey(candidate)
      return { candidateKey: key, dayId: targetDays[key] ?? 'monday', category: targetCategories[key] ?? defaultCandidateCategory(candidate) }
    }))
    saveWeeklyPlan(result.plan)
    updateSmartStart({ result: { added: result.added, existing: result.existing }, showConfirmation: false })
  }

  async function handleExport() {
    setIsExporting(true)
    setExportMessage('')
    try {
      const result = await exportReportWord({
        weekKey: selectedWeek,
        weekLabel: getFixedReportWeekLabel(selectedWeek),
        plan,
        activities,
        followUps,
      })
      setExportMessage(`Downloaded ${result.filename}`)
    } catch {
      setExportMessage('Word export could not be completed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <main className={`overview-dashboard${intelligence.reportReadiness.status === 'empty' ? ' is-empty' : ''}`} id="overview">
      <header className="overview-week-header">
        <div>
          <p className="eyebrow">{isHistorical ? 'Historical week' : 'Current work week'}</p>
          <h1>Week of {formatCompactWeekHeading(selectedWeek)}</h1>
          <p>{isHistorical ? 'Historical week' : 'Current week'} · Monday - Friday</p>
          {isTrulyEmpty && <p className="overview-empty-week-note">Your week hasn&apos;t started yet.</p>}
        </div>
        <div className="overview-week-actions">
          <button className="button button-secondary" type="button" onClick={() => onNavigate('weekly-plan')}>{intelligence.reportReadiness.status === 'empty' ? 'Open Weekly Plan' : 'View Weekly Plan'}</button>
          <button className="button button-primary" type="button" onClick={() => onNavigate('daily-activity')}>{intelligence.reportReadiness.status === 'empty' ? 'Record Activity' : 'Continue Daily Activity'} <span aria-hidden="true">→</span></button>
        </div>
      </header>

      <section className="overview-metrics" aria-label="Weekly metrics">
        <MetricCard label="Activities" value={activities.length} />
        <MetricCard label="HCP engagements" value={uniqueHcps} />
        <MetricCard label="Open follow-ups" value={openFollowUps.length} />
        <MetricCard label="Report" value={reportReady ? 'Ready' : 'Not ready'} />
      </section>

      <div className={`overview-grid overview-main-grid${isTrulyEmpty ? ' is-empty' : ''}`}>
        {!isTrulyEmpty && <section className="overview-panel overview-progress-panel">
          <SectionHeader eyebrow="Week at a glance" title="Field execution" />
          <div className="overview-progress-label"><strong>{activities.length} of {plannedItems} planned account items captured</strong><span>{progress}%</span></div>
          <div className="overview-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Weekly field activity progress"><span style={{ width: `${progress}%` }} /></div>
          <div className="overview-supporting-stats"><span>{activeWorkdays} active workday{activeWorkdays === 1 ? '' : 's'}</span><span>{uniqueHcps} HCP engagements</span><span>{priorityAccounts} account record{priorityAccounts === 1 ? '' : 's'}</span></div>
        </section>}

        <section className="overview-panel overview-selected-day">
          <SectionHeader eyebrow="Today" title={selectedDay.label} action="Open Today&apos;s Work" onAction={() => onNavigate('daily-activity')} />
          <div className="overview-day-heading"><strong>{selectedDay.label}</strong><span>{formatDayDate(selectedDay.date)}</span></div>
          <div className="overview-today-stats"><span><small>Planned</small><strong>{selectedDayPlanned}</strong></span><span><small>Completed</small><strong>{selectedDayActivities.length}</strong></span><span><small>Follow-ups</small><strong>{selectedDayFollowUps}</strong></span></div>
          {selectedDayPlanned === 0 && selectedDayActivities.length === 0 && <p className="overview-today-empty">No work is planned for this day yet.</p>}
        </section>
      </div>

      <section className={`overview-intelligence-panel${intelligence.reportReadiness.status === 'empty' ? ' is-empty' : ''}`} aria-labelledby="intelligence-heading">
        <div className="overview-intelligence-heading"><div><p className="eyebrow">WeekFlow Intelligence</p><h2 id="intelligence-heading">{intelligence.reportReadiness.status === 'empty' ? 'Start with the work already planned' : 'What needs attention'}</h2><p>{intelligence.reportReadiness.status === 'empty' ? 'Insights and recommendations will appear as activity is captured.' : intelligence.reportReadiness.summary}</p></div><span className={`intelligence-status ${intelligence.reportReadiness.status}`}>{intelligence.reportReadiness.status}</span></div>
        {intelligence.reportReadiness.status === 'empty' ? <div className="intelligence-empty-actions"><button className="button button-secondary" type="button" onClick={() => onNavigate('weekly-plan')}>Review Weekly Plan</button><button className="button button-primary" type="button" onClick={() => onNavigate('daily-activity')}>Record Activity</button></div> : <div className="overview-intelligence-grid">
          <section className="intelligence-column" aria-labelledby="happening-heading"><h3 id="happening-heading">What&apos;s happening</h3>{getTopInsights(intelligence.insights).length > 0 ? <ul className="intelligence-insight-list">{getTopInsights(intelligence.insights).map((insight: WeeklyInsight) => <li key={`${insight.category}-${insight.account}-${insight.title}-${insight.detail}`}><span className="intelligence-category">{intelligenceCategoryLabels[insight.category]}</span><strong>{insight.title}</strong><p>{insight.account}: {insight.detail}</p></li>)}</ul> : <p className="intelligence-muted">No derived insights yet.</p>}</section>
          <section className="intelligence-column" aria-labelledby="attention-heading"><h3 id="attention-heading">What needs attention</h3>{getAttentionItems(intelligence, followUps).length > 0 ? <ul className="intelligence-attention-list">{getAttentionItems(intelligence, followUps).map((item) => <li key={`${item.title}-${item.action}`}><span className={`intelligence-level ${item.level.toLowerCase().replace(' ', '-')}`}>{item.level}</span><div><strong>{item.title}</strong><p>{item.reason}</p><button type="button" onClick={() => onNavigate(item.action)}>Review <span aria-hidden="true">→</span></button></div></li>)}</ul> : <p className="intelligence-muted">Nothing needs attention right now.</p>}</section>
          <section className="intelligence-column" aria-labelledby="next-heading"><h3 id="next-heading">What should happen next</h3>{intelligence.recommendations.length > 0 ? <ol className="intelligence-recommendation-list">{intelligence.recommendations.slice(0, 5).map((recommendation, index) => <li key={`${recommendation.title}-${recommendation.account ?? ''}`}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{recommendation.title}</strong><p>{recommendation.reason}</p></div></li>)}</ol> : <p className="intelligence-muted">Recommendations will appear as activity is captured.</p>}</section>
        </div>}
      </section>

      {carryForwardCandidates.length > 0 && <section className="overview-panel smart-start-panel" aria-labelledby="smart-start-heading">
        <div className="overview-section-header"><div><p className="eyebrow">Continue unfinished work</p><h2 id="smart-start-heading">Smart Start Next Week</h2><p className="smart-start-intro">Review unresolved work from this week and choose what belongs in the next week&apos;s plan. Nothing is added until you confirm.</p></div><span className="smart-start-count">{carryForwardCandidates.length} item{carryForwardCandidates.length === 1 ? '' : 's'}</span></div>
        <div className="smart-start-toolbar"><button className="overview-text-action" type="button" onClick={() => updateSmartStart({ selected: carryForwardCandidates.map(getCarryForwardCandidateKey) })}>Select all</button><button className="overview-text-action" type="button" onClick={() => updateSmartStart({ selected: [] })}>Clear all</button><span>{selectedCarryForward.length} selected</span></div>
        <div className="smart-start-list">{carryForwardCandidates.map((candidate) => { const key = getCarryForwardCandidateKey(candidate); const selected = selectedCarryForward.includes(key); return <article className={`smart-start-item${selected ? ' is-selected' : ''}`} key={key}><label><input type="checkbox" checked={selected} onChange={(event) => toggleCarryForward(candidate, event.target.checked)} /><span><strong>{candidate.title}</strong>{candidate.account && <small>{candidate.account}{candidate.hcpName ? ` · ${candidate.hcpName}` : ''}</small>}{candidate.priority && <small>{candidate.priority === 'high' ? 'High priority' : 'Normal priority'}{candidate.source ? ` · ${candidate.source.replace('-', ' ')}` : ''}</small>}<em>{candidate.reason}</em></span></label><div className="smart-start-targets"><label>Day<select aria-label={`Target day for ${candidate.title}`} value={targetDays[key] ?? 'monday'} onChange={(event) => updateSmartStart({ targetDays: { ...targetDays, [key]: event.target.value as DayId } })}>{dayOptions.map((day) => <option key={day.id} value={day.id}>{day.label}</option>)}</select></label><label>Plan area<select aria-label={`Plan area for ${candidate.title}`} value={targetCategories[key] ?? defaultCandidateCategory(candidate)} onChange={(event) => updateSmartStart({ targetCategories: { ...targetCategories, [key]: event.target.value as PlanCategory } })}>{PLAN_CATEGORIES.map((category) => <option key={category} value={category}>{carryForwardCategoryLabels[category]}</option>)}</select></label></div></article> })}</div>
        {selectedCarryForward.length === 0 && <p className="smart-start-empty">Select at least one item to prepare next week. The current week will remain unchanged.</p>}
        {showStartConfirmation && <div className="smart-start-confirmation"><p className="eyebrow">Confirm next-week plan</p><h3>Ready to prepare {formatWeekRange(nextWeekStart)}?</h3><p>{selectedCarryForward.length} item{selectedCarryForward.length === 1 ? '' : 's'} selected. Existing items in that week will be preserved.</p><div className="smart-start-breakdown">{dayOptions.map((day) => { const count = selectedCarryForward.filter((key) => (targetDays[key] ?? 'monday') === day.id).length; return count > 0 ? <span key={day.id}><strong>{day.label}</strong> {count}</span> : null })}</div><div className="smart-start-actions"><button className="button button-primary" type="button" onClick={prepareNextWeek}>Start Next Week</button><button className="button button-secondary" type="button" onClick={() => updateSmartStart({ showConfirmation: false })}>Cancel</button></div><small>The previous week will not be changed.</small></div>}
        {!showStartConfirmation && !carryForwardResult && <button className="button button-primary smart-start-review-button" type="button" disabled={selectedCarryForward.length === 0} onClick={() => updateSmartStart({ showConfirmation: true })}>Review and Start Next Week</button>}
        {carryForwardResult && <div className="smart-start-success"><strong>Next week is ready.</strong><span>{carryForwardResult.added} item{carryForwardResult.added === 1 ? '' : 's'} added to the Weekly Plan{carryForwardResult.existing > 0 ? ` · ${carryForwardResult.existing} already present` : ''}.</span><button className="button button-secondary" type="button" onClick={() => { setSelectedWeekStart(nextWeekStart); onNavigate('weekly-plan') }}>Open Next Week</button></div>}
      </section>}

      {activities.length > 0 && <section className="overview-outcomes-section" aria-labelledby="key-outcomes-heading">
        <SectionHeader eyebrow="What happened" title="Key outcomes from this week" />
        <div className="overview-outcome-grid">
          {[['Commercial', keyOutcomes.commercial], ['Patient Intelligence', keyOutcomes.patient], ['Access / Market', keyOutcomes.market]].map(([label, cards]) => <article className="overview-outcome-card" key={label as string}><h3>{label as string}</h3>{(cards as OutcomeCard[]).length > 0 ? <ul>{(cards as OutcomeCard[]).map((card, index) => <li key={`${card.title}-${index}`}><strong>{card.title}</strong>{card.detail && <small>{card.detail}</small>}</li>)}</ul> : <p>No outcomes recorded yet.</p>}</article>)}
        </div>
      </section>}

      <div className="overview-grid overview-secondary-grid">
        <section className="overview-panel overview-followups-secondary">
          <div className="overview-section-header overview-attention-header"><div><p className="eyebrow">Attention needed</p><h2>Priority Follow-ups</h2><div className="overview-attention-summary"><strong>{highPriorityFollowUps} High Priority</strong><span>{openFollowUps.length} Open</span></div></div><button className="overview-text-action" type="button" onClick={() => onNavigate('follow-ups')}>View All Follow-ups <span aria-hidden="true">→</span></button></div>
          {priorityFollowUps.length > 0 ? <ul className="overview-follow-up-list">{priorityFollowUps.map((followUp) => <li key={followUp.id}><span className={followUp.priority === 'high' ? 'follow-up-priority high' : 'follow-up-priority'} aria-hidden="true" /> <div><strong>{followUp.task}</strong><small>{followUp.priority === 'high' ? 'High priority' : 'Normal priority'}{followUp.dueDate ? ` · Due ${formatDayDate(followUp.dueDate)}` : ''}</small></div></li>)}</ul> : <p className="overview-empty-copy">No open follow-ups. You&apos;re caught up.</p>}
        </section>

        <section className="overview-panel overview-execution-panel">
          <SectionHeader eyebrow="Execution snapshot" title="Five-Day Progress" />
          <div className="overview-day-list">{plan.days.map((day) => { const status = getStatus(day, activities); const dayActivityCount = getDayActivities(day, activities).length; return <button className="overview-day-row" type="button" key={day.id} onClick={() => onNavigate('daily-activity')}><span>{day.label.slice(0, 3).toUpperCase()}</span><strong>{formatDayDate(day.date)}</strong><div><em className={`day-status ${status.toLowerCase().replace(' ', '-')}`}>{status}</em><small>{dayActivityCount} activit{dayActivityCount === 1 ? 'y' : 'ies'}</small></div><b aria-hidden="true">→</b></button> })}</div>
        </section>
      </div>

      <section className="overview-panel overview-plan-panel">
        <SectionHeader eyebrow="This week" title="This week&apos;s plan" action="View Weekly Plan" onAction={() => onNavigate('weekly-plan')} />
        {unique(plan.days.flatMap((day) => day.categories.facilities.map((item) => item.text))).length > 0 ? <div className="overview-plan-list">{plan.days.map((day) => <div className="overview-plan-row" key={day.id}><strong>{day.label}</strong><span>{day.categories.facilities.length > 0 ? day.categories.facilities.slice(0, 4).map((item) => item.text).join(' · ') : '—'}</span></div>)}</div> : <p className="overview-empty-copy">No facilities or accounts planned yet.</p>}
      </section>

      <section className="overview-report-card">
        <div><p className="eyebrow">Weekly report</p><h2>{reportReady ? 'Your weekly field activity is ready to review.' : 'Capture activity to prepare your weekly report.'}</h2><p>Activities captured: {activities.length} · Follow-ups: {followUps.length} · Readiness: {intelligence.reportReadiness.status}</p></div>
        <div className="overview-report-actions"><button className="button button-secondary" type="button" onClick={() => onNavigate('report')}>Review Report</button><button className="button button-primary" type="button" onClick={handleExport} disabled={!reportReady || isExporting}>{isExporting ? 'Generating...' : 'Export Word Document'} <span aria-hidden="true">→</span></button></div>
        {exportMessage && <p className="export-message" role="status">{exportMessage}</p>}
      </section>
    </main>
  )
}
