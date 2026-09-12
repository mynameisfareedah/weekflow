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
import type { DailyActivity, StructuredOutcome } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import type { DayPlan, WeeklyPlan } from '../types/weeklyPlan'
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

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

function getDayActivities(day: DayPlan, activities: DailyActivity[]) {
  return activities.filter((activity) => activity.date === day.date)
}

function getSummaryLines(activities: DailyActivity[], followUps: FollowUp[], template: WeekFlowTemplate, plan: WeeklyPlan) {
  const lines: string[] = []
  if (template.id === 'project-management') {
    lines.push(...plan.weeklyStrategicObjectives.map((objective) => objective.text).filter(Boolean))
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
      <h2>{template.report.title}</h2>
      <p className="report-document-meta">{formatCompactWeekRange(weekKey)} · {template.name}</p>
    </header>
  )
}

function DailyBreakdown({ plan, template, sectionData }: { plan: WeeklyPlan; template: WeekFlowTemplate; sectionData: ReportDataMappingResult }) {
  const mappedActivities = (sectionData.groups.dailyActivities as DailyActivity[] | undefined) ?? []
  const isFieldSales = template.id === 'field-sales'
  const hasAnyActivity = mappedActivities.length > 0

  if (!hasAnyActivity) {
    return (
      <section className="report-section" aria-labelledby="daily-breakdown-heading">
        <h3 id="daily-breakdown-heading" className="report-section-title"><span>02</span> {sectionData.title}</h3>
        <div className="daily-activity-empty">
          {plan.days.map((day) => <div key={day.id} className="daily-empty-row"><span className="daily-empty-label">{day.label} · {formatDate(day.date)}</span><span className="daily-empty-value">No activity captured</span></div>)}
        </div>
      </section>
    )
  }

  return (
    <section className="report-section" aria-labelledby="daily-breakdown-heading">
      <h3 id="daily-breakdown-heading" className="report-section-title"><span>02</span> {sectionData.title}</h3>
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
      {renderSectionTitle({ order: 3, title: sectionData.title, id: 'virtual-engagements-heading' })}
      {sectionData.unsupportedGroups.length > 0 ? <p className="report-muted">{sectionData.presentation.emptyState}</p> : virtualActivities.length > 0 ? <div className="report-detail-list">{virtualActivities.map((activity) => <article className="report-detail-item" key={activity.id}><strong>{activity.account}</strong><dl><div><dt>{template.terminology.people}</dt><dd>{activity.hcpNames.join(', ') || 'Not recorded'}</dd></div><div><dt>{template.terminology.outcome}</dt><dd>{activity.outcome || 'Not recorded'}</dd></div><div><dt>{template.terminology.nextAction}</dt><dd>{activity.nextAction || 'Not recorded'}</dd></div></dl></article>)}</div> : <p className="report-muted">{sectionData.presentation.emptyState}</p>}
    </section>
  )
}

function StructuredOutcomes({ activities, sectionData }: { activities: DailyActivity[]; sectionData: ReportDataMappingResult }) {
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
      {renderSectionTitle({ order: 4, title: sectionData.title, id: 'commercial-outcomes-heading' })}
      {sectionData.unsupportedGroups.length > 0 ? <p className="report-muted">{sectionData.presentation.emptyState}</p> : outcomes.length > 0 ? <div className="outcome-report-grid">{outcomes.map((outcome) => <article className="outcome-report-item" key={outcome.id}><strong>{outcome.type}</strong><span>{outcome.account}</span><p>{[outcome.product, outcome.quantity ? `Quantity: ${outcome.quantity}` : '', outcome.stockStatus, outcome.details].filter(Boolean).join(' - ') || 'Details not recorded.'}</p></article>)}</div> : <p className="report-muted">{sectionData.presentation.emptyState}</p>}
    </section>
  )
}

function StrategicIntelligence({ activities, plan, sectionData }: { activities: DailyActivity[]; plan: WeeklyPlan; sectionData: ReportDataMappingResult }) {
  const intelligence = activities.flatMap((activity) => activity.intelligence ? [`${activity.account}: ${activity.intelligence}`] : [])
  const plannedPriorities = plan.days.flatMap((day) => day.categories.commercialPriorities.map((item) => item.text))
  if (sectionData.unsupportedGroups.length > 0) return <section className="report-section" aria-labelledby="strategic-intelligence-heading">{renderSectionTitle({ order: 5, title: sectionData.title, id: 'strategic-intelligence-heading' })}<p className="report-muted">{sectionData.presentation.emptyState}</p></section>
  const items = unique([...intelligence, ...plannedPriorities])

  return (
    <section className="report-section" aria-labelledby="strategic-intelligence-heading">
      {renderSectionTitle({ order: 5, title: sectionData.title, id: 'strategic-intelligence-heading' })}
      {items.length > 0 ? <ul className="report-bullet-list">{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p className="report-muted">{sectionData.presentation.emptyState}</p>}
    </section>
  )
}

function StakeholderUpdates({ activities, sectionData }: { activities: DailyActivity[]; sectionData: ReportDataMappingResult }) {
  if (sectionData.unsupportedGroups.length > 0) return <section className="report-section" aria-labelledby="stakeholder-updates-heading">{renderSectionTitle({ order: 6, title: sectionData.title, id: 'stakeholder-updates-heading' })}<p className="report-muted">{sectionData.presentation.emptyState}</p></section>
  const updates = unique(activities.flatMap((activity) => activity.hcpNames.map((stakeholder) => `${stakeholder}: ${activity.outcome || activity.intelligence || 'Update not recorded.'}`)))
  return <section className="report-section" aria-labelledby="stakeholder-updates-heading">{renderSectionTitle({ order: 6, title: sectionData.title, id: 'stakeholder-updates-heading' })}{updates.length > 0 ? <ul className="report-bullet-list">{updates.map((update) => <li key={update}>{update}</li>)}</ul> : <p className="report-muted">{sectionData.presentation.emptyState}</p>}</section>
}

function FollowUpReport({ followUps, sectionData, showCompleted = true }: { followUps: FollowUp[]; sectionData: ReportDataMappingResult; showCompleted?: boolean }) {
  const mappedFollowUps = (sectionData.groups.followUps as FollowUp[] | undefined) ?? followUps
  const openFollowUps = mappedFollowUps.filter((followUp) => followUp.status === 'open')
  const completedFollowUps = mappedFollowUps.filter((followUp) => followUp.status === 'completed')

  return (
    <section className="report-section" aria-labelledby="priorities-heading">
      {renderSectionTitle({ order: sectionData.order, title: sectionData.title, id: 'priorities-heading' })}
      <div className="priority-report-columns">
        <div>{openFollowUps.length > 0 ? <ul className="report-bullet-list">{openFollowUps.map((followUp) => <li className={followUp.priority === 'high' ? 'is-high-priority' : ''} key={followUp.id}><strong>{followUp.task}</strong>{(followUp.facility || followUp.hcpName || followUp.dueDate) && <small>{[followUp.facility, followUp.hcpName, followUp.dueDate ? `Due ${formatDate(followUp.dueDate)}` : ''].filter(Boolean).join(' | ')}</small>}</li>)}</ul> : <p className="report-muted">No priorities or follow-ups recorded.</p>}</div>
        {showCompleted && <div>{completedFollowUps.length > 0 ? <ul className="report-bullet-list">{completedFollowUps.map((followUp) => <li key={followUp.id}>{followUp.task}</li>)}</ul> : <p className="report-muted"></p>}</div>}
      </div>
    </section>
  )
}

function SmallBusinessOutcomeSection({ activities, sectionData, types }: { activities: DailyActivity[]; sectionData: ReportDataMappingResult; types: string[] }) {
  const outcomes = (sectionData.groups.outcomes as StructuredOutcome[] | undefined)?.filter((outcome) => types.includes(outcome.type)) ?? []
  const accountByOutcome = new Map(activities.flatMap((activity) => activity.structuredOutcomes.map((outcome) => [outcome.id, activity.account] as const)))
  return <section className="report-section" aria-labelledby={`${sectionData.sectionId}-heading`}>{renderSectionTitle({ order: sectionData.order, title: sectionData.title, id: `${sectionData.sectionId}-heading` })}{outcomes.length > 0 ? <div className="outcome-report-grid">{outcomes.map((outcome) => <article className="outcome-report-item" key={outcome.id}><strong>{outcome.type}</strong><span>{accountByOutcome.get(outcome.id) ?? ''}</span><p>{outcome.details || 'Details not recorded.'}</p></article>)}</div> : <p className="report-muted">{sectionData.presentation.emptyState}</p>}</section>
}

function SmallBusinessIntelligenceSection({ sectionData }: { sectionData: ReportDataMappingResult }) {
  const items = sectionData.groups.intelligence as Array<{ account: string; type: string; details: string }> | undefined
  return <section className="report-section" aria-labelledby={`${sectionData.sectionId}-heading`}>{renderSectionTitle({ order: sectionData.order, title: sectionData.title, id: `${sectionData.sectionId}-heading` })}{items && items.length > 0 ? <ul className="report-bullet-list">{items.map((item, index) => <li key={`${item.account}-${item.type}-${index}`}><strong>{item.type}</strong><small>{item.account}: {item.details}</small></li>)}</ul> : <p className="report-muted">{sectionData.presentation.emptyState}</p>}</section>
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
    if (sectionId === 'key-deliverables') return 'No deliverables recorded yet.'
    if (sectionId === 'risks-blockers-decisions') return 'No risks, blockers, or decisions recorded yet.'
    if (sectionId === 'priorities-coming-week') return 'No priorities recorded yet.'
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
  const summaryLines = getSummaryLines(activities, followUps, template, plan)
  return <>
    <section className="report-section report-summary-section" aria-labelledby="business-summary-heading">{renderSectionTitle({ order: 1, title: summary.title, id: 'business-summary-heading' })}{summaryLines.length > 0 ? <ul className="report-bullet-list">{summaryLines.map((line) => <li key={line}>{line}</li>)}</ul> : <p className="report-muted">{summary.presentation.emptyState}</p>}</section>
    <DailyBreakdown plan={plan} template={template} sectionData={daily} />
    <SmallBusinessOutcomeSection activities={activities} sectionData={sales} types={['Sale / Order Won', 'Lead Qualified']} />
    <SmallBusinessOutcomeSection activities={activities} sectionData={customer} types={['Customer Retained', 'Follow-up Required']} />
    <SmallBusinessOutcomeSection activities={activities} sectionData={orders} types={['Payment Received']} />
    <SmallBusinessIntelligenceSection sectionData={operations} />
    <FollowUpReport followUps={followUps} sectionData={priorities} showCompleted={false} />
  </>
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
  const reportSnapshot = useMemo<ReportSnapshot>(() => historicalSnapshot ?? ({ weekKey, weekLabel: getFixedReportWeekLabel(weekKey), plan, activities, followUps, template }), [historicalSnapshot, weekKey, plan, activities, followUps, template])
  const reportSections = useMemo(() => getReportSectionDescriptors(template).filter((section) => section.enabled).sort((left, right) => left.order - right.order), [template])
  const mappedReportSections = useMemo(() => reportSections.map((section) => mapReportSectionData(reportSnapshot, section, template)), [reportSections, reportSnapshot, template])
  const getSectionDataByGroup = (...groups: string[]) => mappedReportSections.find((section) => groups.some((group) => section.groups[group] !== undefined || section.unsupportedGroups.includes(group)))
  const getSectionDataByPresentation = (...displayTypes: ReportDataMappingResult['presentation']['displayType'][]) => mappedReportSections.find((section) => displayTypes.includes(section.presentation.displayType))
  const summarySection = mappedReportSections[0]
  const dailyBreakdownSection = getSectionDataByPresentation('activity-table')
  const activityOutcomeSection = getSectionDataByPresentation('activity-list') ?? getSectionDataByGroup('projectProgress')
  const structuredOutcomeSection = getSectionDataByPresentation('outcomes') ?? getSectionDataByGroup('deliverables')
  const intelligenceSection = getSectionDataByPresentation('intelligence') ?? getSectionDataByGroup('strategicAccounts', 'risks', 'blockers', 'decisions')
  const stakeholderSection = getSectionDataByGroup('stakeholders')
  const followUpSection = getSectionDataByGroup('priorities', 'followUps')
  const summaryActivities = (summarySection?.groups.dailyActivities as DailyActivity[] | undefined) ?? []
  const summaryFollowUps = (followUpSection?.groups.followUps as FollowUp[] | undefined) ?? []
  const summaryLines = getSummaryLines(summaryActivities, summaryFollowUps, template, plan)
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
      const snapshot = { weekKey, weekLabel: getFixedReportWeekLabel(weekKey), plan, activities, followUps, template }
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
      {!isEmptyReport && intelligence.carryForwardCandidates.length > 0 && <section className="report-carry-forward" aria-labelledby="carry-forward-heading"><div className="report-intelligence-section-heading"><div><p className="report-eyebrow">Next week planning</p><h2 id="carry-forward-heading">Suggested Carry-Forward</h2><p>These unfinished items may be relevant to next week. Selecting one does not copy it automatically.</p></div><span>{intelligence.carryForwardCandidates.length}</span></div><ul>{intelligence.carryForwardCandidates.slice(0, 6).map((candidate) => { const key = carryForwardKey(candidate.title, candidate.account); return <li key={key}><label><input type="checkbox" checked={selectedCarryForward.includes(key)} onChange={(event) => setSelectedCarryForward((current) => event.target.checked ? [...current, key] : current.filter((item) => item !== key))} /><span><strong>{candidate.title}</strong><small>{candidate.reason}</small></span></label></li> })}</ul><button className="button button-secondary" type="button" disabled={selectedCarryForward.length === 0} onClick={() => { window.history.pushState(null, '', '/weekly-plan'); window.dispatchEvent(new PopStateEvent('popstate')) }}>Review Selected in Weekly Plan</button></section>}
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
        {isEmptyReport ? <EmptyReportDocument plan={plan} template={template} sections={mappedReportSections} /> : template.id === 'small-business' ? <SmallBusinessReportPreview plan={plan} activities={activities} followUps={followUps} template={template} sections={mappedReportSections} /> : <>
          {summarySection && <section className="report-section report-summary-section motion-fade-up" style={{ animationDelay: '140ms' }} aria-labelledby="activities-summary-heading">{renderSectionTitle({ order: 1, title: summarySection.title, id: 'activities-summary-heading' })}{summaryLines.length > 0 ? <ul className="report-bullet-list">{summaryLines.map((line) => <li key={line}>{line}</li>)}</ul> : <p className="report-muted">{summarySection.presentation.emptyState}</p>}</section>}
          {dailyBreakdownSection && <div className="motion-fade-up" style={{ animationDelay: '200ms' }}><DailyBreakdown plan={plan} template={template} sectionData={dailyBreakdownSection} /></div>}
          {activityOutcomeSection && <div className="motion-fade-up" style={{ animationDelay: '260ms' }}><VirtualEngagements template={template} sectionData={activityOutcomeSection} /></div>}
          {structuredOutcomeSection && <div className="motion-fade-up" style={{ animationDelay: '320ms' }}><StructuredOutcomes activities={activities} sectionData={structuredOutcomeSection} /></div>}
          {intelligenceSection && <div className="motion-fade-up" style={{ animationDelay: '380ms' }}><StrategicIntelligence activities={activities} plan={plan} sectionData={intelligenceSection} /></div>}
          {stakeholderSection && <div className="motion-fade-up" style={{ animationDelay: '440ms' }}><StakeholderUpdates activities={activities} sectionData={stakeholderSection} /></div>}
          {followUpSection && <div className="motion-fade-up" style={{ animationDelay: '500ms' }}><FollowUpReport followUps={followUps} sectionData={followUpSection} /></div>}
        </>}
      </article>
    </main>
  )
}
