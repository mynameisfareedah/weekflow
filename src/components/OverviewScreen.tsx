import { useMemo } from 'react'
import { deriveWeeklyIntelligence } from '../intelligence/intelligenceEngine'
import { loadDailyActivities } from '../storage/dailyActivityStorage'
import { loadFollowUps } from '../storage/followUpsStorage'
import { getCurrentWeekStart, loadWeeklyPlan } from '../storage/weeklyPlanStorage'
import type { WeekFlowTemplate } from '../config/templates'
import type { WeeklyPlan } from '../types/weeklyPlan'
import './OverviewScreen.css'
import { AppIcon } from './TemplateIcon'
import NgoPerformanceDashboard from './NgoPerformanceDashboard'
import { deriveNgoPerformance } from '../report/ngoPerformance'

interface OverviewScreenProps {
  selectedWeek: string
  template: WeekFlowTemplate
  workspaceName?: string
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
}

export default function OverviewScreen({ selectedWeek, template, workspaceName, onNavigate }: OverviewScreenProps) {
  const { plan, activities, followUps, reportStatus, projectSignals, insights, ngoPerformance } = useMemo(() => {
    const loadedPlan = loadWeeklyPlan(selectedWeek)
    const loadedActivities = loadDailyActivities(selectedWeek)
    const loadedFollowUps = loadFollowUps(selectedWeek)
    const intelligence = deriveWeeklyIntelligence({ selectedWeek, plan: loadedPlan, activities: loadedActivities, followUps: loadedFollowUps, template })
    const performance = template.id === 'ngo-community' ? deriveNgoPerformance(loadedPlan, loadedActivities, loadedFollowUps, selectedWeek, template) : null
    return { plan: loadedPlan, activities: loadedActivities, followUps: loadedFollowUps, reportStatus: intelligence.reportReadiness.status, projectSignals: intelligence.projectSignals, insights: intelligence.insights, ngoPerformance: performance }
  }, [selectedWeek, template])
  const isHistorical = selectedWeek !== getCurrentWeekStart()
  const isEmpty = !hasMeaningfulPlanContent(plan) && activities.length === 0
  const hasOpenFollowUps = followUps.some((followUp) => followUp.status === 'open')
  const nextAction = isEmpty
    ? { label: 'Plan your week', destination: 'weekly-plan' }
    : !activities.length
      ? { label: 'Start recording activity', destination: 'daily-activity' }
      : hasOpenFollowUps
        ? { label: 'Review follow-ups', destination: 'follow-ups' }
        : reportStatus === 'ready' || reportStatus === 'review'
          ? { label: 'Review your report', destination: 'report' }
          : { label: 'Continue your week', destination: 'weekly-plan' }
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

  return (
    <main className={`overview-dashboard overview-orientation${isEmpty ? ' is-empty' : ''}`} id="overview">
      <header className="overview-week-header overview-orientation-header">
        <div className="overview-week-copy">
          <p className="eyebrow overview-hero-context">{workspaceName || 'Workspace'} · {template.name}</p>
          <p className="overview-week-date">{isHistorical ? 'Historical week' : 'Current week'} · {formatWeekRangeLabel(selectedWeek)}</p>
          <h1 className="overview-hero-heading">{isEmpty ? "Let's get your week moving" : 'Your week, at a glance'}</h1>
          <p className="overview-week-description">{isEmpty ? "You haven't planned anything yet." : 'Follow the path below to move from planning to reporting.'}</p>
        </div>
        <div className="overview-week-side">
          <button className="button button-primary" type="button" onClick={() => onNavigate(nextAction.destination)}>{nextAction.label} <AppIcon name="arrow-right" /></button>
        </div>
      </header>

      <section className="overview-orientation-pathway" aria-labelledby="overview-pathway-heading">
        <div className="overview-orientation-intro">
          <p className="eyebrow">Your WeekFlow pathway</p>
          <h2 id="overview-pathway-heading">One clear path through the week.</h2>
        </div>
        <nav className="overview-workflow-rail" aria-label="WeekFlow workflow">
          <a className={`overview-workflow-step${isEmpty ? ' is-current' : ' is-complete'}`} href="/weekly-plan" onClick={(event) => { event.preventDefault(); onNavigate('weekly-plan') }} style={{ ['--orb-delay' as any]: '0s', ['--orb-duration' as any]: '6.0s' }}><span className="overview-workflow-orb" aria-hidden="true" /><span>01</span><strong>Plan</strong><small>Weekly Plan</small></a>
          <a className={`overview-workflow-step${activities.length > 0 ? ' is-complete' : isEmpty ? ' is-muted' : ' is-current'}`} href="/daily-activity" onClick={(event) => { event.preventDefault(); onNavigate('daily-activity') }} style={{ ['--orb-delay' as any]: '0.4s', ['--orb-duration' as any]: '6.8s' }}><span className="overview-workflow-orb" aria-hidden="true" /><span>02</span><strong>Act</strong><small>Daily Activity</small></a>
          <a className={`overview-workflow-step${hasOpenFollowUps ? ' is-current' : isEmpty ? ' is-muted' : ''}`} href="/follow-ups" onClick={(event) => { event.preventDefault(); onNavigate('follow-ups') }} style={{ ['--orb-delay' as any]: '0.8s', ['--orb-duration' as any]: '7.2s' }}><span className="overview-workflow-orb" aria-hidden="true" /><span>03</span><strong>Follow-up</strong><small>Follow-ups</small></a>
          <a className={`overview-workflow-step${reportStatus === 'ready' ? ' is-complete' : isEmpty ? ' is-muted' : ' is-current'}`} href="/report" onClick={(event) => { event.preventDefault(); onNavigate('report') }} style={{ ['--orb-delay' as any]: '0.2s', ['--orb-duration' as any]: '6.5s' }}><span className="overview-workflow-orb" aria-hidden="true" /><span>04</span><strong>Review</strong><small>Generate Report</small></a>
          <a className={`overview-workflow-step${isEmpty ? ' is-muted' : ''}`} href="/report-history" onClick={(event) => { event.preventDefault(); onNavigate('report-history') }} style={{ ['--orb-delay' as any]: '1.1s', ['--orb-duration' as any]: '7.5s' }}><span className="overview-workflow-orb" aria-hidden="true" /><span>05</span><strong>Report</strong><small>Report History</small></a>
        </nav>
      </section>
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
