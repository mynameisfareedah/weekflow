import type { ActivityType } from '../types/dailyActivity'
import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from '../config/templates'
import { getActivityTypeOptions } from '../activity/activityTypeAdapter'
import type { DayPlan } from '../types/weeklyPlan'

export interface PlannedActivity {
  id: string
  label: string
  account: string
  focus: string
  activityType: ActivityType
}

export function getExecutablePlannedActivities(day: DayPlan, template: WeekFlowTemplate = FIELD_SALES_TEMPLATE): PlannedActivity[] {
  const activityTypes = getActivityTypeOptions(template).map((option) => option.value as ActivityType)
  if (template.id === 'project-management') {
    const projectWork = day.categories.facilities.map((item) => ({ id: `project:${item.id}`, label: item.text, account: item.text, focus: [...day.categories.primaryObjectives, ...day.categories.commercialPriorities].map((focus) => focus.text).join(' | '), activityType: 'Project Work' as ActivityType }))
    const deliverables = day.categories.accountObjectives.map((item) => ({ id: `deliverable:${item.id}`, label: item.text, account: item.text, focus: item.text, activityType: 'Review / Approval' as ActivityType }))
    const keyActivities = day.categories.virtualEngagements.map((item) => ({ id: `activity:${item.id}`, label: item.text, account: item.text, focus: item.text, activityType: 'Planning' as ActivityType }))
    const stakeholders = day.categories.hcps.map((item) => ({ id: `stakeholder:${item.id}`, label: item.text, account: item.text, focus: item.text, activityType: 'Client / Stakeholder Meeting' as ActivityType }))
    const priorities = day.categories.commercialPriorities.map((item) => ({ id: `priority:${item.id}`, label: item.text, account: item.text, focus: item.text, activityType: 'Problem Solving' as ActivityType }))
    return [...projectWork, ...deliverables, ...keyActivities, ...stakeholders, ...priorities]
  }
  const facilities = day.categories.facilities.map((item) => ({
    id: `facility:${item.id}`,
    label: item.text,
    account: item.text,
    focus: [...day.categories.primaryObjectives, ...day.categories.accountObjectives, ...day.categories.commercialPriorities].map((focus) => focus.text).join(' | '),
    activityType: activityTypes[0] ?? 'Other',
  }))
  const virtualEngagements = day.categories.virtualEngagements.map((item) => ({
    id: `virtual:${item.id}`,
    label: item.text,
    account: item.text,
    focus: day.categories.primaryObjectives.map((focus) => focus.text).join(' | '),
    activityType: activityTypes[1] ?? activityTypes[0] ?? 'Other',
  }))

  return [...facilities, ...virtualEngagements]
}
