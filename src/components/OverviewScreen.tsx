import { useEffect, useMemo, useRef, useState } from 'react'
import { loadDailyActivities } from '../storage/dailyActivityStorage'
import { loadFollowUps } from '../storage/followUpsStorage'
import { getCurrentWeekStart, getPreviousWeekStart, loadWeeklyPlan } from '../storage/weeklyPlanStorage'
import { deriveWeeklyIntelligence } from '../intelligence/intelligenceEngine'
import type { WeeklyIntelligence } from '../intelligence/intelligenceTypes'
import { getSmartStartCandidates, mergeSmartStartSelections, type SmartStartCandidate } from '../intelligence/smartStart'
import { loadSmartStartCompletion, loadSmartStartCompletionAsync, saveSmartStartCompletionAsync, type SmartStartCompletion } from '../storage/smartStartStorage'
import { saveWeeklyPlanAsync } from '../storage/weeklyPlanStorage'
import { saveFollowUpsAsync } from '../storage/followUpsStorage'
import type { DailyActivity, StructuredOutcome } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import type { IntelligenceCategory, WeeklyInsight } from '../intelligence/intelligenceTypes'
import { PLAN_CATEGORIES, type DayPlan, type WeeklyPlan } from '../types/weeklyPlan'
import { exportReportWord, getFixedReportWeekLabel } from '../utils/reportDocx'
import type { WeekFlowTemplate } from '../config/templates'
import { getTemplateTerminology } from '../config/templateTerminology'
import './OverviewScreen.css'

interface OverviewScreenProps {
  selectedWeek: string
  template: WeekFlowTemplate
  onNavigate: (screen: string) => void
}

interface OverviewData {
  plan: WeeklyPlan
  activities: DailyActivity[]
  followUps: FollowUp[]
  intelligence: WeeklyIntelligence
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

function deriveOverviewData(selectedWeek: string, template: WeekFlowTemplate): OverviewData {
  const plan = loadWeeklyPlan(selectedWeek)
  const activities = loadDailyActivities(selectedWeek)
  const followUps = loadFollowUps(selectedWeek)
  return { plan, activities, followUps, intelligence: deriveWeeklyIntelligence({ selectedWeek, plan, activities, followUps, template }) }
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

function deriveKeyOutcomes(activities: DailyActivity[], template: WeekFlowTemplate): KeyOutcomes {
  const structuredOutcomes = activities.flatMap((activity) => activity.structuredOutcomes)
  if (template.id === 'small-business') {
    const commercialTypes = ['Sale / Order Won', 'Lead Qualified', 'Payment Received']
    const customerTypes = ['Customer Retained', 'Follow-up Required']
    const operationsTypes = ['Supplier Issue Identified', 'Operational Improvement']
    const toCards = (types: string[]) => structuredOutcomes.filter((outcome) => types.includes(outcome.type)).map((outcome) => ({ title: outcomeTitle(outcome), detail: outcome.details }))
    return { commercial: toCards(commercialTypes), patient: toCards(customerTypes), market: toCards(operationsTypes) }
  }
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

function AnimatedNumber({ value }: { value: number }) {
  const numberRef = useRef<HTMLSpanElement | null>(null)
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const node = numberRef.current
    if (!node) return

    if (prefersReducedMotion) {
      node.textContent = String(value)
      return
    }

    const startValue = Number(node.textContent ?? '0') || 0
    const startTime = performance.now()
    const duration = 480
    let frameId: number | null = null

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1)
      const eased = 1 - (1 - progress) ** 3
      const nextValue = Math.round(startValue + (value - startValue) * eased)
      node.textContent = String(nextValue)

      if (progress < 1) {
        frameId = requestAnimationFrame(tick)
        return
      }

      node.textContent = String(value)
    }

    frameId = requestAnimationFrame(tick)

    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId)
      }
    }
  }, [prefersReducedMotion, value])

  return <span ref={numberRef}>{prefersReducedMotion ? value : 0}</span>
}

function MetricCard({ label, value, detail, delay = 0 }: { label: string; value: string | number; detail?: string; delay?: number }) {
  return <article className="overview-metric overview-metric-card" style={{ animationDelay: `${delay}ms` }}><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</article>
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
  progress: 'Progress',
  risks: 'Risks / Blockers',
  stakeholders: 'Stakeholders',
  deliverables: 'Deliverables',
}

const intelligenceCategoryOrder: IntelligenceCategory[] = ['commercial', 'patient', 'access-market', 'strategic-accounts', 'scientific-engagement']

function getTopInsights(insights: WeeklyIntelligence['insights'], template: WeekFlowTemplate) {
  const order = template.id === 'project-management' ? ['progress', 'risks', 'deliverables', 'stakeholders'] as IntelligenceCategory[] : intelligenceCategoryOrder
  return order.flatMap((category) => insights[category].slice(0, 2).map((insight) => ({ ...insight, category }))).slice(0, 6)
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

const smartStartGroupLabels: Record<SmartStartCandidate['type'], string> = {
  'weekly-objective': 'Weekly Objectives',
  'open-follow-up': 'Open Follow-ups',
  'account-objective': 'Account Objectives',
  'commercial-priority': 'Commercial Priorities',
}

function hasMeaningfulPlanContent(plan: WeeklyPlan) {
  return (plan.weeklyStrategicObjectives ?? []).some((item) => item.text.trim())
    || plan.days.some((day) => PLAN_CATEGORIES.some((category) => day.categories[category].some((item) => item.text.trim())))
    || (plan.keyAccountObjectives ?? []).some((item) => item.account.trim() && item.objectives.some((objective) => objective.text.trim()))
    || (plan.commercialPriorities ?? []).some((item) => item.text.trim())
    || (plan.virtualEngagementPlan ?? []).some((item) => item.coverage.trim() || item.objective.trim() || item.priorityContacts.length > 0)
    || (plan.successMeasures ?? []).some((item) => item.text.trim())
}

export default function OverviewScreen({ selectedWeek, template, onNavigate }: OverviewScreenProps) {
  const terminology = getTemplateTerminology(template)
  const { plan, activities, followUps, intelligence } = useMemo(() => deriveOverviewData(selectedWeek, template), [selectedWeek, template])
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
  const keyOutcomes = deriveKeyOutcomes(activities, template)
  const highPriorityFollowUps = openFollowUps.filter((followUp) => followUp.priority === 'high').length
  const reportReady = intelligence.reportReadiness.status !== 'empty'
  const isTrulyEmpty = plannedItems === 0 && activities.length === 0
  const previousWeek = getPreviousWeekStart(selectedWeek)
  const previousPlan = useMemo(() => loadWeeklyPlan(previousWeek), [previousWeek])
  const previousFollowUps = useMemo(() => loadFollowUps(previousWeek), [previousWeek])
  const smartStartCandidates = useMemo(() => getSmartStartCandidates(previousPlan, previousFollowUps), [previousPlan, previousFollowUps])
  const hasPreviousWeekData = hasMeaningfulPlanContent(previousPlan) || previousFollowUps.length > 0 || loadDailyActivities(previousWeek).length > 0
  const [smartStartState, setSmartStartState] = useState<{ week: string; selected: string[]; showReview: boolean; completion: SmartStartCompletion | null; result: number | null }>({ week: selectedWeek, selected: smartStartCandidates.map((candidate) => candidate.key), showReview: false, completion: loadSmartStartCompletion(selectedWeek), result: null })
  const smartStart = smartStartState.week === selectedWeek ? smartStartState : { week: selectedWeek, selected: smartStartCandidates.map((candidate) => candidate.key), showReview: false, completion: loadSmartStartCompletion(selectedWeek), result: null }
  const selectedSmartStart = smartStart.selected

  useEffect(() => {
    let active = true
    loadSmartStartCompletionAsync(selectedWeek).then((completion) => {
      if (active) setSmartStartState((current) => current.week === selectedWeek ? { ...current, completion } : current)
    })
    return () => { active = false }
  }, [selectedWeek])

  function markSmartStart(completion: SmartStartCompletion) {
    void saveSmartStartCompletionAsync(selectedWeek, completion)
    setSmartStartState({ ...smartStart, completion, showReview: false, result: completion === 'started' ? 0 : null })
  }

  function startFromPreviousWeek() {
    const result = mergeSmartStartSelections(plan, selectedWeek, followUps, smartStartCandidates, selectedSmartStart)
    void saveWeeklyPlanAsync(result.plan)
    void saveFollowUpsAsync(selectedWeek, result.followUps)
    void saveSmartStartCompletionAsync(selectedWeek, 'started')
    setSmartStartState({ ...smartStart, completion: 'started', showReview: false, result: result.added })
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
        template,
      })
      setExportMessage(`Downloaded ${result.filename}`)
    } catch {
      setExportMessage('Word export could not be completed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <main key={selectedWeek} className={`overview-dashboard overview-hero-screen${intelligence.reportReadiness.status === 'empty' ? ' is-empty' : ''}`} id="overview">
      <header className="overview-week-header overview-hero-enter">
        <div className="overview-week-copy">
          <p className="eyebrow overview-hero-context">{isHistorical ? 'Historical week' : 'Current work week'}</p>
          <h1 className="overview-hero-heading">{template.name}</h1>
          <p className="overview-week-date overview-hero-meta">{isHistorical ? 'Historical week' : 'Current week'} · {formatCompactWeekHeading(selectedWeek)}</p>
          <p className="overview-week-description overview-hero-copy">Your week at a glance.</p>
          {isTrulyEmpty && <p className="overview-empty-week-note">Your week hasn&apos;t started yet.</p>}
        </div>
        <div className="overview-week-side">
          <span className={`overview-readiness overview-readiness-${intelligence.reportReadiness.status} overview-hero-status`}><span aria-hidden="true" />{intelligence.reportReadiness.status === 'ready' ? 'Ready to review' : intelligence.reportReadiness.status === 'review' ? 'Needs attention' : 'Ready when you are'}</span>
          <div className="overview-week-actions overview-hero-actions">
          <button className="button button-secondary" type="button" onClick={() => onNavigate('weekly-plan')}>{intelligence.reportReadiness.status === 'empty' ? 'Open Weekly Plan' : 'View Weekly Plan'}</button>
          <button className="button button-primary" type="button" onClick={() => onNavigate('daily-activity')}>{intelligence.reportReadiness.status === 'empty' ? 'Record Activity' : 'Continue Daily Activity'} <span aria-hidden="true">→</span></button>
          </div>
        </div>
      </header>

      <section className="overview-metrics overview-metric-entrance" aria-label="Weekly metrics">
        <div className="overview-metric overview-metric-primary overview-metric-card" style={{ animationDelay: '0ms' }}><span>This week</span><strong><AnimatedNumber value={activities.length} /></strong><small>{terminology.activityPlural}</small></div>
        <MetricCard label={template.id === 'project-management' ? 'Projects / Workstreams' : template.id === 'small-business' ? 'Customer / Client contacts' : 'HCP engagements'} value={template.id === 'project-management' ? priorityAccounts : uniqueHcps} delay={70} />
        <MetricCard label={template.id === 'project-management' ? 'Weekly Objectives' : 'Open follow-ups'} value={template.id === 'project-management' ? plan.days.reduce((count, day) => count + day.categories.primaryObjectives.length, 0) : openFollowUps.length} delay={140} />
        <div className="overview-metric overview-metric-status overview-metric-card" style={{ animationDelay: '210ms' }}><span>Report</span><strong>{reportReady ? 'Ready' : 'Not ready'}</strong><small>{intelligence.reportReadiness.summary}</small></div>
      </section>

      <nav className="overview-workflow-rail overview-workflow-rail-enter" aria-label="WeekFlow workflow">
        <a className="overview-workflow-step is-complete" href="/weekly-plan" style={{ animationDelay: '0ms', ['--step-index' as any]: 0 }}><span>01</span><strong>Plan</strong><small>Weekly Plan</small></a>
        <a className={`overview-workflow-step${activities.length > 0 ? ' is-complete' : ' is-current'}`} href="/daily-activity" style={{ animationDelay: '80ms', ['--step-index' as any]: 1 }}><span>02</span><strong>Act</strong><small>Daily Activity</small></a>
        <a className={`overview-workflow-step${openFollowUps.length > 0 ? ' is-current' : ''}`} href="/follow-ups" style={{ animationDelay: '160ms', ['--step-index' as any]: 2 }}><span>03</span><strong>Follow up</strong><small>Follow-ups</small></a>
        <a className={`overview-workflow-step${reportReady ? ' is-complete' : ' is-current'}`} href="/report" style={{ animationDelay: '240ms', ['--step-index' as any]: 3 }}><span>04</span><strong>Review</strong><small>Generate Report</small></a>
        <a className="overview-workflow-step" href="/report-history" style={{ animationDelay: '320ms', ['--step-index' as any]: 4 }}><span>05</span><strong>Report</strong><small>Report History</small></a>
      </nav>

      <div className={`overview-grid overview-main-grid${isTrulyEmpty ? ' is-empty' : ''}`}>
        {!isTrulyEmpty && <section className="overview-panel overview-progress-panel">
          <SectionHeader eyebrow="Week at a glance" title={template.id === 'project-management' ? 'Project execution' : template.id === 'small-business' ? 'Business execution' : 'Field execution'} />
          <div className="overview-progress-label"><strong>{activities.length} of {plannedItems} planned {template.id === 'project-management' ? 'work items' : template.id === 'small-business' ? 'business items' : 'account items'} captured</strong><span>{progress}%</span></div>
          <div className="overview-progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} aria-label="Weekly field activity progress"><span style={{ width: `${progress}%` }} /></div>
          <div className="overview-supporting-stats"><span>{activeWorkdays} active workday{activeWorkdays === 1 ? '' : 's'}</span><span>{template.id === 'project-management' ? `${priorityAccounts} projects / workstreams` : template.id === 'small-business' ? `${uniqueHcps} customer / client contacts` : `${uniqueHcps} HCP engagements`}</span><span>{template.id === 'project-management' ? `${plan.successMeasures.length} success measures` : `${priorityAccounts} ${template.id === 'small-business' ? 'business records' : 'account records'}`}</span></div>
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
        {intelligence.reportReadiness.status === 'empty' ? <div className="intelligence-empty-actions overview-empty-cta"><button className="button button-secondary" type="button" onClick={() => onNavigate('weekly-plan')}>Review Weekly Plan</button><button className="button button-primary" type="button" onClick={() => onNavigate('daily-activity')}>Record Activity</button></div> : <div className="overview-intelligence-grid">
          <section className="intelligence-column overview-intelligence-column" aria-labelledby="happening-heading"><h3 id="happening-heading">What&apos;s happening</h3>{getTopInsights(intelligence.insights, template).length > 0 ? <ul className="intelligence-insight-list">{getTopInsights(intelligence.insights, template).map((insight: WeeklyInsight, index: number) => <li key={`${insight.category}-${insight.account}-${insight.title}-${insight.detail}`} className="overview-intelligence-item" style={{ animationDelay: `${index * 70}ms` }}><span className="intelligence-category">{intelligenceCategoryLabels[insight.category]}</span><strong>{insight.title}</strong><p>{insight.account}: {insight.detail}</p></li>)}</ul> : <p className="intelligence-muted">No derived insights yet.</p>}</section>
          <section className="intelligence-column overview-intelligence-column" aria-labelledby="attention-heading"><h3 id="attention-heading">What needs attention</h3>{getAttentionItems(intelligence, followUps).length > 0 ? <ul className="intelligence-attention-list">{getAttentionItems(intelligence, followUps).map((item, index: number) => <li key={`${item.title}-${item.action}`} className="overview-intelligence-item" style={{ animationDelay: `${index * 70}ms` }}><span className={`intelligence-level ${item.level.toLowerCase().replace(' ', '-')}`}>{item.level}</span><div><strong>{item.title}</strong><p>{item.reason}</p><button type="button" onClick={() => onNavigate(item.action)}>Review <span aria-hidden="true">→</span></button></div></li>)}</ul> : <p className="intelligence-muted">Nothing needs attention right now.</p>}</section>
          <section className="intelligence-column overview-intelligence-column" aria-labelledby="next-heading"><h3 id="next-heading">What should happen next</h3>{intelligence.recommendations.length > 0 ? <ol className="intelligence-recommendation-list">{intelligence.recommendations.slice(0, 5).map((recommendation, index) => <li key={`${recommendation.title}-${recommendation.account ?? ''}`} className="overview-intelligence-item" style={{ animationDelay: `${index * 70}ms` }}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{recommendation.title}</strong><p>{recommendation.reason}</p></div></li>)}</ol> : <p className="intelligence-muted">Recommendations will appear as activity is captured.</p>}</section>
        </div>}
      </section>

      {hasPreviousWeekData && smartStart.completion === null && <section className="overview-panel smart-start-panel" aria-labelledby="smart-start-heading">
        <div className="overview-section-header"><div><p className="eyebrow">Start this week faster</p><h2 id="smart-start-heading">Start From Previous Week</h2><p className="smart-start-intro">Your previous week has unfinished work that may still be relevant. Review selected items before adding them to this week.</p></div>{smartStartCandidates.length > 0 && <span className="smart-start-count">{smartStartCandidates.length} item{smartStartCandidates.length === 1 ? '' : 's'}</span>}</div>
        {smartStartCandidates.length === 0 ? <div className="smart-start-empty-state"><strong>Nothing to carry forward</strong><p>Your previous week has no unfinished items.</p><button className="button button-secondary" type="button" onClick={() => markSmartStart('fresh')}>Start Fresh</button></div> : !smartStart.showReview ? <button className="button button-primary smart-start-review-button" type="button" onClick={() => setSmartStartState({ ...smartStart, showReview: true })}>Start From Previous Week</button> : <>
          <div className="smart-start-toolbar"><button className="overview-text-action" type="button" onClick={() => setSmartStartState({ ...smartStart, selected: smartStartCandidates.map((candidate) => candidate.key) })}>Select All</button><button className="overview-text-action" type="button" onClick={() => setSmartStartState({ ...smartStart, selected: [] })}>Clear All</button><span>{selectedSmartStart.length} selected</span></div>
          <div className="smart-start-groups">{(['weekly-objective', 'open-follow-up', 'account-objective', 'commercial-priority'] as SmartStartCandidate['type'][]).map((type) => { const group = smartStartCandidates.filter((candidate) => candidate.type === type); if (group.length === 0) return null; return <section className="smart-start-group" key={type} aria-labelledby={`smart-start-${type}`}><h3 id={`smart-start-${type}`}>{smartStartGroupLabels[type]}</h3><div className="smart-start-list">{group.map((candidate) => { const selected = selectedSmartStart.includes(candidate.key); return <label className={`smart-start-item${selected ? ' is-selected' : ''}`} key={candidate.key}><input type="checkbox" checked={selected} onChange={(event) => setSmartStartState({ ...smartStart, selected: event.target.checked ? [...selectedSmartStart, candidate.key] : selectedSmartStart.filter((key) => key !== candidate.key) })} /><span><strong>{candidate.title}</strong>{candidate.detail && <small>{candidate.detail}</small>}</span></label> })}</div></section> })}</div>
          <div className="smart-start-actions"><button className="button button-primary" type="button" disabled={selectedSmartStart.length === 0} onClick={() => { startFromPreviousWeek(); onNavigate('weekly-plan') }}>Start Week</button><button className="button button-secondary" type="button" onClick={() => markSmartStart('fresh')}>Start Fresh</button></div>
          <small className="smart-start-safety-note">The previous week will not be changed. Daily Activity and completed follow-ups are not copied.</small>
        </>}
      </section>}

      {activities.length > 0 && <section className="overview-outcomes-section" aria-labelledby="key-outcomes-heading">
        <SectionHeader eyebrow="What happened" title="Key outcomes from this week" />
        <div className="overview-outcome-grid">
          {(template.id === 'small-business'
            ? [['Business / Sales', keyOutcomes.commercial], ['Customer Outcomes', keyOutcomes.patient], ['Operations / Supplier', keyOutcomes.market]]
            : [['Commercial', keyOutcomes.commercial], ['Patient Intelligence', keyOutcomes.patient], ['Access / Market', keyOutcomes.market]]).map(([label, cards]) => <article className="overview-outcome-card" key={label as string}><h3>{label as string}</h3>{(cards as OutcomeCard[]).length > 0 ? <ul>{(cards as OutcomeCard[]).map((card, index) => <li key={`${card.title}-${index}`}><strong>{card.title}</strong>{card.detail && <small>{card.detail}</small>}</li>)}</ul> : <p>No outcomes recorded yet.</p>}</article>)}
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
        {unique(plan.days.flatMap((day) => day.categories.facilities.map((item) => item.text))).length > 0 ? <div className="overview-plan-list">{plan.days.map((day) => <div className="overview-plan-row" key={day.id}><strong>{day.label}</strong><span>{day.categories.facilities.length > 0 ? day.categories.facilities.slice(0, 4).map((item) => item.text).join(' · ') : '—'}</span></div>)}</div> : <p className="overview-empty-copy">{template.id === 'project-management' ? 'No projects or workstreams planned yet.' : 'No facilities or accounts planned yet.'}</p>}
      </section>

      <section className="overview-report-card">
        <div><p className="eyebrow">Weekly report</p><h2>{reportReady ? `Your weekly ${template.id === 'project-management' ? 'project report' : 'field activity report'} is ready to review.` : 'Capture activity to prepare your weekly report.'}</h2><p>Activities captured: {activities.length} · Follow-ups: {followUps.length} · Readiness: {intelligence.reportReadiness.status}</p></div>
        <div className="overview-report-actions"><button className="button button-secondary" type="button" onClick={() => onNavigate('report')}>Review Report</button><button className="button button-primary" type="button" onClick={handleExport} disabled={!reportReady || isExporting}>{isExporting ? 'Generating...' : 'Export Word Document'} <span aria-hidden="true">→</span></button></div>
        {exportMessage && <p className="export-message" role="status">{exportMessage}</p>}
      </section>
    </main>
  )
}
