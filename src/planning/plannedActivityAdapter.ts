import type { ActivityType } from '../types/dailyActivity'
import { FIELD_SALES_TEMPLATE, type WeekFlowTemplate } from '../config/templates'
import { getActivityTypeOptions } from '../activity/activityTypeAdapter'
import type { DayPlan, WeeklyPlan } from '../types/weeklyPlan'

export interface PlannedActivity {
  id: string
  label: string
  account: string
  focus: string
  activityType: ActivityType
  programmeArea?: string
  location?: string
  jobId?: string
  customer?: string
  technician?: string
  priority?: string
  educationCourseProgramme?: string
  educationClassGroup?: string
  educationTopic?: string
  educationInstructor?: string
  educationLearningObjectiveId?: string
  educationTeachingActivity?: string
  educationStudentActivity?: string
}

export function getExecutablePlannedActivities(day: DayPlan, template: WeekFlowTemplate = FIELD_SALES_TEMPLATE, weeklyPlan?: WeeklyPlan): PlannedActivity[] {
  const activityTypes = getActivityTypeOptions(template).map((option) => option.value as ActivityType)
  if (template.id === 'ngo-community') {
    return (weeklyPlan?.programmeActivities ?? [])
      .filter((item) => !item.plannedDate || item.plannedDate.toLowerCase() === day.label.toLowerCase() || item.plannedDate === day.date)
      .map((item) => ({
        id: `programme:${item.id}`,
        label: item.activity,
        account: item.activity,
        focus: [item.programmeArea, item.location, item.owner, item.target ? `Target: ${item.target}` : '', item.status].filter(Boolean).join(' | '),
        activityType: 'Programme Activity' as ActivityType,
        programmeArea: item.programmeArea,
        location: item.location,
      }))
  }
  if (template.id === 'field-service') {
    return (weeklyPlan?.fieldJobs ?? [])
      .filter((item) => !item.scheduledDay || item.scheduledDay.toLowerCase() === day.label.toLowerCase() || item.scheduledDate === day.date)
      .map((item) => ({
        id: `field-job:${item.id}`,
        label: `${item.jobId || 'Planned job'}${item.customer ? ` - ${item.customer}` : ''}`,
        account: item.location || item.customer,
        focus: [item.jobType, item.assignedTechnician, item.status, item.issue].filter(Boolean).join(' | '),
        activityType: activityTypes.includes(item.jobType as ActivityType) ? item.jobType as ActivityType : (activityTypes[0] ?? 'Other'),
        location: item.location,
        jobId: item.jobId,
        customer: item.customer,
        technician: item.assignedTechnician,
        priority: item.priority,
      }))
  }
  if (template.id === 'project-management') {
    const projectWork = day.categories.facilities.map((item) => ({ id: `project:${item.id}`, label: item.text, account: item.text, focus: [...day.categories.primaryObjectives, ...day.categories.commercialPriorities].map((focus) => focus.text).join(' | '), activityType: 'Project Work' as ActivityType }))
    const deliverables = day.categories.accountObjectives.map((item) => ({ id: `deliverable:${item.id}`, label: item.text, account: item.text, focus: item.text, activityType: 'Review / Approval' as ActivityType }))
    const keyActivities = day.categories.virtualEngagements.map((item) => ({ id: `activity:${item.id}`, label: item.text, account: item.text, focus: item.text, activityType: 'Planning' as ActivityType }))
    const stakeholders = day.categories.hcps.map((item) => ({ id: `stakeholder:${item.id}`, label: item.text, account: item.text, focus: item.text, activityType: 'Client / Stakeholder Meeting' as ActivityType }))
    const priorities = day.categories.commercialPriorities.map((item) => ({ id: `priority:${item.id}`, label: item.text, account: item.text, focus: item.text, activityType: 'Problem Solving' as ActivityType }))
    return [...projectWork, ...deliverables, ...keyActivities, ...stakeholders, ...priorities]
  }
  if (template.id === 'education') {
    const objectives = weeklyPlan?.educationLearningObjectives ?? []
    return (weeklyPlan?.educationTeachingPlan ?? [])
      .filter((item) => item.day === day.id)
      .map((item) => ({
        id: `education-teaching:${item.id}`,
        label: item.topic || 'Planned learning activity',
        account: weeklyPlan?.educationContext?.classGroup || weeklyPlan?.educationContext?.courseProgramme || 'Education activity',
        focus: [item.teachingActivity, item.learningActivity, item.duration].filter(Boolean).join(' | '),
        activityType: 'Lesson' as ActivityType,
        educationCourseProgramme: weeklyPlan?.educationContext?.courseProgramme,
        educationClassGroup: weeklyPlan?.educationContext?.classGroup,
        educationTopic: item.topic,
        educationInstructor: weeklyPlan?.educationContext?.instructor,
        educationTeachingActivity: item.teachingActivity,
        educationStudentActivity: item.learningActivity,
        educationLearningObjectiveId: objectives[0]?.id,
      }))
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
