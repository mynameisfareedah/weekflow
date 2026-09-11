import type { TemplateTerminology, WeekFlowTemplate } from './templates.ts'
import { FIELD_SALES_TEMPLATE } from './templates.ts'

export const FIELD_SERVICE_TEMPLATE_TERMINOLOGY: TemplateTerminology = {
  activity: 'Service Activity',
  activityPlural: 'Service Activities',
  activityType: 'Service Type',
  outcome: 'Service Outcome',
  outcomes: 'Service Outcomes',
  notes: 'Service Notes',
  nextAction: 'Next Action',
  person: 'Technician',
  people: 'Customer Contacts',
  contact: 'Customer Contact',
  account: 'Site / Service Location',
  accounts: 'Sites / Service Locations',
  objective: 'Service Objective',
  objectives: 'Service Objectives',
  priority: 'Service Priority',
  priorities: 'Service Priorities',
  successMeasure: 'Service Target',
  successMeasures: 'Service Targets',
  followUp: 'Service Follow-up',
  followUps: 'Service Follow-ups',
  openFollowUps: 'Open Service Follow-ups',
  completedFollowUps: 'Completed Service Follow-ups',
  report: 'Service Report',
  weeklyReport: 'Weekly Service Report',
  dailyBreakdown: 'Daily Service Activity Breakdown',
  summary: 'Weekly Service Summary',
  prioritiesForComingWeek: 'Priorities for Coming Week',
}

export function getTemplateTerminology(template: WeekFlowTemplate = FIELD_SALES_TEMPLATE): TemplateTerminology {
  return { ...template.terminology }
}