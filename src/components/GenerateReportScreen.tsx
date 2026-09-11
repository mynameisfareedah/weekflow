import { useMemo, useState } from 'react'
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
import { getTemplateTerminology } from '../config/templateTerminology'
import type { DailyActivity, StructuredOutcome } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import type { DayPlan, WeeklyPlan } from '../types/weeklyPlan'
import type { ReportSnapshot } from '../utils/reportDocx'
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

function getSummaryLines(activities: DailyActivity[], followUps: FollowUp[], template: WeekFlowTemplate) {
  const lines: string[] = []
  if (template.id === 'project-management') {
    const projects = unique(activities.map((activity) => activity.account))
    if (projects.length > 0) lines.push(`Project work was recorded across ${projects.length} workstream${projects.length === 1 ? '' : 's'}: ${projects.join(', ')}.`)
    if (activities.length > 0) lines.push(`${activities.length} project activit${activities.length === 1 ? 'y' : 'ies'} captured.`)
    if (followUps.length > 0) lines.push(`${followUps.length} open follow-up${followUps.length === 1 ? '' : 's'} remain for the coming week.`)
    return lines
  }
  if (template.id !== 'field-sales') {
    if (template.id === 'small-business') {
      const accounts = unique(activities.map((activity) => activity.account))
      if (activities.length > 0) lines.push(`${activities.length} business activit${activities.length === 1 ? 'y' : 'ies'} recorded across ${accounts.length} business record${accounts.length === 1 ? '' : 's'}.`)
      const outcomes = unique(activities.flatMap((activity) => activity.structuredOutcomes.map((outcome) => outcome.type)))
      if (outcomes.length > 0) lines.push(`Business outcomes included ${outcomes.join(', ')}.`)
      if (followUps.length > 0) lines.push(`${followUps.length} follow-up${followUps.length === 1 ? '' : 's'} remain for the coming week.`)
      return lines
    }
    if (activities.length > 0) lines.push(`${activities.length} ${template.terminology.activityPlural.toLowerCase()} recorded across ${unique(activities.map((activity) => activity.account)).length} ${template.terminology.accounts.toLowerCase()}.`)
    if (followUps.length > 0) lines.push(`${followUps.length} open ${template.terminology.followUps.toLowerCase()} remain for the coming week.`)
    return lines
  }
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

function ReportHeader({ weekKey, template }: { weekKey: string; template: WeekFlowTemplate }) {
  return (
    <header className="report-document-header">
      <div>
        <p className="report-kicker">WeekFlow {template.id === 'field-sales' ? 'field reporting' : `${template.name.toLowerCase()} reporting`}</p>
        <h2>{template.report.title}</h2>
      </div>
      <div className="report-meta-grid">
        <div><span>Week</span><strong>{formatWeekRange(weekKey)}</strong></div>
        <div><span>Workflow</span><strong>{template.name}</strong></div>
      </div>
    </header>
  )
}

function DailyBreakdown({ plan, template, sectionData }: { plan: WeeklyPlan; template: WeekFlowTemplate; sectionData: ReportDataMappingResult }) {
  const mappedActivities = (sectionData.groups.dailyActivities as DailyActivity[] | undefined) ?? []
  const isFieldSales = template.id === 'field-sales'
  return (
    <section className="report-section" aria-labelledby="daily-breakdown-heading">
      <div className="report-section-heading"><span>02</span><div><p className="report-eyebrow">What happened each day</p><h3 id="daily-breakdown-heading">{sectionData.title}</h3></div></div>
      <div className="daily-report-table" role="table" aria-label="Daily activity breakdown">
        <div className="daily-report-row daily-report-header" role="row"><span>Day</span><span>{template.terminology.account}{isFieldSales ? 's Visited' : ''}</span><span>{template.terminology.people}{isFieldSales ? ' Engaged' : ''}</span><span>{template.terminology.outcome}</span><span>{template.terminology.notes} / {template.terminology.nextAction}</span></div>
        {plan.days.map((day) => {
          const dayActivities = getDayActivities(day, mappedActivities)
          return <div className="daily-report-row" role="row" key={day.id}><strong>{day.label}<small>{formatDate(day.date)}</small></strong><span>{dayActivities.length > 0 ? unique(dayActivities.map((activity) => activity.account)).join(', ') : 'No activity captured'}</span><span>{dayActivities.length > 0 ? unique(dayActivities.flatMap((activity) => activity.hcpNames)).join(', ') || 'Not recorded' : 'Not recorded'}</span><span>{dayActivities.length > 0 ? dayActivities.map((activity) => activity.outcome).filter(Boolean).join(' ') || 'Not recorded' : 'Not recorded'}</span><span>{dayActivities.length > 0 ? dayActivities.flatMap((activity) => [activity.intelligence, activity.nextAction]).filter(Boolean).join(' ') || 'Not recorded' : 'Not recorded'}</span></div>
        })}
      </div>
    </section>
  )
}

function VirtualEngagements({ template, sectionData }: { template: WeekFlowTemplate; sectionData: ReportDataMappingResult }) {
  const virtualActivities = (sectionData.groups.virtualEngagements as DailyActivity[] | undefined) ?? []

  return (
    <section className="report-section" aria-labelledby="virtual-engagements-heading">
      <div className="report-section-heading"><span>03</span><div><p className="report-eyebrow">{template.terminology.activityPlural}</p><h3 id="virtual-engagements-heading">{sectionData.title}</h3></div></div>
      {sectionData.unsupportedGroups.length > 0 ? <p className="report-muted">{sectionData.presentation.emptyState}</p> : virtualActivities.length > 0 ? <div className="report-detail-list">{virtualActivities.map((activity) => <article className="report-detail-item" key={activity.id}><strong>{activity.account}</strong><dl><div><dt>{template.terminology.people}</dt><dd>{activity.hcpNames.join(', ') || 'Not recorded'}</dd></div><div><dt>{template.terminology.outcome}</dt><dd>{activity.outcome || 'Not recorded'}</dd></div><div><dt>{template.terminology.nextAction}</dt><dd>{activity.nextAction || 'Not recorded'}</dd></div></dl></article>)}</div> : <p className="report-muted">{sectionData.presentation.emptyState}</p>}
    </section>
  )
}

function StructuredOutcomes({ activities, template, sectionData }: { activities: DailyActivity[]; template: WeekFlowTemplate; sectionData: ReportDataMappingResult }) {
  const toReportOutcomes = (values: StructuredOutcome[]) => values.map((outcome) => ({ ...outcome, account: activities.find((activity) => activity.structuredOutcomes.some((candidate) => candidate.id === outcome.id))?.account ?? '' }))
  const mappedOutcomes = [
    ...toReportOutcomes((sectionData.groups.commercialOutcomes as StructuredOutcome[] | undefined) ?? []),
    ...toReportOutcomes((sectionData.groups.patientJourney as StructuredOutcome[] | undefined) ?? []),
  ]
  const outcomes = mappedOutcomes.length > 0
    ? mappedOutcomes
    : toReportOutcomes((sectionData.groups.outcomes as StructuredOutcome[] | undefined) ?? [])

  return (
    <section className="report-section" aria-labelledby="commercial-outcomes-heading">
      <div className="report-section-heading"><span>04</span><div><p className="report-eyebrow">{template.terminology.outcomes}</p><h3 id="commercial-outcomes-heading">{sectionData.title}</h3></div></div>
      {sectionData.unsupportedGroups.length > 0 ? <p className="report-muted">{sectionData.presentation.emptyState}</p> : outcomes.length > 0 ? <div className="outcome-report-grid">{outcomes.map((outcome) => <article className="outcome-report-item" key={outcome.id}><strong>{outcome.type}</strong><span>{outcome.account}</span><p>{[outcome.product, outcome.quantity ? `Quantity: ${outcome.quantity}` : '', outcome.stockStatus, outcome.details].filter(Boolean).join(' - ') || 'Details not recorded.'}</p></article>)}</div> : <p className="report-muted">{sectionData.presentation.emptyState}</p>}
    </section>
  )
}

function StrategicIntelligence({ activities, plan, template, sectionData }: { activities: DailyActivity[]; plan: WeeklyPlan; template: WeekFlowTemplate; sectionData: ReportDataMappingResult }) {
  const intelligence = activities.flatMap((activity) => activity.intelligence ? [`${activity.account}: ${activity.intelligence}`] : [])
  const plannedPriorities = plan.days.flatMap((day) => day.categories.commercialPriorities.map((item) => item.text))
  if (sectionData.unsupportedGroups.length > 0) return <section className="report-section" aria-labelledby="strategic-intelligence-heading"><div className="report-section-heading"><span>05</span><div><p className="report-eyebrow">{template.terminology.notes}</p><h3 id="strategic-intelligence-heading">{sectionData.title}</h3></div></div><p className="report-muted">{sectionData.presentation.emptyState}</p></section>
  const items = unique([...intelligence, ...plannedPriorities])

  return (
    <section className="report-section" aria-labelledby="strategic-intelligence-heading">
      <div className="report-section-heading"><span>05</span><div><p className="report-eyebrow">{template.terminology.notes}</p><h3 id="strategic-intelligence-heading">{sectionData.title}</h3></div></div>
      {items.length > 0 ? <ul className="report-bullet-list">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="report-muted">No strategic intelligence recorded.</p>}
    </section>
  )
}

function StakeholderUpdates({ activities, template, sectionData }: { activities: DailyActivity[]; template: WeekFlowTemplate; sectionData: ReportDataMappingResult }) {
  if (sectionData.unsupportedGroups.length > 0) return <section className="report-section" aria-labelledby="stakeholder-updates-heading"><div className="report-section-heading"><span>06</span><div><p className="report-eyebrow">{template.terminology.people}</p><h3 id="stakeholder-updates-heading">{sectionData.title}</h3></div></div><p className="report-muted">{sectionData.presentation.emptyState}</p></section>
  const updates = unique(activities.flatMap((activity) => activity.hcpNames.map((stakeholder) => `${stakeholder}: ${activity.outcome || activity.intelligence || 'Update not recorded.'}`)))
  return <section className="report-section" aria-labelledby="stakeholder-updates-heading"><div className="report-section-heading"><span>06</span><div><p className="report-eyebrow">{template.terminology.people}</p><h3 id="stakeholder-updates-heading">{sectionData.title}</h3></div></div>{updates.length > 0 ? <ul className="report-bullet-list">{updates.map((update) => <li key={update}>{update}</li>)}</ul> : <p className="report-muted">{sectionData.presentation.emptyState}</p>}</section>
}

function FollowUpReport({ followUps, template, sectionData, completedSection, showCompleted = true }: { followUps: FollowUp[]; template: WeekFlowTemplate; sectionData: ReportDataMappingResult; completedSection?: ReportDataMappingResult; showCompleted?: boolean }) {
  const mappedFollowUps = (sectionData.groups.followUps as FollowUp[] | undefined) ?? followUps
  const openFollowUps = mappedFollowUps.filter((followUp) => followUp.status === 'open')
  const completedFollowUps = mappedFollowUps.filter((followUp) => followUp.status === 'completed')

  return (
    <section className="report-section" aria-labelledby="priorities-heading">
      <div className="report-section-heading"><span>{String(sectionData.order).padStart(2, '0')}</span><div><p className="report-eyebrow">{template.terminology.prioritiesForComingWeek}</p><h3 id="priorities-heading">{sectionData.title}</h3></div></div>
      <div className="priority-report-columns">
        <div><h4>Priorities for next week</h4>{openFollowUps.length > 0 ? <ul className="report-bullet-list">{openFollowUps.map((followUp) => <li className={followUp.priority === 'high' ? 'is-high-priority' : ''} key={followUp.id}><strong>{followUp.task}</strong>{(followUp.facility || followUp.hcpName || followUp.dueDate) && <small>{[followUp.facility, followUp.hcpName, followUp.dueDate ? `Due ${formatDate(followUp.dueDate)}` : ''].filter(Boolean).join(' | ')}</small>}</li>)}</ul> : <p className="report-muted">No open follow-ups recorded.</p>}</div>
        {showCompleted && <div><h4>{completedSection?.title ?? 'Completed Follow-ups'}</h4>{completedFollowUps.length > 0 ? <ul className="report-bullet-list">{completedFollowUps.map((followUp) => <li key={followUp.id}>{followUp.task}</li>)}</ul> : <p className="report-muted">{completedSection?.presentation.emptyState ?? sectionData.presentation.emptyState}</p>}</div>}
      </div>
    </section>
  )
}

function SmallBusinessOutcomeSection({ activities, sectionData, types, eyebrow }: { activities: DailyActivity[]; sectionData: ReportDataMappingResult; types: string[]; eyebrow: string }) {
  const outcomes = (sectionData.groups.outcomes as StructuredOutcome[] | undefined)?.filter((outcome) => types.includes(outcome.type)) ?? []
  const accountByOutcome = new Map(activities.flatMap((activity) => activity.structuredOutcomes.map((outcome) => [outcome.id, activity.account] as const)))
  return <section className="report-section" aria-labelledby={`${sectionData.sectionId}-heading`}><div className="report-section-heading"><span>{String(sectionData.order).padStart(2, '0')}</span><div><p className="report-eyebrow">{eyebrow}</p><h3 id={`${sectionData.sectionId}-heading`}>{sectionData.title}</h3></div></div>{outcomes.length > 0 ? <div className="outcome-report-grid">{outcomes.map((outcome) => <article className="outcome-report-item" key={outcome.id}><strong>{outcome.type}</strong><span>{accountByOutcome.get(outcome.id) ?? ''}</span><p>{outcome.details || 'Details not recorded.'}</p></article>)}</div> : <p className="report-muted">{sectionData.presentation.emptyState}</p>}</section>
}

function SmallBusinessIntelligenceSection({ sectionData }: { sectionData: ReportDataMappingResult }) {
  const items = sectionData.groups.intelligence as Array<{ account: string; type: string; details: string }> | undefined
  return <section className="report-section" aria-labelledby={`${sectionData.sectionId}-heading`}><div className="report-section-heading"><span>{String(sectionData.order).padStart(2, '0')}</span><div><p className="report-eyebrow">Business intelligence</p><h3 id={`${sectionData.sectionId}-heading`}>{sectionData.title}</h3></div></div>{items && items.length > 0 ? <ul className="report-bullet-list">{items.map((item, index) => <li key={`${item.account}-${item.type}-${index}`}><strong>{item.type}</strong><small>{item.account}: {item.details}</small></li>)}</ul> : <p className="report-muted">{sectionData.presentation.emptyState}</p>}</section>
}

function SmallBusinessReportPreview({ plan, activities, followUps, template, sections }: { plan: WeeklyPlan; activities: DailyActivity[]; followUps: FollowUp[]; template: WeekFlowTemplate; sections: ReportDataMappingResult[] }) {
  const byId = (id: string) => sections.find((section) => section.sectionId === id)
  const summary = byId('business-summary')
  const daily = byId('daily-business-activity')
  const sales = byId('sales-opportunity-progress')
  const customer = byId('customer-client-outcomes')
  const orders = byId('orders-payments')
  const operations = byId('supplier-operational-intelligence')
  const priorities = byId('priorities-coming-week')
  const completed = byId('completed-follow-ups')
  if (!summary || !daily || !sales || !customer || !orders || !operations || !priorities || !completed) return null
  const summaryLines = getSummaryLines(activities, followUps, template)
  return <>
    <section className="report-section report-summary-section" aria-labelledby="business-summary-heading"><div className="report-section-heading"><span>01</span><div><p className="report-eyebrow">The week at a glance</p><h3 id="business-summary-heading">{summary.title}</h3></div></div>{summaryLines.length > 0 ? <ul className="report-bullet-list">{summaryLines.map((line) => <li key={line}>{line}</li>)}</ul> : <p className="report-muted">{summary.presentation.emptyState}</p>}</section>
    <DailyBreakdown plan={plan} template={template} sectionData={daily} />
    <SmallBusinessOutcomeSection activities={activities} sectionData={sales} types={['Sale / Order Won', 'Lead Qualified']} eyebrow="Sales and opportunities" />
    <SmallBusinessOutcomeSection activities={activities} sectionData={customer} types={['Customer Retained', 'Follow-up Required']} eyebrow="Customer and client outcomes" />
    <SmallBusinessOutcomeSection activities={activities} sectionData={orders} types={['Payment Received']} eyebrow="Orders and payments" />
    <SmallBusinessIntelligenceSection sectionData={operations} />
    <FollowUpReport followUps={followUps} template={template} sectionData={priorities} completedSection={completed} showCompleted={false} />
    <section className="report-section" aria-labelledby="completed-follow-ups-heading"><div className="report-section-heading"><span>08</span><div><p className="report-eyebrow">Follow-through</p><h3 id="completed-follow-ups-heading">{completed.title}</h3></div></div><p className="report-muted">{completed.presentation.emptyState}</p></section>
  </>
}

export default function GenerateReportScreen({ template = FIELD_SALES_TEMPLATE }: { template?: WeekFlowTemplate }) {
  const terminology = getTemplateTerminology(template)
  const [weekKey] = useState(getSelectedWeekStart)
  const [isExporting, setIsExporting] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [pdfExportMessage, setPdfExportMessage] = useState('')
  const [isExportingPlan, setIsExportingPlan] = useState(false)
  const [planExportMessage, setPlanExportMessage] = useState('')
  const [selectedCarryForward, setSelectedCarryForward] = useState<string[]>([])
  const plan = useMemo(() => loadWeeklyPlan(weekKey), [weekKey])
  const activities = useMemo(() => loadDailyActivities(weekKey), [weekKey])
  const followUps = useMemo(() => loadFollowUps(weekKey), [weekKey])
  const intelligence = useMemo<WeeklyIntelligence>(() => deriveWeeklyIntelligence({ selectedWeek: weekKey, plan, activities, followUps, template }), [weekKey, plan, activities, followUps, template])
  const reportSnapshot = useMemo<ReportSnapshot>(() => ({ weekKey, weekLabel: getFixedReportWeekLabel(weekKey), plan, activities, followUps, template }), [weekKey, plan, activities, followUps, template])
  const reportSections = useMemo(() => getReportSectionDescriptors(template).filter((section) => section.enabled).sort((left, right) => left.order - right.order), [template])
  const mappedReportSections = useMemo(() => reportSections.map((section) => mapReportSectionData(reportSnapshot, section, template)), [reportSections, reportSnapshot, template])
  const getSectionData = (id: string) => mappedReportSections.find((section) => section.sectionId === id)
  const getSectionDataByGroup = (...groups: string[]) => mappedReportSections.find((section) => groups.some((group) => section.groups[group] !== undefined || section.unsupportedGroups.includes(group)))
  const getSectionDataByPresentation = (...displayTypes: ReportDataMappingResult['presentation']['displayType'][]) => mappedReportSections.find((section) => displayTypes.includes(section.presentation.displayType))
  const summarySection = mappedReportSections[0]
  const dailyBreakdownSection = getSectionDataByPresentation('activity-table')
  const activityOutcomeSection = getSectionDataByPresentation('activity-list') ?? getSectionDataByGroup('projectProgress')
  const structuredOutcomeSection = getSectionDataByPresentation('outcomes') ?? getSectionDataByGroup('deliverables')
  const intelligenceSection = getSectionDataByPresentation('intelligence') ?? getSectionDataByGroup('strategicAccounts', 'risks', 'blockers', 'decisions')
  const stakeholderSection = getSectionDataByGroup('stakeholders')
  const followUpSection = getSectionDataByGroup('priorities', 'followUps')
  const completedFollowUpSection = getSectionData('completed-follow-ups')
  const summaryActivities = (summarySection?.groups.dailyActivities as DailyActivity[] | undefined) ?? []
  const summaryFollowUps = (followUpSection?.groups.followUps as FollowUp[] | undefined) ?? []
  const summaryLines = getSummaryLines(summaryActivities, summaryFollowUps, template)
  const readiness = intelligence.reportReadiness
  const readinessLabel = readiness.status === 'ready' ? 'Ready to Review' : readiness.status === 'review' ? 'Needs Attention' : "Week Hasn't Started"
  const readinessStatement = readiness.status === 'ready' ? 'Report is ready to review and export.' : readiness.status === 'review' ? 'Some report information is incomplete.' : 'No completed activity exists for this week yet.'
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
        template,
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

  async function handleExportPdf() {
    setIsExportingPdf(true)
    setPdfExportMessage('')
    try {
      const result = exportReportPdf({ weekKey, weekLabel: getFixedReportWeekLabel(weekKey), plan, activities, followUps, template })
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

  return (
    <main className="generate-report-screen" id="report">
      <header className="generate-report-workspace-header motion-fade-up">
        <div className="generate-report-workspace-copy">
          <p className="eyebrow">Generate Report</p>
          <h1>{terminology.report}</h1>
        </div>
        <div className="generate-report-workspace-meta">
          <div>
            <span>Reporting week</span>
            <strong>{formatWeekRange(weekKey)}</strong>
          </div>
          <div>
            <span>Template</span>
            <strong>{template.name}</strong>
          </div>
          <div className={`report-workspace-status report-workspace-status-${readiness.status}`}>
            <span>Readiness</span>
            <strong>{readinessLabel}</strong>
            <small>{readiness.summary}</small>
          </div>
        </div>
      </header>
      {plannedCoveragePercent !== null && (
        <div className="report-progress motion-fade-up" style={{ animationDelay: '120ms' }} aria-label={`Report completeness ${plannedCoveragePercent}%`}>
          <div className="report-progress-header">
            <span>Report readiness</span>
            <strong>{plannedCoveragePercent}%</strong>
          </div>
          <div className="report-progress-track" aria-hidden="true">
            <span style={{ width: `${Math.max(plannedCoveragePercent, 4)}%` }} />
          </div>
        </div>
      )}
      <section className={`report-readiness report-readiness-${readiness.status} motion-fade-up`} style={{ animationDelay: '160ms' }} aria-labelledby="report-readiness-heading">
        <div className="report-readiness-heading"><div><p className="report-eyebrow">WeekFlow Intelligence</p><h2 id="report-readiness-heading">Report Readiness</h2><p className="report-readiness-summary">{readiness.summary}</p></div><strong>{readinessLabel}</strong></div>
        <p className="report-readiness-statement">{readinessStatement}</p>
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
            <p>{template.terminology.activityPlural}, {template.terminology.objectives.toLowerCase()} and {template.terminology.accounts.toLowerCase()} for the selected week.</p>
            <span className="weekly-report-output-availability">Available for export</span>
            <div className="weekly-report-output-actions">
              <a className="button button-secondary" href="/weekly-plan">Review Weekly Plan</a>
              <button className="button button-primary" type="button" onClick={handleExportWeeklyPlan} disabled={isExportingPlan} aria-busy={isExportingPlan}>{isExportingPlan ? 'Generating...' : 'Export Weekly Plan'} {!isExportingPlan && <span aria-hidden="true">→</span>}</button>
            </div>
            {planExportMessage && <p className="export-message" role="status">{planExportMessage}</p>}
          </article>
          <article className="weekly-report-output-card">
            <p className="report-eyebrow">What was actually done</p>
                <h3>{template.report.title}</h3>
                <p>{template.terminology.activityPlural} and {template.terminology.followUps.toLowerCase()} captured for the selected week.</p>
            <span className="weekly-report-output-availability">Available for export</span>
            <div className="weekly-report-output-actions">
              <a className="button button-secondary" href="#report-preview-heading">Review Report</a>
              <button className="button button-primary" type="button" onClick={handleExportWord} disabled={isExporting} aria-busy={isExporting}>{isExporting ? 'Generating...' : 'Export Word Document'} {!isExporting && <span aria-hidden="true">→</span>}</button>
              <button className="button button-secondary" type="button" onClick={handleExportPdf} disabled={isExportingPdf} aria-busy={isExportingPdf}>{isExportingPdf ? 'Generating...' : 'Export PDF'} {!isExportingPdf && <span aria-hidden="true">→</span>}</button>
            </div>
            {exportMessage && <p className={`export-message ${exportMessage.toLowerCase().includes('could not') ? 'is-error' : 'is-success'}`} role="status" aria-live="polite">{exportMessage}</p>}
            {pdfExportMessage && <p className={`export-message ${pdfExportMessage.toLowerCase().includes('could not') ? 'is-error' : 'is-success'}`} role="status" aria-live="polite">{pdfExportMessage}</p>}
          </article>
        </div>
      </section>
      <div className="report-actions"><a className="button button-secondary" href="/weekly-plan">Back to Edit</a><div className="report-source-links"><a href="/weekly-plan">Weekly Plan</a><a href="/daily-activity">Daily Activity</a><a href="/follow-ups">Follow-ups</a></div><button className="button button-secondary" type="button" onClick={() => window.print()}>Print Report</button></div>
      <article className="report-preview" aria-labelledby="report-preview-heading">
        <div className="report-preview-label" id="report-preview-heading">Report Preview</div>
        <ReportHeader weekKey={weekKey} template={template} />
        {template.id === 'small-business' ? <SmallBusinessReportPreview plan={plan} activities={activities} followUps={followUps} template={template} sections={mappedReportSections} /> : <>
          {summarySection && <section className="report-section report-summary-section motion-fade-up" style={{ animationDelay: '140ms' }} aria-labelledby="activities-summary-heading"><div className="report-section-heading"><span>01</span><div><p className="report-eyebrow">The week at a glance</p><h3 id="activities-summary-heading">{summarySection.title}</h3></div></div>{summaryLines.length > 0 ? <ul className="report-bullet-list">{summaryLines.map((line) => <li key={line}>{line}</li>)}</ul> : <p className="report-muted">{summarySection.presentation.emptyState}</p>}</section>}
          {dailyBreakdownSection && <div className="motion-fade-up" style={{ animationDelay: '200ms' }}><DailyBreakdown plan={plan} template={template} sectionData={dailyBreakdownSection} /></div>}
          {activityOutcomeSection && <div className="motion-fade-up" style={{ animationDelay: '260ms' }}><VirtualEngagements template={template} sectionData={activityOutcomeSection} /></div>}
          {structuredOutcomeSection && <div className="motion-fade-up" style={{ animationDelay: '320ms' }}><StructuredOutcomes activities={activities} template={template} sectionData={structuredOutcomeSection} /></div>}
          {intelligenceSection && <div className="motion-fade-up" style={{ animationDelay: '380ms' }}><StrategicIntelligence activities={activities} plan={plan} template={template} sectionData={intelligenceSection} /></div>}
          {stakeholderSection && <div className="motion-fade-up" style={{ animationDelay: '440ms' }}><StakeholderUpdates activities={activities} template={template} sectionData={stakeholderSection} /></div>}
          {followUpSection && <div className="motion-fade-up" style={{ animationDelay: '500ms' }}><FollowUpReport followUps={followUps} template={template} sectionData={followUpSection} completedSection={completedFollowUpSection} /></div>}
        </>}
      </article>
    </main>
  )
}
