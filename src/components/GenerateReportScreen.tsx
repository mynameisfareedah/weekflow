import { useMemo, useState, type MouseEvent } from 'react'
import { loadDailyActivities } from '../storage/dailyActivityStorage'
import { loadFollowUps } from '../storage/followUpsStorage'
import { getSelectedWeekStart, loadWeeklyPlan } from '../storage/weeklyPlanStorage'
import { deriveWeeklyIntelligence } from '../intelligence/intelligenceEngine'
import type { WeeklyIntelligence } from '../intelligence/intelligenceTypes'
import { exportReportWord, getFixedReportWeekLabel } from '../utils/reportDocx'
import { exportReportPdf } from '../utils/reportPdf'
import { exportWeeklyPlanWord } from '../utils/weeklyPlanDocx'
import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from '../config/templates'
import { getReportSectionDescriptors } from '../report/reportTemplateAdapter'
import { mapReportSectionData, type ReportDataMappingResult } from '../report/reportDataMapper'
import { buildNarrativeReport } from '../report/reportNarrative'
import { deriveProjectPerformance } from '../report/projectPerformance'
import type { DailyActivity } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import type { WeeklyPlan } from '../types/weeklyPlan'
import type { ReportSnapshot } from '../utils/reportDocx'
import { navigateTo } from '../utils/navigation'
import { upsertReportHistoryEntry } from '../storage/reportHistoryStorage'
import { getCurrentWorkspaceId } from '../storage/workspaceStorage'
import { AppIcon } from './TemplateIcon'
import './GenerateReport.css'

function formatCompactWeekRange(weekStart: string) {
  const start = new Date(`${weekStart}T12:00:00`)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const startLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(start)
  const endLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(end)
  return `${startLabel} - ${endLabel}`
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function ReportHeader({ weekKey, template }: { weekKey: string; template: WeekFlowTemplate }) {
  return (
    <header className="report-document-header">
      <h2>{template.report.title}</h2>
      <p className="report-document-meta">{formatCompactWeekRange(weekKey)} · {template.name}</p>
    </header>
  )
}

function renderSectionTitle({ order, title, id }: { order: number; title: string; id: string }) {
  return (
    <h3 id={id} className="report-section-title">
      <span className="report-section-number">{String(order).padStart(2, '0')}</span>
      <span className="report-section-separator" aria-hidden="true">—</span>
      <span className="report-section-heading-text">{title}</span>
    </h3>
  )
}

function getTemplateEmptyCopy(template: WeekFlowTemplate, section: ReportDataMappingResult) {
  const sectionId = section.sectionId

  if (template.id === 'project-management') {
    if (sectionId === 'weekly-summary' || sectionId === 'daily-activity-breakdown' || sectionId === 'project-workstream-progress') return 'No project activity recorded yet.'
    if (sectionId === 'key-deliverables') return 'No accomplishments recorded yet.'
    if (sectionId === 'risks-blockers-decisions') return 'No issues, risks, or decisions recorded yet.'
    if (sectionId === 'priorities-coming-week') return 'No next-week priorities recorded yet.'
  }

  if (template.id === 'field-service') {
    if (sectionId === 'weekly-summary' || sectionId === 'daily-activity-breakdown') return 'No service activity recorded yet.'
    if (sectionId === 'priorities-coming-week') return 'No priorities recorded yet.'
  }

  if (template.id === 'field-sales') {
    if (sectionId === 'activities-summary' || sectionId === 'daily-activity-breakdown') return 'No activities recorded yet.'
    if (sectionId === 'virtual-engagements') return 'No virtual engagements recorded yet.'
    if (sectionId === 'commercial-patient-journey-outcomes') return 'No outcomes recorded yet.'
    if (sectionId === 'priorities-coming-week') return 'No priorities recorded yet.'
  }

  if (template.id === 'small-business') {
    if (sectionId === 'business-summary' || sectionId === 'daily-business-activity') return 'No business activity recorded yet.'
    if (sectionId === 'sales-opportunity-progress') return 'No sales activity recorded yet.'
    if (sectionId === 'customer-client-outcomes' || sectionId === 'orders-payments') return 'No outcomes recorded yet.'
    if (sectionId === 'priorities-coming-week') return 'No priorities recorded yet.'
  }

  return section.presentation.emptyState
}

function getRenderableEmptySections(template: WeekFlowTemplate, sections: ReportDataMappingResult[]) {
  return sections
    .filter((section) => section.enabled)
    .filter((section) => {
      if (section.sectionId === 'completed-follow-ups') return false
      if (section.sectionId === 'stakeholder-client-updates') return false
      if (template.id === 'field-sales' && section.sectionId === 'strategic-account-intelligence') return false
      return true
    })
}

function EmptyReportDocument({ plan, template, sections }: { plan: WeeklyPlan; template: WeekFlowTemplate; sections: ReportDataMappingResult[] }) {
  const visibleSections = getRenderableEmptySections(template, sections)

  return (
    <div className="report-empty-document">
      {visibleSections.map((section, index) => {
        const order = index + 1
        const sectionId = `${section.sectionId}-${order}`
        const isDailyBreakdown = section.presentation.displayType === 'activity-table'

        return (
          <section key={section.sectionId} className="report-section report-empty-section" aria-labelledby={sectionId}>
            {renderSectionTitle({ order, title: section.title, id: sectionId })}
            {isDailyBreakdown ? (
              <ul className="report-empty-day-list">
                {plan.days.map((day) => (
                  <li key={day.id} className="report-empty-day-row">
                    <span>{day.label} · {formatDate(day.date)}</span>
                    <span>— No activity</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="report-muted is-empty">{getTemplateEmptyCopy(template, section)}</p>
            )}
          </section>
        )
      })}
    </div>
  )
}

export default function GenerateReportScreen({ template = FIELD_SALES_TEMPLATE, historicalSnapshot = null }: { template?: WeekFlowTemplate; historicalSnapshot?: ReportSnapshot | null }) {
  const [liveWeekKey] = useState(getSelectedWeekStart)
  const isHistorical = historicalSnapshot !== null
  const weekKey = historicalSnapshot?.weekKey ?? liveWeekKey
  const [isExporting, setIsExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [pdfExportMessage, setPdfExportMessage] = useState('')
  const [isExportingPlan, setIsExportingPlan] = useState(false)
  const [planExportMessage, setPlanExportMessage] = useState('')
  const [selectedCarryForward, setSelectedCarryForward] = useState<string[]>([])
  const plan = useMemo(() => historicalSnapshot?.plan ?? loadWeeklyPlan(weekKey), [historicalSnapshot, weekKey])
  const activities = useMemo(() => historicalSnapshot?.activities ?? loadDailyActivities(weekKey), [historicalSnapshot, weekKey])
  const followUps = useMemo(() => historicalSnapshot?.followUps ?? loadFollowUps(weekKey), [historicalSnapshot, weekKey])
  const intelligence = useMemo<WeeklyIntelligence>(() => deriveWeeklyIntelligence({ selectedWeek: weekKey, plan, activities, followUps, template }), [weekKey, plan, activities, followUps, template])
  const performance = useMemo(() => historicalSnapshot?.performance ?? (template.id === 'project-management' ? deriveProjectPerformance(plan, activities, followUps, intelligence) : undefined), [historicalSnapshot, template, plan, activities, followUps, intelligence])
  const reportSnapshot = useMemo<ReportSnapshot>(() => historicalSnapshot ?? ({ weekKey, weekLabel: getFixedReportWeekLabel(weekKey), plan, activities, followUps, performance, template }), [historicalSnapshot, weekKey, plan, activities, followUps, performance, template])
  const reportSections = useMemo(() => getReportSectionDescriptors(template).filter((section) => section.enabled).sort((left, right) => left.order - right.order), [template])
  const mappedReportSections = useMemo(() => reportSections.map((section) => mapReportSectionData(reportSnapshot, section, template)), [reportSections, reportSnapshot, template])
  const narrativeReport = useMemo(() => buildNarrativeReport(reportSnapshot), [reportSnapshot])
  const getSectionDataByGroup = (...groups: string[]) => mappedReportSections.find((section) => groups.some((group) => section.groups[group] !== undefined || section.unsupportedGroups.includes(group)))
  const summarySection = mappedReportSections[0]
  const followUpSection = getSectionDataByGroup('priorities', 'followUps')
  const summaryActivities = (summarySection?.groups.dailyActivities as DailyActivity[] | undefined) ?? []
  const summaryFollowUps = (followUpSection?.groups.followUps as FollowUp[] | undefined) ?? []
  void summaryActivities
  void summaryFollowUps
  const readiness = intelligence.reportReadiness
  const isEmptyReport = readiness.status === 'empty'
  const primaryReportAction = !readiness.hasMeaningfulPlan
    ? { label: 'Review Weekly Plan', href: '/weekly-plan', onClick: (event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); navigateTo('/weekly-plan') } }
    : readiness.activityCount === 0
      ? { label: 'Review Daily Activity', href: '/daily-activity', onClick: (event: MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); navigateTo('/daily-activity') } }
      : { label: 'Review Report', href: '#report-preview-heading', onClick: undefined }

  async function handleExportWord() {
    setIsExporting(true)
    setExportMessage('')
    try {
      const snapshot = {
        weekKey,
        weekLabel: getFixedReportWeekLabel(weekKey),
        plan,
        activities,
        followUps,
        performance,
        template,
      }
      if (!isHistorical) await upsertReportHistoryEntry(snapshot, getCurrentWorkspaceId())
      const result = await exportReportWord(snapshot)
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

  async function handleExportPdf() {
    setIsExportingPdf(true)
    setPdfExportMessage('')
    try {
      const snapshot = { weekKey, weekLabel: getFixedReportWeekLabel(weekKey), plan, activities, followUps, performance, template }
      if (!isHistorical) await upsertReportHistoryEntry(snapshot, getCurrentWorkspaceId())
      const result = exportReportPdf(snapshot)
      setPdfExportMessage(`Downloaded ${result.filename}`)
    } catch {
      setPdfExportMessage('PDF export could not be completed. Please try again.')
    } finally {
      setIsExportingPdf(false)
    }
  }

  function carryForwardKey(title: string, account?: string) {
    return `${title}-${account ?? ''}`
  }

  function reviewSelectedInWeeklyPlan() {
    if (template.id === 'project-management' && selectedCarryForward.length > 0) {
      window.sessionStorage.setItem(`weekflow-carry-forward-selection:${getCurrentWorkspaceId()}`, JSON.stringify(selectedCarryForward))
    }
    navigateTo('/weekly-plan')
  }

  return (
    <main className="generate-report-screen" id="report">
      <header className="generate-report-page-header">
        <p className="eyebrow">Generate Report</p>
        <h1>{template.report.title} · {formatCompactWeekRange(weekKey)}</h1>
        {isHistorical && <p className="report-page-historical">Historical Snapshot · Read-only</p>}
      </header>
      {!isEmptyReport && <section className={`report-readiness-compact report-status-${readiness.status}`} aria-labelledby="report-readiness-heading">
        <div className="report-readiness-content">
          <h2 id="report-readiness-heading">{readiness.status === 'ready' ? 'Your report is ready to review' : readiness.status === 'review' ? 'Your report needs a quick review' : "Your report isn't ready yet"}</h2>
          <p>{readiness.status === 'empty' ? 'Start by planning your week or recording activity.' : readiness.summary}</p>
        </div>
        <a className="button button-primary" href={primaryReportAction.href} onClick={primaryReportAction.onClick}>{primaryReportAction.label} <AppIcon name="arrow-right" /></a>
      </section>}
      {isEmptyReport && <section className="report-empty-intro" aria-labelledby="report-empty-heading">
        <h2 id="report-empty-heading">Nothing to report yet</h2>
        <p>Your report will build automatically as you record activity during the week.</p>
        <a className="button button-secondary" href={primaryReportAction.href} onClick={primaryReportAction.onClick}>Plan your week <AppIcon name="arrow-right" /></a>
      </section>}
      {!isEmptyReport && intelligence.dataQualityWarnings.length > 0 && <section className="report-review-items" aria-labelledby="report-review-heading"><div className="report-intelligence-section-heading"><div><p className="report-eyebrow">Before export</p><h2 id="report-review-heading">Review Before Export</h2></div><span>{intelligence.dataQualityWarnings.length}</span></div><ul>{intelligence.dataQualityWarnings.slice(0, 5).map((warning) => <li key={`${warning.title}-${warning.sourceActivityId ?? ''}`}><div><strong>{warning.title}</strong><p>{warning.reason}</p></div><a href={`${warning.sourceActivityId ? '/daily-activity' : '/follow-ups'}`}>Review <AppIcon name="arrow-right" /></a></li>)}</ul></section>}
      {!isEmptyReport && intelligence.carryForwardCandidates.length > 0 && <section className="report-carry-forward" aria-labelledby="carry-forward-heading"><div className="report-intelligence-section-heading"><div><p className="report-eyebrow">Next week planning</p><h2 id="carry-forward-heading">Suggested Carry-Forward</h2><p>These unfinished items may be relevant to next week. Selecting one does not copy it automatically.</p></div><span>{intelligence.carryForwardCandidates.length}</span></div><ul>{intelligence.carryForwardCandidates.slice(0, 6).map((candidate) => { const key = carryForwardKey(candidate.title, candidate.account); return <li key={key}><label><input type="checkbox" checked={selectedCarryForward.includes(key)} onChange={(event) => setSelectedCarryForward((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))} /><span><strong>{candidate.title}</strong><small>{candidate.reason}</small></span></label></li> })}</ul><button className="button button-secondary" type="button" disabled={selectedCarryForward.length === 0} onClick={reviewSelectedInWeeklyPlan}>Review Selected in Weekly Plan</button></section>}
      {template.id === 'project-management' && performance && <section className="report-project-performance" aria-labelledby="project-performance-heading"><div className="report-intelligence-section-heading"><div><p className="report-eyebrow">Project Performance</p><h2 id="project-performance-heading">How the project week performed</h2></div><strong>{performance.overallStatus}</strong></div><div className="report-performance-metrics"><div><span>Tasks completed</span><strong>{performance.completedTasks} / {performance.plannedTasks}</strong></div><div><span>Completion</span><strong>{performance.completionRate === null ? 'Not available' : `${performance.completionRate.toFixed(1)}%`}</strong></div><div><span>Actual vs planned</span><strong>{performance.actualHours === null || performance.plannedHours === null ? 'Not available' : `${performance.actualHours}h / ${performance.plannedHours}h`}</strong></div><div><span>Outstanding follow-ups</span><strong>{performance.followUpsOutstanding}</strong></div></div><p className="report-performance-summary">{performance.summary}</p></section>}
      <section className={`report-export-actions${isEmptyReport ? ' report-export-actions-empty' : ''}`} aria-label="Export options">
        <button className="button button-primary" type="button" onClick={handleExportWord} disabled={isExporting} aria-busy={isExporting}>{isExporting ? 'Generating...' : 'Export Word Document'} {!isExporting && <AppIcon name="arrow-right" />}</button>
        <button className="button button-secondary" type="button" onClick={handleExportPdf} disabled={isExportingPdf} aria-busy={isExportingPdf}>{isExportingPdf ? 'Generating...' : 'Export PDF'} {!isExportingPdf && <AppIcon name="arrow-right" />}</button>
        <button className="report-quiet-button" type="button" onClick={handleExportWeeklyPlan} disabled={isExportingPlan} aria-busy={isExportingPlan}>{isExportingPlan ? 'Generating...' : 'Export Weekly Plan'}</button>
        <button className="report-quiet-button" type="button" onClick={() => window.print()}>Print</button>
        {exportMessage && <p className={`export-message ${exportMessage.toLowerCase().includes('could not') ? 'is-error' : 'is-success'}`} role="status" aria-live="polite">{exportMessage}</p>}
        {pdfExportMessage && <p className={`export-message ${pdfExportMessage.toLowerCase().includes('could not') ? 'is-error' : 'is-success'}`} role="status" aria-live="polite">{pdfExportMessage}</p>}
        {planExportMessage && <p className="export-message" role="status">{planExportMessage}</p>}
      </section>
      {!isEmptyReport && isHistorical && <div className="report-actions-historical"><a className="report-quiet-link" href="/report-history" onClick={(event) => { event.preventDefault(); navigateTo('/report-history') }}>Back to Report History</a></div>}
      <article className="report-preview">
        {!isEmptyReport && <ReportHeader weekKey={weekKey} template={template} />}
        {isEmptyReport ? <EmptyReportDocument plan={plan} template={template} sections={mappedReportSections} /> : <>
          <section className="report-section report-summary-section motion-fade-up" style={{ animationDelay: '140ms' }} aria-labelledby="report-preview-heading">
            <h3 id="report-preview-heading" className="report-section-title"><span className="report-section-number">01</span><span className="report-section-separator" aria-hidden="true">—</span><span className="report-section-heading-text">{narrativeReport.sections[0]?.title ?? summarySection?.title ?? 'Weekly Summary'}</span></h3>
            <p className="report-muted" style={{ marginBottom: '12px' }}>{narrativeReport.summaryText}</p>
            {narrativeReport.sections[0]?.items.slice(0, 6).map((item) => <div key={`${item.title}-${item.summary}`} style={{ marginBottom: '14px' }}><strong style={{ display: 'block', marginBottom: '4px', color: 'var(--color-text-primary)' }}>{item.title}</strong><p className="report-muted" style={{ margin: 0 }}>{item.summary}</p></div>)}
          </section>
          {narrativeReport.sections.slice(1).map((section) => (
            <section key={section.id} className="report-section motion-fade-up" style={{ animationDelay: '200ms' }} aria-labelledby={`${section.id}-heading`}>
              <h3 id={`${section.id}-heading`} className="report-section-title"><span className="report-section-number">{String(section.order).padStart(2, '0')}</span><span className="report-section-separator" aria-hidden="true">—</span><span className="report-section-heading-text">{section.title}</span></h3>
              {section.items.length > 0 ? section.items.map((item) => (
                <div key={`${section.id}-${item.title}-${item.summary}`} style={{ marginBottom: '18px' }}>
                  <strong style={{ display: 'block', marginBottom: '6px', color: 'var(--color-text-primary)' }}>{item.title}</strong>
                  <p className="report-muted" style={{ margin: 0 }}>{item.summary}</p>
                  {item.detail && <p className="report-muted" style={{ marginTop: '8px' }}>{item.detail}</p>}
                </div>
              )) : <p className="report-muted">{section.emptyText}</p>}
            </section>
          ))}
        </>}
      </article>
    </main>
  )
}
