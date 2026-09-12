import { useMemo } from 'react'
import { deriveWeeklyIntelligence } from '../intelligence/intelligenceEngine'
import { loadDailyActivities } from '../storage/dailyActivityStorage'
import { loadFollowUps } from '../storage/followUpsStorage'
import { getCurrentWeekStart, loadWeeklyPlan } from '../storage/weeklyPlanStorage'
import type { WeekFlowTemplate } from '../config/templates'
import type { WeeklyPlan } from '../types/weeklyPlan'
import './OverviewScreen.css'
import { AppIcon } from './TemplateIcon'

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
}

export default function OverviewScreen({ selectedWeek, template, workspaceName, onNavigate }: OverviewScreenProps) {
  const { plan, activities, followUps, reportStatus } = useMemo(() => {
    const loadedPlan = loadWeeklyPlan(selectedWeek)
    const loadedActivities = loadDailyActivities(selectedWeek)
    const loadedFollowUps = loadFollowUps(selectedWeek)
    const intelligence = deriveWeeklyIntelligence({ selectedWeek, plan: loadedPlan, activities: loadedActivities, followUps: loadedFollowUps, template })
    return { plan: loadedPlan, activities: loadedActivities, followUps: loadedFollowUps, reportStatus: intelligence.reportReadiness.status }
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
    </main>
  )
}
