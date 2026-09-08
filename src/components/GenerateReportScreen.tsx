import { useMemo, useState } from 'react'
import { loadDailyActivities } from '../storage/dailyActivityStorage'
import { loadFollowUps } from '../storage/followUpsStorage'
import { getSelectedWeekStart, loadWeeklyPlan } from '../storage/weeklyPlanStorage'
import { deriveWeeklyIntelligence } from '../intelligence/intelligenceEngine'
import type { WeeklyIntelligence } from '../intelligence/intelligenceTypes'
import { exportReportWord, getFixedReportMetadata, getFixedReportWeekLabel } from '../utils/reportDocx'
import { exportWeeklyPlanWord } from '../utils/weeklyPlanDocx'
import { FIELD_SALES_TEMPLATE } from '../config/templates'
import type { DailyActivity } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import type { DayPlan, WeeklyPlan } from '../types/weeklyPlan'
import './GenerateReport.css'

function formatWeekRange(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 4)
  const startLabel = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric' }).format(start)
  const endLabel = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(end)
  return `${startLabel} - ${endLabel}`
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function getDayActivities(day: DayPlan, activities: DailyActivity[]) {
  return activities.filter((activity) => activity.date === day.date)
}

function getSummaryLines(activities: DailyActivity[], followUps: FollowUp[]) {
  const lines: string[] = []
  const physicalVisits = activities.filter((activity) => activity.activityType === 'Physical Visit').length
  const virtualEngagements = activities.filter((activity) => activity.activityType === 'Virtual Engagement').length
  const facilities = unique(activities.map((activity) => activity.account))
  const structuredTypes = unique(activities.flatMap((activity) => activity.structuredOutcomes.map((outcome) => outcome.type.toLowerCase())))

  if (facilities.length > 0) lines.push(`Field coverage recorded across ${facilities.length} account${facilities.length === 1 ? '' : 's'}: ${facilities.join(', ')}.`)
  if (physicalVisits > 0) lines.push(`${physicalVisits} physical visit${physicalVisits === 1 ? '' : 's'} captured.`)
  if (virtualEngagements > 0) lines.push(`${virtualEngagements} virtual engagement${virtualEngagements === 1 ? '' : 's'} captured.`)
  if (structuredTypes.length > 0) lines.push(`Structured outcomes included ${structuredTypes.join(', ')}.`)
  if (followUps.length > 0) lines.push(`${followUps.length} open follow-up${followUps.length === 1 ? '' : 's'} remain for the coming week.`)
  return lines
}

function ReportHeader({ weekKey }: { weekKey: string }) {
  const fixedMetadata = getFixedReportMetadata()
  return (
    <header className="report-document-header">
      <div>
        <p className="report-kicker">WeekFlow field reporting</p>
        <h2>{FIELD_SALES_TEMPLATE.report.title}</h2>
      </div>
      <div className="report-meta-grid">
        <div><span>Week</span><strong>{formatWeekRange(weekKey)}</strong></div>
        <div><span>Prepared by</span><strong>{fixedMetadata.preparedBy}</strong></div>
        <div><span>Role</span><strong>{fixedMetadata.role}</strong></div>
        <div><span>Portfolio</span><strong>{fixedMetadata.portfolio}</strong></div>
      </div>
    </header>
  )
}

function DailyBreakdown({ plan, activities }: { plan: WeeklyPlan; activities: DailyActivity[] }) {
  return (
    <section className="report-section" aria-labelledby="daily-breakdown-heading">
      <div className="report-section-heading"><span>02</span><div><p className="report-eyebrow">What happened each day</p><h3 id="daily-breakdown-heading">Daily {FIELD_SALES_TEMPLATE.terminology.activity} Breakdown</h3></div></div>
      <div className="daily-report-table" role="table" aria-label="Daily activity breakdown">
        <div className="daily-report-row daily-report-header" role="row"><span>Day</span><span>Facilities Visited</span><span>Doctors Engaged</span><span>Outcome of Visit</span><span>Key Intelligence / Next Action</span></div>
        {plan.days.map((day) => {
          const dayActivities = getDayActivities(day, activities)
          return <div className="daily-report-row" role="row" key={day.id}><strong>{day.label}<small>{formatDate(day.date)}</small></strong><span>{dayActivities.length > 0 ? unique(dayActivities.map((activity) => activity.account)).join(', ') : 'No activity captured'}</span><span>{dayActivities.length > 0 ? unique(dayActivities.flatMap((activity) => activity.hcpNames)).join(', ') || 'Not recorded' : 'Not recorded'}</span><span>{dayActivities.length > 0 ? dayActivities.map((activity) => activity.outcome).filter(Boolean).join(' ') || 'Not recorded' : 'Not recorded'}</span><span>{dayActivities.length > 0 ? dayActivities.flatMap((activity) => [activity.intelligence, activity.nextAction]).filter(Boolean).join(' ') || 'Not recorded' : 'Not recorded'}</span></div>
        })}
      </div>
    </section>
  )
}

function VirtualEngagements({ activities }: { activities: DailyActivity[] }) {
  const virtualActivities = activities.filter((activity) => activity.activityType === 'Virtual Engagement')
  if (virtualActivities.length === 0) return null

  return (
    <section className="report-section" aria-labelledby="virtual-engagements-heading">
      <div className="report-section-heading"><span>03</span><div><p className="report-eyebrow">Remote coverage</p><h3 id="virtual-engagements-heading">Virtual Engagements</h3></div></div>
      <div className="report-detail-list">{virtualActivities.map((activity) => <article className="report-detail-item" key={activity.id}><strong>{activity.account}</strong><dl><div><dt>Doctors engaged</dt><dd>{activity.hcpNames.join(', ') || 'Not recorded'}</dd></div><div><dt>Outcome</dt><dd>{activity.outcome || 'Not recorded'}</dd></div><div><dt>Next action</dt><dd>{activity.nextAction || 'Not recorded'}</dd></div></dl></article>)}</div>
    </section>
  )
}

function StructuredOutcomes({ activities }: { activities: DailyActivity[] }) {
  const outcomes = activities.flatMap((activity) => activity.structuredOutcomes.map((outcome) => ({ ...outcome, account: activity.account })))
  if (outcomes.length === 0) return null

  return (
    <section className="report-section" aria-labelledby="commercial-outcomes-heading">
      <div className="report-section-heading"><span>04</span><div><p className="report-eyebrow">Structured intelligence</p><h3 id="commercial-outcomes-heading">Key Commercial / Patient-Journey Outcomes</h3></div></div>
      <div className="outcome-report-grid">{outcomes.map((outcome) => <article className="outcome-report-item" key={outcome.id}><strong>{outcome.type}</strong><span>{outcome.account}</span><p>{[outcome.product, outcome.quantity ? `Quantity: ${outcome.quantity}` : '', outcome.stockStatus, outcome.details].filter(Boolean).join(' - ') || 'Details not recorded.'}</p></article>)}</div>
    </section>
  )
}

function StrategicIntelligence({ activities, plan }: { activities: DailyActivity[]; plan: WeeklyPlan }) {
  const intelligence = activities.flatMap((activity) => activity.intelligence ? [`${activity.account}: ${activity.intelligence}`] : [])
  const plannedPriorities = plan.days.flatMap((day) => day.categories.commercialPriorities.map((item) => item.text))
  const items = unique([...intelligence, ...plannedPriorities])
  if (items.length === 0) return null

  return (
    <section className="report-section" aria-labelledby="strategic-intelligence-heading">
      <div className="report-section-heading"><span>05</span><div><p className="report-eyebrow">Account-level context</p><h3 id="strategic-intelligence-heading">Strategic Account Intelligence</h3></div></div>
      <ul className="report-bullet-list">{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </section>
  )
}

function FollowUpReport({ followUps }: { followUps: FollowUp[] }) {
  const openFollowUps = followUps.filter((followUp) => followUp.status === 'open')
  const completedFollowUps = followUps.filter((followUp) => followUp.status === 'completed')

  return (
    <section className="report-section" aria-labelledby="priorities-heading">
      <div className="report-section-heading"><span>06</span><div><p className="report-eyebrow">Carry-forward actions</p><h3 id="priorities-heading">Priorities for the Coming Week</h3></div></div>
      <div className="priority-report-columns">
        <div><h4>Priorities for next week</h4>{openFollowUps.length > 0 ? <ul className="report-bullet-list">{openFollowUps.map((followUp) => <li className={followUp.priority === 'high' ? 'is-high-priority' : ''} key={followUp.id}><strong>{followUp.task}</strong>{(followUp.facility || followUp.hcpName || followUp.dueDate) && <small>{[followUp.facility, followUp.hcpName, followUp.dueDate ? `Due ${formatDate(followUp.dueDate)}` : ''].filter(Boolean).join(' | ')}</small>}</li>)}</ul> : <p className="report-muted">No open follow-ups recorded.</p>}</div>
        <div><h4>Completed this week</h4>{completedFollowUps.length > 0 ? <ul className="report-bullet-list">{completedFollowUps.map((followUp) => <li key={followUp.id}>{followUp.task}</li>)}</ul> : <p className="report-muted">No completed follow-ups recorded.</p>}</div>
      </div>
    </section>
  )
}

export default function GenerateReportScreen() {
  const [weekKey] = useState(getSelectedWeekStart)
  const [isExporting, setIsExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [isExportingPlan, setIsExportingPlan] = useState(false)
  const [planExportMessage, setPlanExportMessage] = useState('')
  const [selectedCarryForward, setSelectedCarryForward] = useState<string[]>([])
  const plan = useMemo(() => loadWeeklyPlan(weekKey), [weekKey])
  const activities = useMemo(() => loadDailyActivities(weekKey), [weekKey])
  const followUps = useMemo(() => loadFollowUps(weekKey), [weekKey])
  const intelligence = useMemo<WeeklyIntelligence>(() => deriveWeeklyIntelligence({ selectedWeek: weekKey, plan, activities, followUps }), [weekKey, plan, activities, followUps])
  const summaryLines = getSummaryLines(activities, followUps.filter((followUp) => followUp.status === 'open'))
  const readiness = intelligence.reportReadiness
  const readinessLabel = readiness.status === 'ready' ? 'Ready to Review' : readiness.status === 'review' ? 'Needs Attention' : "Week Hasn't Started"
  const activityDetailWarningCount = intelligence.dataQualityWarnings.filter((warning) => warning.sourceActivityId).length
  const plannedCoveragePercent = readiness.plannedItemCount > 0 ? Math.round((readiness.capturedPlannedItemCount / readiness.plannedItemCount) * 100) : null

  async function handleExportWord() {
    setIsExporting(true)
    setExportMessage('')
    try {
      const result = await exportReportWord({
        weekKey,
        weekLabel: getFixedReportWeekLabel(weekKey),
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

  async function handleExportWeeklyPlan() {
    setIsExportingPlan(true)
    setPlanExportMessage('')
    try {
      const result = await exportWeeklyPlanWord(plan)
      setPlanExportMessage(`Downloaded ${result.filename}`)
    } catch {
      setPlanExportMessage('Weekly Plan export could not be completed. Please try again.')
    } finally {
      setIsExportingPlan(false)
    }
  }

  function carryForwardKey(title: string, account?: string) {
    return `${title}-${account ?? ''}`
  }

  return (
    <main className="generate-report-screen" id="report">
      <div className="generate-report-heading"><div><p className="eyebrow">Review before sharing</p><h1>Generate Report</h1><p className="generate-report-intro">Review this week's captured activity and generate your Field Activity Report.</p></div><div className="report-week-context"><span>Selected week</span><strong>{formatWeekRange(weekKey)}</strong></div></div>
      <section className={`report-readiness report-readiness-${readiness.status}`} aria-labelledby="report-readiness-heading">
        <div className="report-readiness-heading"><div><p className="report-eyebrow">WeekFlow Intelligence</p><h2 id="report-readiness-heading">Report Readiness</h2><p className="report-readiness-summary">{readiness.summary}</p></div><strong>{readinessLabel}</strong></div>
        <div className="report-readiness-metrics">
          <div><span>Weekly Plan</span><strong>{readiness.hasMeaningfulPlan ? 'Complete' : 'Needs attention'}</strong><small>{readiness.hasMeaningfulPlan ? 'Meaningful plan content captured' : 'No meaningful plan content yet'}</small></div>
          <div><span>Daily Activity</span><strong>{readiness.activityCount} activit{readiness.activityCount === 1 ? 'y' : 'ies'} captured</strong><small>{readiness.activityCount > 0 ? 'Actual work recorded for the week' : 'No activity records yet'}</small></div>
          <div><span>Planned vs Actual</span><strong>{readiness.plannedItemCount > 0 ? `${readiness.capturedPlannedItemCount} of ${readiness.plannedItemCount} planned items` : 'No planned items'}</strong><small>{plannedCoveragePercent === null ? 'Coverage will appear after planning' : `${plannedCoveragePercent}% captured`}</small></div>
          <div><span>Follow-ups</span><strong>{readiness.openFollowUpCount} open · {readiness.completedFollowUpCount} completed</strong><small>{readiness.openFollowUpCount > 0 ? 'Open work remains visible' : 'No open follow-ups'}</small></div>
        </div>
        <ul className="report-readiness-checklist" aria-label="Report readiness checklist">
          <li className={readiness.hasMeaningfulPlan ? 'is-complete' : 'is-attention'}><span aria-hidden="true">{readiness.hasMeaningfulPlan ? '✓' : '!'}</span><strong>Weekly Plan</strong><small>{readiness.hasMeaningfulPlan ? 'Complete' : 'Needs attention'}</small></li>
          <li className={readiness.activityCount > 0 ? 'is-complete' : 'is-attention'}><span aria-hidden="true">{readiness.activityCount > 0 ? '✓' : '!'}</span><strong>Daily Activity</strong><small>{readiness.activityCount > 0 ? 'Captured' : 'Not started'}</small></li>
          <li className={activityDetailWarningCount === 0 && readiness.activityCount > 0 ? 'is-complete' : 'is-attention'}><span aria-hidden="true">{activityDetailWarningCount === 0 && readiness.activityCount > 0 ? '✓' : '!'}</span><strong>Activity details</strong><small>{activityDetailWarningCount > 0 ? `${activityDetailWarningCount} item${activityDetailWarningCount === 1 ? '' : 's'} need review` : readiness.activityCount > 0 ? 'No detail warnings' : 'Waiting for activity'}</small></li>
          <li className={readiness.openFollowUpCount === 0 ? 'is-complete' : 'is-attention'}><span aria-hidden="true">{readiness.openFollowUpCount === 0 ? '✓' : '!'}</span><strong>Follow-ups reviewed</strong><small>{readiness.openFollowUpCount > 0 ? 'Open items remain' : 'No open items'}</small></li>
        </ul>
        <nav className="report-readiness-links" aria-label="Review report inputs"><a href="/weekly-plan">Review Weekly Plan <span aria-hidden="true">→</span></a><a href="/daily-activity">Review Daily Activity <span aria-hidden="true">→</span></a><a href="/follow-ups">Review Follow-ups <span aria-hidden="true">→</span></a></nav>
      </section>
      {intelligence.dataQualityWarnings.length > 0 && <section className="report-review-items" aria-labelledby="report-review-heading"><div className="report-intelligence-section-heading"><div><p className="report-eyebrow">Before export</p><h2 id="report-review-heading">Review Before Export</h2></div><span>{intelligence.dataQualityWarnings.length}</span></div><ul>{intelligence.dataQualityWarnings.slice(0, 5).map((warning) => <li key={`${warning.title}-${warning.sourceActivityId ?? ''}`}><div><strong>{warning.title}</strong><p>{warning.reason}</p></div><a href={`${warning.sourceActivityId ? '/daily-activity' : '/follow-ups'}`}>Review <span aria-hidden="true">→</span></a></li>)}</ul></section>}
      {intelligence.carryForwardCandidates.length > 0 && <section className="report-carry-forward" aria-labelledby="carry-forward-heading"><div className="report-intelligence-section-heading"><div><p className="report-eyebrow">Next week planning</p><h2 id="carry-forward-heading">Suggested Carry-Forward</h2><p>These unfinished items may be relevant to next week. Selecting one does not copy it automatically.</p></div><span>{intelligence.carryForwardCandidates.length}</span></div><ul>{intelligence.carryForwardCandidates.slice(0, 6).map((candidate) => { const key = carryForwardKey(candidate.title, candidate.account); return <li key={key}><label><input type="checkbox" checked={selectedCarryForward.includes(key)} onChange={(event) => setSelectedCarryForward((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))} /><span><strong>{candidate.title}</strong><small>{candidate.reason}</small></span></label></li> })}</ul><button className="button button-secondary" type="button" disabled={selectedCarryForward.length === 0} onClick={() => { window.history.pushState(null, '', '/weekly-plan'); window.dispatchEvent(new PopStateEvent('popstate')) }}>Review Selected in Weekly Plan</button></section>}
      <section className="weekly-report-outputs" aria-labelledby="weekly-reports-heading">
        <div className="weekly-report-outputs-heading">
          <div>
            <p className="report-eyebrow">Report outputs</p>
            <h2 id="weekly-reports-heading">Weekly Reports</h2>
          </div>
          <span>Selected week: {formatWeekRange(weekKey)}</span>
        </div>
        <div className="weekly-report-output-grid">
          <article className="weekly-report-output-card">
            <p className="report-eyebrow">What was planned</p>
            <h3>Weekly Work Plan</h3>
            <p>Planned activities, objectives and field coverage for the selected week.</p>
            <span className="weekly-report-output-availability">Available for export</span>
            <div className="weekly-report-output-actions">
              <a className="button button-secondary" href="/weekly-plan">Review Weekly Plan</a>
              <button className="button button-primary" type="button" onClick={handleExportWeeklyPlan} disabled={isExportingPlan} aria-busy={isExportingPlan}>{isExportingPlan ? 'Generating...' : 'Export Weekly Plan'} {!isExportingPlan && <span aria-hidden="true">→</span>}</button>
            </div>
            {planExportMessage && <p className="export-message" role="status">{planExportMessage}</p>}
          </article>
          <article className="weekly-report-output-card">
            <p className="report-eyebrow">What was actually done</p>
            <h3>Weekly Field Activity Report</h3>
            <p>Actual Daily Activity records, outcomes, intelligence and follow-ups captured for the selected week.</p>
            <span className="weekly-report-output-availability">Available for export</span>
            <div className="weekly-report-output-actions">
              <a className="button button-secondary" href="#report-preview-heading">Review Report</a>
              <button className="button button-primary" type="button" onClick={handleExportWord} disabled={isExporting} aria-busy={isExporting}>{isExporting ? 'Generating...' : 'Export Weekly Report'} {!isExporting && <span aria-hidden="true">→</span>}</button>
            </div>
            {exportMessage && <p className="export-message" role="status">{exportMessage}</p>}
          </article>
        </div>
      </section>
      <div className="report-actions"><a className="button button-secondary" href="/weekly-plan">Back to Edit</a><div className="report-source-links"><a href="/weekly-plan">Weekly Plan</a><a href="/daily-activity">Daily Activity</a><a href="/follow-ups">Follow-ups</a></div><button className="button button-secondary" type="button" onClick={() => window.print()}>Print Report</button></div>
      <article className="report-preview" aria-labelledby="report-preview-heading">
        <div className="report-preview-label" id="report-preview-heading">Report Preview</div>
        <ReportHeader weekKey={weekKey} />
        <section className="report-section report-summary-section" aria-labelledby="activities-summary-heading"><div className="report-section-heading"><span>01</span><div><p className="report-eyebrow">The week at a glance</p><h3 id="activities-summary-heading">Activities Summary</h3></div></div>{summaryLines.length > 0 ? <ul className="report-bullet-list">{summaryLines.map((line) => <li key={line}>{line}</li>)}</ul> : <p className="report-muted">No Daily Activity has been captured for this week yet.</p>}</section>
        <DailyBreakdown plan={plan} activities={activities} />
        <VirtualEngagements activities={activities} />
        <StructuredOutcomes activities={activities} />
        <StrategicIntelligence activities={activities} plan={plan} />
        <FollowUpReport followUps={followUps} />
      </article>
    </main>
  )
}
