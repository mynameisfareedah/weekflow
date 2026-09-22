import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { countMeaningfulPlanItems, deriveWeeklyIntelligence } from '../intelligence/intelligenceEngine'
import { loadDailyActivities, loadDailyActivitiesAsync } from '../storage/dailyActivityStorage'
import { loadFollowUps, loadFollowUpsAsync } from '../storage/followUpsStorage'
import { getCurrentWeekStart, loadWeeklyPlan, loadWeeklyPlanAsync } from '../storage/weeklyPlanStorage'
import type { WeekFlowTemplate } from '../config/templates'
import type { DailyActivity } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import type { WeeklyPlan } from '../types/weeklyPlan'
import './OverviewScreen.css'
import { AppIcon } from './TemplateIcon'
import NgoPerformanceDashboard from './NgoPerformanceDashboard'
import { deriveNgoPerformance } from '../report/ngoPerformance'
import WeekCalendar from './WeekCalendar'
import { getTimeAwareGreeting } from '../utils/greeting'

interface OverviewScreenProps {
  selectedWeek: string
  template: WeekFlowTemplate
  userName?: string
  onNavigate: (screen: string) => void
}

function formatWeekRangeLabel(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })
  const monthFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${dateFormat.format(start)} – ${monthFormat.format(end)}`
}

function hasMeaningfulPlanContent(plan: WeeklyPlan) {
  return (plan.weeklyStrategicObjectives ?? []).some((item) => item.text.trim())
    || plan.days.some((day) => Object.values(day.categories).some((items) => items.some((item) => item.text.trim())))
    || (plan.keyAccountObjectives ?? []).some((item) => item.account.trim() && item.objectives.some((objective) => objective.text.trim()))
    || (plan.commercialPriorities ?? []).some((item) => item.text.trim())
    || (plan.virtualEngagementPlan ?? []).some((item) => item.coverage.trim() || item.objective.trim() || item.priorityContacts.length > 0)
    || (plan.successMeasures ?? []).some((item) => item.text.trim())
    || (plan.programmeActivities ?? []).some((item) => item.activity.trim() || item.programmeArea?.trim() || item.location?.trim() || item.target?.trim())
    || (plan.communityEngagement ?? []).some((item) => item.communityGroup.trim() || item.engagementActivity.trim())
    || (plan.volunteerPlan ?? []).some((item) => item.volunteer.trim() || item.activity.trim())
    || (plan.stakeholderPlan ?? []).some((item) => item.stakeholder.trim() || item.purpose.trim() || item.actionRequired?.trim())
    || (plan.resourcesLogistics ?? []).some((item) => item.resource.trim() || item.required?.trim() || item.gap?.trim() || item.action?.trim())
    || (plan.communicationsPlan ?? []).some((item) => item.communication.trim() || item.audience?.trim())
    || (plan.documentationPlan ?? []).some((item) => item.documentation.trim() || item.required?.trim())
    || (plan.monitoringImpactTargets ?? []).some((item) => item.text.trim())
    || (plan.fieldJobs ?? []).some((item) => item.jobId.trim() || item.customer.trim() || item.location.trim())
    || (plan.fieldServiceIssues ?? []).some((item) => item.issueId.trim() || item.customer.trim() || item.problem.trim())
}

function useCountUp(value: number) {
  const [displayValue, setDisplayValue] = useState(value)
  const previousValueRef = useRef(value)

  useEffect(() => {
    if (value === previousValueRef.current) return
    previousValueRef.current = value
    if (value === 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplayValue(value)
      return
    }

    let frame = 0
    const startedAt = performance.now()
    const duration = 400
    setDisplayValue(0)
    const animate = (timestamp: number) => {
      const progress = Math.min((timestamp - startedAt) / duration, 1)
      setDisplayValue(Math.round(value * (1 - Math.pow(1 - progress, 3))))
      if (progress < 1) frame = window.requestAnimationFrame(animate)
    }
    frame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frame)
  }, [value])

  return displayValue
}

export default function OverviewScreen({ selectedWeek, template, userName, onNavigate }: OverviewScreenProps) {
  const [cloudData, setCloudData] = useState<{ plan: WeeklyPlan; activities: DailyActivity[]; followUps: FollowUp[] } | null>(null)
  const isReducedMotion = useSyncExternalStore(
    (callback) => {
      const mediaQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null
      if (!mediaQuery) return () => undefined

      const handleChange = () => callback()
      if (typeof mediaQuery.addEventListener === 'function') {
        mediaQuery.addEventListener('change', handleChange)
        return () => mediaQuery.removeEventListener('change', handleChange)
      }

      mediaQuery.addListener(handleChange)
      return () => mediaQuery.removeListener(handleChange)
    },
    () => (typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false),
    () => false,
  )

  useEffect(() => {
    let active = true
    setCloudData(null)
    Promise.all([loadWeeklyPlanAsync(selectedWeek), loadDailyActivitiesAsync(selectedWeek), loadFollowUpsAsync(selectedWeek)]).then(([plan, activities, followUps]) => {
      if (active) setCloudData({ plan, activities, followUps })
    }).catch(() => undefined)
    return () => { active = false }
  }, [selectedWeek])
  const { plan, activities, followUps, projectSignals, insights, ngoPerformance, intelligence } = useMemo(() => {
    const loadedPlan = cloudData?.plan ?? loadWeeklyPlan(selectedWeek)
    const loadedActivities = cloudData?.activities ?? loadDailyActivities(selectedWeek)
    const loadedFollowUps = cloudData?.followUps ?? loadFollowUps(selectedWeek)
    const intelligence = deriveWeeklyIntelligence({ selectedWeek, plan: loadedPlan, activities: loadedActivities, followUps: loadedFollowUps, template })
    const performance = template.id === 'ngo-community' ? deriveNgoPerformance(loadedPlan, loadedActivities, loadedFollowUps, selectedWeek, template) : null
    return {
      plan: loadedPlan,
      activities: loadedActivities,
      followUps: loadedFollowUps,
      projectSignals: intelligence.projectSignals,
      insights: intelligence.insights,
      ngoPerformance: performance,
      intelligence,
    }
  }, [cloudData, selectedWeek, template])
  const isHistorical = selectedWeek !== getCurrentWeekStart()
  const isEmpty = !hasMeaningfulPlanContent(plan) && activities.length === 0
  const activeActivityDays = new Set(activities.map((activity) => activity.date)).size
  const totalPlanItems = countMeaningfulPlanItems(plan)
  const readinessLabel = intelligence.reportReadiness.status === 'ready' ? 'Ready to Review' : intelligence.reportReadiness.status === 'review' ? 'Needs Attention' : 'Week Hasn’t Started'
  const activityCount = useCountUp(activities.length)
  const plannedCount = useCountUp(totalPlanItems)
  const metricCards = [
    { label: 'Activities', value: activityCount, meta: `${activeActivityDays} active day${activeActivityDays === 1 ? '' : 's'}` },
    { label: 'Planned', value: plannedCount, meta: `${intelligence.reportReadiness.capturedPlannedItemCount} captured` },
    { label: 'Readiness', value: readinessLabel, meta: intelligence.reportReadiness.status === 'empty' ? 'Open Weekly Plan to set priorities.' : intelligence.reportReadiness.summary },
  ]
    const projectSignalGroups = template.id === 'project-management'
      ? [
        { kind: 'issue', label: 'Issues' },
        { kind: 'risk', label: 'Risks' },
        { kind: 'dependency', label: 'Dependencies' },
        { kind: 'dependency-risk', label: 'Dependency risks' },
        { kind: 'blocked-work', label: 'Blocked work' },
        { kind: 'delayed-work', label: 'Delayed work' },
        { kind: 'resource-capacity', label: 'Resource concerns' },
        { kind: 'schedule-risk', label: 'Schedule risks' },
        { kind: 'follow-up-required', label: 'Follow-ups' },
      ].map((group) => ({ ...group, items: projectSignals.filter((signal) => signal.kind === group.kind) })).filter((group) => group.items.length > 0)
      : []

  const personalInsightItems = template.id === 'personal'
    ? Object.values(insights).flat().slice(0, 5)
    : []
  const ngoInsightGroups = template.id === 'ngo-community'
    ? [
      { key: 'risks', label: 'Issues & Risks' },
      { key: 'progress', label: 'Monitoring & Learning' },
      { key: 'stakeholders', label: 'Stakeholder Follow-up' },
      { key: 'deliverables', label: 'Output Evidence' },
    ].map((group) => ({ ...group, items: insights[group.key as keyof typeof insights] })).filter((group) => group.items.length > 0)
    : []
  const fieldOperationsSignals = template.id === 'field-service'
    ? Object.values(insights).flat().filter((item) => ['Unresolved Service Issue', 'Repeat Fault', 'Recurring Equipment Problem', 'Escalation Required', 'Downtime', 'Preventive Maintenance', 'Parts Required', 'Customer Concern'].includes(item.title))
    : []

  return (
    <main className={`overview-dashboard overview-orientation${isEmpty ? ' is-empty' : ''}`} id="overview">
      <header className="overview-week-header overview-orientation-header">
        <div className="overview-week-copy">
          <p className="overview-greeting">{getTimeAwareGreeting(userName ?? '')}</p>
          <p className="overview-week-date">{isHistorical ? 'Historical week' : 'Current week'} · {formatWeekRangeLabel(selectedWeek)}</p>
          <h1 className="overview-hero-heading">This week</h1>
        </div>
      </header>

      <section className="overview-orientation-pathway" aria-labelledby="overview-pathway-heading">
        <div className="overview-orientation-intro">
          <p className="eyebrow">Your WeekFlow pathway</p>
          <h2 id="overview-pathway-heading">One clear path through the week.</h2>
        </div>
        <nav className="overview-workflow-rail" aria-label="WeekFlow workflow">
          <svg className="overview-workflow-connector" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <g className="overview-workflow-connector-desktop">
              <path
                className="overview-workflow-connector-back"
                d={isReducedMotion ? 'M 8 50 C 12 26, 26 18, 34 42 S 46 74, 50 52 S 58 26, 68 40 S 82 68, 92 50' : undefined}
                pathLength="1"
              >
                {!isReducedMotion && (
                  <animate
                    attributeName="d"
                    dur="5.8s"
                    repeatCount="indefinite"
                    values="M 8 50 C 12 26, 26 18, 34 42 S 46 74, 50 52 S 58 26, 68 40 S 82 68, 92 50;M 8 46 C 12 68, 26 74, 34 52 S 46 24, 50 46 S 58 74, 68 52 S 82 28, 92 44;M 8 50 C 12 26, 26 18, 34 42 S 46 74, 50 52 S 58 26, 68 40 S 82 68, 92 50"
                  />
                )}
              </path>
              <path className="overview-workflow-connector-main" d="M 8 50 C 12 26, 26 18, 34 42 S 46 74, 50 52 S 58 26, 68 40 S 82 68, 92 50" />
              <path className="overview-workflow-connector-highlight" d="M 8 50 C 12 26, 26 18, 34 42 S 46 74, 50 52 S 58 26, 68 40 S 82 68, 92 50" />
            </g>
            <g className="overview-workflow-connector-mobile">
              <path
                className="overview-workflow-connector-back"
                d={isReducedMotion ? 'M 18 20 C 28 14, 36 14, 42 24 S 52 38, 58 26 S 68 12, 80 20 S 88 38, 84 48 S 68 66, 58 56 S 46 42, 34 48 S 22 62, 22 76' : undefined}
                pathLength="1"
              >
                {!isReducedMotion && (
                  <animate
                    attributeName="d"
                    dur="6.1s"
                    repeatCount="indefinite"
                    values="M 18 20 C 28 14, 36 14, 42 24 S 52 38, 58 26 S 68 12, 80 20 S 88 38, 84 48 S 68 66, 58 56 S 46 42, 34 48 S 22 62, 22 76;M 18 24 C 28 38, 36 38, 42 28 S 52 12, 58 28 S 68 42, 80 30 S 88 18, 84 43 S 68 57, 58 48 S 46 32, 34 40 S 22 53, 22 70;M 18 20 C 28 14, 36 14, 42 24 S 52 38, 58 26 S 68 12, 80 20 S 88 38, 84 48 S 68 66, 58 56 S 46 42, 34 48 S 22 62, 22 76"
                  />
                )}
              </path>
              <path className="overview-workflow-connector-main" d="M 18 20 C 28 14, 36 14, 42 24 S 52 38, 58 26 S 68 12, 80 20 S 88 38, 84 48 S 68 66, 58 56 S 46 42, 34 48 S 22 62, 22 76" />
              <path className="overview-workflow-connector-highlight" d="M 18 20 C 28 14, 36 14, 42 24 S 52 38, 58 26 S 68 12, 80 20 S 88 38, 84 48 S 68 66, 58 56 S 46 42, 34 48 S 22 62, 22 76" />
            </g>
          </svg>
          <a className="overview-workflow-step" href="/weekly-plan" onClick={(event) => { event.preventDefault(); onNavigate('weekly-plan') }}><span>01</span><strong>Plan</strong><small>Weekly Plan</small></a>
          <a className="overview-workflow-step" href="/daily-activity" onClick={(event) => { event.preventDefault(); onNavigate('daily-activity') }}><span>02</span><strong>Act</strong><small>Daily Activity</small></a>
          <a className="overview-workflow-step" href="/follow-ups" onClick={(event) => { event.preventDefault(); onNavigate('follow-ups') }}><span>03</span><strong>Follow-up</strong><small>Follow-ups</small></a>
          <a className="overview-workflow-step" href="/report" onClick={(event) => { event.preventDefault(); onNavigate('report') }}><span>04</span><strong>Review</strong><small>Generate Report</small></a>
          <a className="overview-workflow-step" href="/report" onClick={(event) => { event.preventDefault(); onNavigate('report') }}><span>05</span><strong>Report</strong><small>Generate Report</small></a>
        </nav>
      </section>

      <section className="overview-dashboard-metrics" aria-labelledby="overview-metrics-heading">
        <div className="overview-dashboard-metrics-header">
          <div>
            <h2 id="overview-metrics-heading">Week overview</h2>
          </div>
        </div>
        <div className="overview-dashboard-metrics-grid">
          {metricCards.map((card) => (
            <article className="overview-dashboard-metric" key={card.label}>
              <span className="overview-dashboard-metric-label">{card.label}</span>
              <strong className="overview-dashboard-metric-value">{card.value}</strong>
              <small className="overview-dashboard-metric-meta">{card.meta}</small>
            </article>
          ))}
        </div>
        {isEmpty && <p className="overview-compact-cta"><span>Start by planning your week</span><button type="button" onClick={() => onNavigate('weekly-plan')}>Open Weekly Plan <AppIcon name="arrow-right" /></button></p>}
      </section>

      <div className="overview-calendar-enter"><WeekCalendar key={selectedWeek} selectedWeek={selectedWeek} activities={activities} followUps={followUps} /></div>

      {template.id === 'ngo-community' && ngoPerformance && <NgoPerformanceDashboard performance={ngoPerformance} onNavigate={onNavigate} />}
      {template.id === 'personal' && personalInsightItems.length > 0 && <section className="overview-project-intelligence" aria-labelledby="personal-intelligence-heading">
        <div className="overview-intelligence-heading">
          <div><p className="eyebrow">Personal Intelligence</p><h2 id="personal-intelligence-heading">What’s Worth Attention</h2></div>
          <span>{personalInsightItems.length} signal{personalInsightItems.length === 1 ? '' : 's'}</span>
        </div>
        <div className="overview-project-intelligence-list">
          {personalInsightItems.map((item, index) => <div className="overview-project-intelligence-group" key={`${item.title}-${index}`}><strong>{item.title}</strong><ul><li><b>{item.account || 'Personal Productivity'}</b><p>{item.detail}</p></li></ul></div>)}
        </div>
      </section>}
      {ngoInsightGroups.length > 0 && <section className="overview-project-intelligence" aria-labelledby="ngo-intelligence-heading">
        <div className="overview-intelligence-heading">
          <div><p className="eyebrow">Programme Intelligence</p><h2 id="ngo-intelligence-heading">Issues, risks, monitoring and learning</h2></div>
          <span>{ngoInsightGroups.reduce((count, group) => count + group.items.length, 0)} signals</span>
        </div>
        <div className="overview-project-intelligence-list">
          {ngoInsightGroups.map((group) => <div className="overview-project-intelligence-group" key={group.key}><strong>{group.label}</strong><span>{group.items.length}</span><ul>{group.items.slice(0, 4).map((item, index) => <li key={`${group.key}-${item.title}-${index}`}><b>{item.title}</b><p>{item.detail}</p></li>)}</ul></div>)}
        </div>
      </section>}
      {template.id === 'field-service' && <section className="overview-project-intelligence" aria-labelledby="field-operations-intelligence-heading">
        <div className="overview-intelligence-heading">
          <div><p className="eyebrow">Operational Intelligence</p><h2 id="field-operations-intelligence-heading">Signals from actual field activity</h2></div>
          <span>{fieldOperationsSignals.length} signal{fieldOperationsSignals.length === 1 ? '' : 's'}</span>
        </div>
        {fieldOperationsSignals.length > 0 ? <div className="overview-project-intelligence-list">{fieldOperationsSignals.slice(0, 8).map((item, index) => <div className="overview-project-intelligence-group" key={`${item.title}-${item.evidence[0]?.activityId ?? index}`}><strong>{item.title}</strong><ul><li><b>{item.account}</b><p>{item.detail}</p><p>Source activity: {item.evidence[0]?.activityId ?? 'Recorded activity'}</p></li></ul></div>)}</div> : <p className="intelligence-muted">No operational signals yet. Signals appear when actual field activity provides evidence.</p>}
      </section>}
      {projectSignalGroups.length > 0 && <section className="overview-project-intelligence" aria-labelledby="project-intelligence-heading">
        <div className="overview-intelligence-heading">
          <div><p className="eyebrow">Project Intelligence</p><h2 id="project-intelligence-heading">Actionable signals from this week</h2></div>
          <span>{projectSignals.length} signal{projectSignals.length === 1 ? '' : 's'}</span>
        </div>
        <div className="overview-project-intelligence-list">
          {projectSignalGroups.map((group) => <div className="overview-project-intelligence-group" key={group.kind}>
            <strong>{group.label}</strong>
            <span>{group.items.length}</span>
            <ul>{group.items.slice(0, 3).map((signal) => <li key={`${signal.kind}-${signal.sourceActivityId ?? signal.detail}`}><b>{signal.account}</b><p>{signal.detail}</p></li>)}</ul>
          </div>)}
        </div>
      </section>}
    </main>
  )
}
