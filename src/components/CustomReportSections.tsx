import type { WeeklyPlan } from '../types/weeklyPlan'
import type { DailyActivity } from '../types/dailyActivity'
import type { FollowUp } from '../types/followUp'
import type { CustomReportSection, CustomTemplateConfig } from '../types/customTemplate'
import type { MappedReportSection } from '../report/reportDataMapper'
import type { CustomTargetProgress } from '../customTargets'

function valueText(value: unknown) {
  if (Array.isArray(value)) return value.join(', ')
  return String(value)
}

function activityRows(activity: DailyActivity, config: Pick<CustomTemplateConfig, 'categories' | 'statuses'>) {
  const category = config.categories.find((item) => item.id === activity.customCategoryId)
  const status = config.statuses.find((item) => item.id === activity.customStatusId)?.name
  const fields = category?.fields.map((field) => {
    const value = activity.customFieldValues?.[field.id]
    return value === undefined || value === '' || (Array.isArray(value) && value.length === 0) ? null : `${field.name}: ${valueText(value)}`
  }).filter((value): value is string => Boolean(value)) ?? []
  return [activity.date, activity.account, category?.name ?? 'Uncategorized', status ? `Status: ${status}` : '', activity.outcome, activity.nextAction, ...fields].filter(Boolean)
}

function sectionTitle(section: CustomReportSection, index: number) {
  return <h3 id={`custom-report-${section.id}`} className="report-section-title"><span className="report-section-number">{String(index + 1).padStart(2, '0')}</span><span className="report-section-separator" aria-hidden="true">—</span><span className="report-section-heading-text">{section.name}</span></h3>
}

export default function CustomReportSections({ sections, mappedSections, config, activities, followUps, plan }: { sections: CustomReportSection[]; mappedSections: MappedReportSection[]; config: Pick<CustomTemplateConfig, 'categories' | 'statuses'>; activities: DailyActivity[]; followUps: FollowUp[]; plan: WeeklyPlan }) {
  const byId = new Map(mappedSections.map((section) => [section.sectionId, section]))
  return <>{[...sections].filter((section) => section.showInReport).sort((left, right) => left.order - right.order).map((section, index) => {
    const mapped = byId.get(section.id)
    const category = section.categoryId ? config.categories.find((item) => item.id === section.categoryId) : undefined
    const categoryActivities = (mapped?.groups[`custom-category:${section.categoryId}`] as DailyActivity[] | undefined) ?? []
    const sectionActivities = (mapped?.groups.dailyActivities as DailyActivity[] | undefined) ?? activities
    const targetProgress = (mapped?.groups['custom-targets'] as CustomTargetProgress[] | undefined) ?? []
    return <section className="report-section motion-fade-up" key={section.id} aria-labelledby={`custom-report-${section.id}`}>
      {sectionTitle(section, index)}
      {section.type === 'weekly-summary' && <p className="report-muted">{activities.length} activit{activities.length === 1 ? 'y was' : 'ies were'} recorded across {new Set(activities.map((activity) => activity.customCategoryId).filter(Boolean)).size} categor{new Set(activities.map((activity) => activity.customCategoryId).filter(Boolean)).size === 1 ? 'y' : 'ies'}. {followUps.filter((followUp) => followUp.status === 'open').length} follow-up{followUps.filter((followUp) => followUp.status === 'open').length === 1 ? '' : 's'} remain open.</p>}
      {(section.type === 'activities' || section.type === 'category') && (sectionActivities.length > 0 || categoryActivities.length > 0) ? <div className="custom-report-activity-list">{(section.type === 'category' ? categoryActivities : sectionActivities).map((activity) => <div className="custom-report-activity-item" key={activity.id}>{activityRows(activity, config).map((value) => <p className="report-muted" key={`${activity.id}-${value}`}>{value}</p>)}</div>)}</div> : null}
      {section.type === 'targets' && (targetProgress.length > 0 ? targetProgress.map((item) => <p className="report-muted" key={item.target.id}><strong>{item.target.name}</strong> · Target: {item.target.targetValue} · Actual: {item.actual === null ? 'No data' : item.actual} · Progress: {item.progress === null ? 'Not applicable' : `${item.progress.toFixed(1)}%`} · {item.status}</p>) : <p className="report-muted">No targets configured.</p>)}
      {(section.type === 'follow-ups' || section.type === 'next-week') && (followUps.length > 0 ? followUps.map((followUp) => <p className="report-muted" key={followUp.id}>{followUp.task} · {followUp.status}{followUp.dueDate ? ` · Due ${followUp.dueDate}` : ''}</p>) : <p className="report-muted">No follow-ups recorded.</p>)}
      {section.type === 'review' && <p className="report-muted">{plan.weeklyStrategicObjectives.length > 0 ? `${plan.weeklyStrategicObjectives.length} weekly planning item${plan.weeklyStrategicObjectives.length === 1 ? '' : 's'} recorded.` : 'No review data recorded.'}</p>}
      {section.type === 'custom' && <p className="report-muted">No directly mapped data is available for this section.</p>}
      {section.type === 'category' && categoryActivities.length === 0 && <p className="report-muted">No activity recorded for {category?.name ?? 'this category'}.</p>}
    </section>
  })}</>
}
