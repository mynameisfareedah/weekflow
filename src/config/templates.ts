import type { PlanCategory } from '../types/weeklyPlan.ts'
import { ACTIVITY_TYPES, STRUCTURED_OUTCOME_TYPES, type ActivityType, type StructuredOutcomeType } from '../types/dailyActivity.ts'
import { getTemplateSchemaById, type TemplateSchema } from './templateSchema.ts'
import { FIELD_SERVICE_TEMPLATE_TERMINOLOGY } from './templateTerminology.ts'

export type ActivityFieldKey =
  | 'account'
  | 'hcpNames'
  | 'outcome'
  | 'intelligence'
  | 'nextAction'
  | 'structuredOutcomes'
  | 'product'
  | 'stockStatus'
  | 'workOrderJob'
  | 'equipmentAsset'
  | 'issueProblem'
  | 'resolution'
  | 'serviceStatus'
  | 'partsMaterialsUsed'
  | 'escalation'
  | 'slaPriority'
  | 'downtime'
  | 'customerSignOff'
  | 'progressStatus'
  | 'blockerRisk'
  | 'decision'

export interface ActivityFieldConfiguration {
  key: ActivityFieldKey
  label: string
  enabled: boolean
  required?: boolean
}

export interface StructuredOutcomeConfiguration {
  enabled: boolean
  types: readonly StructuredOutcomeType[]
}

export interface IntelligenceTemplateConfiguration {
  fallbackCategory: 'commercial' | 'patient' | 'access-market' | 'strategic-accounts' | 'scientific-engagement' | 'progress' | 'risks' | 'stakeholders' | 'deliverables'
  structuredOutcomeCategories: Partial<Record<StructuredOutcomeType, 'commercial' | 'patient' | 'access-market' | 'strategic-accounts' | 'scientific-engagement' | 'progress' | 'risks' | 'stakeholders' | 'deliverables'>>
  opportunityScoreWeights: Record<string, number>
  textRules?: readonly { pattern: string; category: 'commercial' | 'patient' | 'access-market' | 'strategic-accounts' | 'scientific-engagement' | 'progress' | 'risks' | 'stakeholders' | 'deliverables' }[]
}

export interface PlanningCategoryConfiguration {
  key: PlanCategory
  label: string
  enabled: boolean
}

export interface ReportSectionConfiguration {
  id: string
  title: string
  enabled: boolean
}

export interface TemplateDefinition {
  id: string
  name: string
  description: string
  availability: 'available' | 'foundation'
  terminology: TemplateTerminology
}

export interface TemplateTerminology {
  activity: string
  activityPlural: string
  activityType: string
  outcome: string
  outcomes: string
  notes: string
  nextAction: string
  person: string
  people: string
  contact: string
  account: string
  accounts: string
  objective: string
  objectives: string
  priority: string
  priorities: string
  successMeasure: string
  successMeasures: string
  followUp: string
  followUps: string
  openFollowUps: string
  completedFollowUps: string
  report: string
  weeklyReport: string
  dailyBreakdown: string
  summary: string
  prioritiesForComingWeek: string
  weeklyPlanIntro?: string
  dailyPlanHelper?: string
}

export interface WeekFlowTemplate {
  id: string
  name: string
  terminology: TemplateTerminology
  planningCategories: PlanningCategoryConfiguration[]
  activityTypes: readonly ActivityType[]
  structuredOutcomes: StructuredOutcomeConfiguration
  intelligence: IntelligenceTemplateConfiguration
  activityFields: ActivityFieldConfiguration[]
  report: {
    title: string
    sections: readonly ReportSectionConfiguration[]
  }
  schema?: TemplateSchema
}

export const FIELD_SERVICE_TEMPLATE: WeekFlowTemplate = {
  id: 'field-service',
  name: 'Field Operations',
  terminology: {
    activity: 'Service Activity',
    activityPlural: 'Service Activities',
    activityType: 'Service Type',
    outcome: 'Outcome',
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
    weeklyPlanIntro: 'Plan your service priorities, sites and service objectives for the selected week.',
    dailyPlanHelper: 'Plan your service priorities, sites and service objectives for each day.',
  },
  planningCategories: [
    { key: 'facilities', label: 'Sites / Service Locations', enabled: true },
    { key: 'accountObjectives', label: 'Work Orders / Jobs', enabled: true },
    { key: 'hcps', label: 'Customer Contact', enabled: true },
    { key: 'primaryObjectives', label: 'Service Objectives', enabled: true },
    { key: 'commercialPriorities', label: 'Priority Issues', enabled: true },
    { key: 'successMeasures', label: 'Service Targets', enabled: true },
    { key: 'virtualEngagements', label: 'Preventive Maintenance', enabled: true },
  ],
  activityTypes: ['Service Visit', 'Installation', 'Preventive Maintenance', 'Repair / Troubleshooting', 'Inspection', 'Remote Support', 'Dispatch / Team Coordination', 'Customer Support', 'Other'],
  structuredOutcomes: {
    enabled: true,
    types: ['Issue Resolved', 'Issue Partially Resolved', 'Issue Unresolved', 'Installation Completed', 'Preventive Maintenance Completed', 'Inspection Completed', 'Customer Sign-off Obtained', 'Parts Required', 'Escalation Required', 'Follow-up Required', 'Equipment Fault Identified'],
  },
  intelligence: {
    fallbackCategory: 'progress',
    structuredOutcomeCategories: {
      'Issue Resolved': 'progress',
      'Issue Partially Resolved': 'risks',
      'Issue Unresolved': 'risks',
      'Installation Completed': 'progress',
      'Preventive Maintenance Completed': 'progress',
      'Inspection Completed': 'progress',
      'Customer Sign-off Obtained': 'stakeholders',
      'Parts Required': 'deliverables',
      'Escalation Required': 'risks',
      'Follow-up Required': 'stakeholders',
      'Equipment Fault Identified': 'risks',
    },
    opportunityScoreWeights: {
      'escalation required': 30,
      'unresolved service issue': 28,
      'downtime': 24,
      'repeat fault': 22,
      'safety concern': 26,
      'preventive maintenance opportunity': 18,
    },
    textRules: [
      { pattern: 'unresolved issue|issue remains unresolved|still unresolved|not resolved', category: 'risks' },
      { pattern: 'repeat fault|repeated fault|same fault|recurring issue|recurring equipment', category: 'risks' },
      { pattern: 'escalation required|escalation|engineering escalation|urgent escalation', category: 'risks' },
      { pattern: 'safety concern|unsafe condition|hazard|risk to safety', category: 'risks' },
      { pattern: 'downtime|outage|equipment down|service interruption', category: 'risks' },
      { pattern: 'preventive maintenance|pm opportunity|maintenance opportunity|routine service', category: 'progress' },
      { pattern: 'parts required|parts needed|replacement required|spare parts', category: 'deliverables' },
      { pattern: 'customer concern|customer complaint|service quality|customer satisfaction', category: 'stakeholders' },
      { pattern: 'sla risk|service level|critical priority|breached sla', category: 'risks' },
    ],
  },
  activityFields: [
    { key: 'account', label: 'Site / Location', enabled: true, required: true },
    { key: 'hcpNames', label: 'Customer / Contact', enabled: true },
    { key: 'outcome', label: 'Outcome', enabled: true },
    { key: 'intelligence', label: 'Service Notes', enabled: true },
    { key: 'nextAction', label: 'Next Action', enabled: true },
    { key: 'structuredOutcomes', label: 'Service Outcomes', enabled: true },
    { key: 'product', label: 'Equipment / Asset', enabled: true },
    { key: 'stockStatus', label: 'Parts / Materials Used', enabled: true },
  ],
  report: {
    title: "This Week's Service Report",
    sections: [
      { id: 'weekly-summary', title: 'Service Summary', enabled: true },
      { id: 'daily-activity-breakdown', title: 'Daily Service Activity', enabled: true },
      { id: 'priorities-coming-week', title: 'Priorities for Coming Week', enabled: true },
      { id: 'completed-follow-ups', title: 'Completed Follow-ups', enabled: true },
    ],
  },
}

export const FIELD_SALES_TEMPLATE: WeekFlowTemplate = {
  id: 'field-sales',
  name: 'Pharma Field Sales',
  terminology: {
    activity: 'Activity',
    activityPlural: 'Activities',
    activityType: 'Activity Type',
    outcome: 'Outcome',
    outcomes: 'Important outcomes',
    notes: 'Key Intelligence',
    nextAction: 'Next Action',
    person: 'HCP / Doctor',
    people: 'HCPs / Doctors',
    account: 'Account / Facility',
    accounts: 'Accounts / Facilities',
    contact: 'HCP / Doctor / Stakeholder',
    objective: 'Objective',
    objectives: 'Objectives',
    priority: 'Commercial Priority',
    priorities: 'Commercial Priorities',
    successMeasure: 'Success Measure',
    successMeasures: 'Success Measures',
    followUp: 'Follow-up',
    followUps: 'Follow-ups',
    openFollowUps: 'Open Follow-ups',
    completedFollowUps: 'Completed Follow-ups',
    report: 'Report',
    weeklyReport: 'Weekly Field Activity Report',
    dailyBreakdown: 'Daily Activity Breakdown',
    summary: 'Activities Summary',
    prioritiesForComingWeek: 'Priorities for the Coming Week',
    weeklyPlanIntro: 'Plan your commercial priorities, accounts and objectives for the selected week.',
    dailyPlanHelper: 'Plan your commercial priorities, accounts and objectives for each day.',
  },
  planningCategories: [
    { key: 'facilities', label: 'Facilities / Accounts', enabled: true },
    { key: 'hcps', label: 'HCPs / Stakeholders', enabled: true },
    { key: 'primaryObjectives', label: 'Primary Objectives', enabled: true },
    { key: 'virtualEngagements', label: 'Virtual Engagements', enabled: true },
    { key: 'accountObjectives', label: 'Account-Specific Objectives', enabled: true },
    { key: 'commercialPriorities', label: 'Commercial Priorities', enabled: true },
    { key: 'successMeasures', label: 'Success Measures', enabled: true },
  ],
  activityTypes: ACTIVITY_TYPES.slice(0, 5),
  structuredOutcomes: {
    enabled: true,
    types: STRUCTURED_OUTCOME_TYPES.slice(0, 10),
  },
  intelligence: {
    fallbackCategory: 'strategic-accounts',
    structuredOutcomeCategories: {
      'Prescription Generated': 'commercial',
      'Patient Identified': 'patient',
      'Patient Access / Access Barrier': 'access-market',
      'Stock Issue': 'access-market',
      'Scientific Engagement': 'scientific-engagement',
      'MDT Opportunity': 'strategic-accounts',
      'Referral Opportunity': 'strategic-accounts',
      'CME / Meeting Opportunity': 'scientific-engagement',
      'Follow-up Required': 'scientific-engagement',
      Other: 'scientific-engagement',
    },
    opportunityScoreWeights: {
      'prescription identified': 30,
      'unresolved patient access issue': 20,
      'stock issue': 20,
      'follow-up required': 15,
      'strategic account signal': 15,
      'MDT opportunity': 15,
      'patient population identified': 10,
      'scientific engagement opportunity': 10,
    },
  },
  activityFields: [
    { key: 'account', label: 'Account / Facility', enabled: true, required: true },
    { key: 'hcpNames', label: 'Doctors / HCPs Engaged', enabled: true },
    { key: 'outcome', label: 'Outcome', enabled: true },
    { key: 'intelligence', label: 'Key Intelligence', enabled: true },
    { key: 'nextAction', label: 'Next Action', enabled: true },
    { key: 'structuredOutcomes', label: 'Important outcomes', enabled: true },
    { key: 'product', label: 'Select product', enabled: true },
    { key: 'stockStatus', label: 'Stock status', enabled: true },
  ],
  report: {
    title: "This Week's Field Activity Report",
    sections: [
      { id: 'activities-summary', title: 'Activities Summary', enabled: true },
      { id: 'daily-activity-breakdown', title: 'Daily Activity Breakdown', enabled: true },
      { id: 'virtual-engagements', title: 'Virtual Engagements', enabled: true },
      { id: 'commercial-patient-journey-outcomes', title: 'Key Commercial / Patient-Journey Outcomes', enabled: true },
      { id: 'strategic-account-intelligence', title: 'Strategic Account Intelligence', enabled: true },
      { id: 'priorities-coming-week', title: 'Priorities for Coming Week', enabled: true },
      { id: 'completed-follow-ups', title: 'Completed Follow-ups', enabled: true },
    ],
  },
}

export const PROJECT_MANAGEMENT_TEMPLATE: WeekFlowTemplate = {
  id: 'project-management',
  name: 'Project Management',
  terminology: {
    activity: 'Activity',
    activityPlural: 'Activities',
    activityType: 'Activity Type',
    outcome: 'Outcome',
    outcomes: 'Important Outcomes',
    notes: 'Key Intelligence / Notes',
    nextAction: 'Next Action',
    person: 'Stakeholder',
    people: 'Stakeholders',
    account: 'Project / Workstream',
    accounts: 'Projects / Workstreams',
    contact: 'Stakeholders Involved',
    objective: 'Project Objective',
    objectives: 'Weekly Objectives',
    priority: 'Priority',
    priorities: 'Priorities',
    successMeasure: 'Success Measure',
    successMeasures: 'Success Measures',
    followUp: 'Next Action',
    followUps: 'Follow-ups',
    openFollowUps: 'Open Follow-ups',
    completedFollowUps: 'Completed Follow-ups',
    report: 'Report',
    weeklyReport: 'Weekly Project Management Report',
    dailyBreakdown: 'Daily Activity Breakdown',
    summary: 'Weekly Summary',
    prioritiesForComingWeek: 'Priorities for Coming Week',
    weeklyPlanIntro: 'Plan your week and keep priorities moving.',
    dailyPlanHelper: 'Break your weekly priorities and workstreams into daily work.',
  },
  planningCategories: [
    { key: 'primaryObjectives', label: 'Weekly Objectives', enabled: true },
    { key: 'facilities', label: 'Projects / Workstreams', enabled: true },
    { key: 'accountObjectives', label: 'Deliverables', enabled: true },
    { key: 'virtualEngagements', label: 'Key Activities', enabled: true },
    { key: 'hcps', label: 'Stakeholders', enabled: true },
    { key: 'commercialPriorities', label: 'Priorities', enabled: true },
    { key: 'successMeasures', label: 'Success Measures', enabled: true },
  ],
  activityTypes: ['Project Work', 'Team Meeting', 'Client / Stakeholder Meeting', 'Review / Approval', 'Planning', 'Problem Solving', 'Other'],
  structuredOutcomes: {
    enabled: true,
    types: ['Progress Made', 'Blocker Identified', 'Risk Identified', 'Decision Made', 'Deliverable Completed', 'Stakeholder Alignment', 'Approval Received', 'Follow-up Required'],
  },
  intelligence: {
    fallbackCategory: 'progress',
    structuredOutcomeCategories: {
      'Progress Made': 'progress',
      'Blocker Identified': 'risks',
      'Risk Identified': 'risks',
      'Decision Made': 'progress',
      'Deliverable Completed': 'deliverables',
      'Stakeholder Alignment': 'stakeholders',
      'Approval Received': 'deliverables',
      'Follow-up Required': 'stakeholders',
    },
    opportunityScoreWeights: {},
    textRules: [
      { pattern: 'blocker|blocked|blocked by|issue', category: 'risks' },
      { pattern: 'risk|dependency|delayed|delay', category: 'risks' },
      { pattern: 'decision|decided|approval', category: 'progress' },
      { pattern: 'deliverable|completed|complete|milestone', category: 'deliverables' },
      { pattern: 'stakeholder|client|alignment|meeting', category: 'stakeholders' },
      { pattern: 'progress|advanced|started|working', category: 'progress' },
    ],
  },
  activityFields: [
    { key: 'account', label: 'Project / Workstream', enabled: true, required: true },
    { key: 'hcpNames', label: 'Stakeholders Involved', enabled: true },
    { key: 'outcome', label: 'Outcome', enabled: true },
    { key: 'intelligence', label: 'Key Intelligence / Notes', enabled: true },
    { key: 'nextAction', label: 'Next Action', enabled: true },
    { key: 'structuredOutcomes', label: 'Important Outcomes', enabled: true },
    { key: 'product', label: 'Select product', enabled: false },
    { key: 'stockStatus', label: 'Stock status', enabled: false },
  ],
  report: {
    title: 'Weekly Project Management Report',
    sections: [
      { id: 'weekly-summary', title: 'Weekly Summary', enabled: true },
      { id: 'daily-activity-breakdown', title: 'Daily Activity Breakdown', enabled: true },
      { id: 'project-workstream-progress', title: 'Project / Workstream Progress', enabled: true },
      { id: 'key-deliverables', title: 'Key Deliverables', enabled: true },
      { id: 'risks-blockers-decisions', title: 'Risks, Blockers & Decisions', enabled: true },
      { id: 'stakeholder-client-updates', title: 'Stakeholder / Client Updates', enabled: true },
      { id: 'priorities-coming-week', title: 'Priorities for Coming Week', enabled: true },
      { id: 'completed-follow-ups', title: 'Completed Follow-ups', enabled: true },
    ],
  },
}

const FOUNDATION_TERMINOLOGY: Record<string, TemplateTerminology> = {
  'field-service': FIELD_SERVICE_TEMPLATE_TERMINOLOGY,
  'small-business': { ...PROJECT_MANAGEMENT_TEMPLATE.terminology, activity: 'Business Task', activityPlural: 'Business Tasks', activityType: 'Business Activity', person: 'Customer / Client', people: 'Customers / Clients', contact: 'Customer / Client', account: 'Customer / Business Area', accounts: 'Customers / Business Areas', objective: 'Business Objective', objectives: 'Weekly Business Objectives', outcome: 'Business Outcome', outcomes: 'Business Outcomes', notes: 'Business Notes', priority: 'Business Priority', priorities: 'Business Priorities', successMeasure: 'Success Measure', successMeasures: 'Success Measures', followUp: 'Follow-up', weeklyReport: 'Weekly Business Review', summary: 'Business Summary', weeklyPlanIntro: 'Plan your business priorities, customers and objectives for the selected week.', dailyPlanHelper: 'Plan your business priorities, customers and objectives for each day.' },
  'ngo-community': { ...PROJECT_MANAGEMENT_TEMPLATE.terminology, activity: 'Community Activity', activityPlural: 'Community Activities', person: 'Beneficiary', people: 'Beneficiaries', contact: 'Partner / Volunteer', account: 'Community / Programme', accounts: 'Communities / Programmes', objective: 'Programme Objective', objectives: 'Programme Objectives', outcome: 'Impact', outcomes: 'Interventions / Impact', notes: 'Programme Notes', priority: 'Programme Priority', priorities: 'Programme Priorities', weeklyReport: 'Weekly Programme Report', summary: 'Programme Summary', weeklyPlanIntro: 'Plan your programme priorities, communities and objectives for the selected week.', dailyPlanHelper: 'Plan your programme priorities, communities and objectives for each day.' },
  education: { ...PROJECT_MANAGEMENT_TEMPLATE.terminology, activity: 'Learning Activity', activityPlural: 'Learning Activities', person: 'Student', people: 'Students', contact: 'Parent / Guardian', account: 'Class / Subject', accounts: 'Classes / Subjects', objective: 'Learning Objective', objectives: 'Learning Objectives', outcome: 'Learning Outcome', outcomes: 'Learning Outcomes', notes: 'Teaching Notes', priority: 'Learning Priority', priorities: 'Learning Priorities', weeklyReport: 'Weekly Education Review', summary: 'Learning Summary', weeklyPlanIntro: 'Plan your learning priorities, classes and objectives for the selected week.', dailyPlanHelper: 'Plan your learning priorities, classes and objectives for each day.' },
  personal: { ...PROJECT_MANAGEMENT_TEMPLATE.terminology, activity: 'Task', activityPlural: 'Tasks', person: 'Person', people: 'People', contact: 'Person', account: 'Area / Commitment', accounts: 'Areas / Commitments', objective: 'Goal', objectives: 'Goals', outcome: 'Outcome', outcomes: 'Notes / Outcomes', notes: 'Note', priority: 'Priority', priorities: 'Priorities', successMeasure: 'Goal Measure', successMeasures: 'Goal Measures', followUp: 'Next Step', followUps: 'Next Steps', weeklyReport: 'Weekly Review', summary: 'Weekly Summary', weeklyPlanIntro: 'Plan your priorities, commitments and goals for the selected week.', dailyPlanHelper: 'Plan your priorities, commitments and goals for each day.' },
  custom: { ...PROJECT_MANAGEMENT_TEMPLATE.terminology, activity: 'Activity', activityPlural: 'Activities', person: 'Person', people: 'People', contact: 'Person / Contact', account: 'Work Area', accounts: 'Work Areas', objective: 'Objective', objectives: 'Objectives', outcome: 'Outcome', outcomes: 'Outcomes', notes: 'Notes', priority: 'Priority', priorities: 'Priorities', weeklyReport: 'Weekly Review', summary: 'Weekly Summary', weeklyPlanIntro: 'Plan your priorities, work areas and objectives for the selected week.', dailyPlanHelper: 'Plan your priorities, work areas and objectives for each day.' },
}

export const TEMPLATE_DEFINITIONS: readonly TemplateDefinition[] = [
  { id: FIELD_SALES_TEMPLATE.id, name: 'Pharma Field Sales', description: 'Plan, track, and report pharmaceutical field activities, HCP engagements, accounts, opportunities, and follow-ups.', availability: 'available', terminology: FIELD_SALES_TEMPLATE.terminology },
  { id: 'field-service', name: 'Field Operations', description: 'Plan, track, and report field operations, jobs, service issues, equipment, resolutions, and customer follow-ups.', availability: 'available', terminology: FOUNDATION_TERMINOLOGY['field-service'] },
  { id: PROJECT_MANAGEMENT_TEMPLATE.id, name: 'Project Management', description: 'Plan weekly project work, track deliverables, risks, decisions, stakeholders, and priorities.', availability: 'available', terminology: PROJECT_MANAGEMENT_TEMPLATE.terminology },
  { id: 'small-business', name: 'Small Business', description: 'Manage weekly business activities, customers, sales, orders, suppliers, and follow-ups.', availability: 'foundation', terminology: FOUNDATION_TERMINOLOGY['small-business'] },
  { id: 'ngo-community', name: 'NGO & Community Work', description: 'Plan and report community activities, beneficiaries, outreach, partnerships, and follow-ups.', availability: 'foundation', terminology: FOUNDATION_TERMINOLOGY['ngo-community'] },
  { id: 'education', name: 'Education', description: 'Plan teaching, learning, student activities, academic tasks, and follow-ups.', availability: 'foundation', terminology: FOUNDATION_TERMINOLOGY.education },
  { id: 'personal', name: 'Personal Productivity', description: 'Organize weekly goals, tasks, activities, priorities, and personal follow-ups.', availability: 'foundation', terminology: FOUNDATION_TERMINOLOGY.personal },
  { id: 'custom', name: 'Custom', description: 'Create a weekly workflow tailored to your own work or activity.', availability: 'foundation', terminology: FOUNDATION_TERMINOLOGY.custom },
]

export function getAvailableTemplates() {
  return TEMPLATE_DEFINITIONS
}

export function getTemplateById(id: string | null | undefined) {
  return TEMPLATE_DEFINITIONS.find((template) => template.id === id)
}

export function getWorkflowTemplateById(id: string | null | undefined): WeekFlowTemplate {
  const templateId = getTemplateById(id)?.id ?? FIELD_SALES_TEMPLATE.id
  const schema = getTemplateSchemaById(templateId) ?? FIELD_SALES_TEMPLATE.schema
  const definition = TEMPLATE_DEFINITIONS.find((template) => template.id === templateId) ?? TEMPLATE_DEFINITIONS[0]
  const legacyTemplate = templateId === PROJECT_MANAGEMENT_TEMPLATE.id ? PROJECT_MANAGEMENT_TEMPLATE : FIELD_SALES_TEMPLATE

  if (!schema) return legacyTemplate

  return {
    id: templateId,
    name: definition.name,
    terminology: definition.terminology,
    planningCategories: schema.planning.categories.map((category) => ({ key: category.key as PlanCategory, label: category.label, enabled: category.enabled })),
    activityTypes: schema.activities.types as ActivityType[],
    structuredOutcomes: {
      enabled: Object.keys(schema.intelligence.outcomeCategories).length > 0,
      types: Object.keys(schema.intelligence.outcomeCategories) as StructuredOutcomeType[],
    },
    intelligence: {
      fallbackCategory: schema.intelligence.fallbackCategory as IntelligenceTemplateConfiguration['fallbackCategory'],
      structuredOutcomeCategories: schema.intelligence.outcomeCategories as Partial<Record<StructuredOutcomeType, IntelligenceTemplateConfiguration['fallbackCategory']>>,
      opportunityScoreWeights: { ...schema.intelligence.scoreWeights },
      textRules: schema.intelligence.textRules as WeekFlowTemplate['intelligence']['textRules'],
    },
    activityFields: schema.activities.fields.map((field) => ({
      key: field.key as ActivityFieldKey,
      label: field.label,
      enabled: field.state !== 'hidden',
      required: field.state === 'required',
    })),
    report: {
      title: templateId === FIELD_SALES_TEMPLATE.id || templateId === PROJECT_MANAGEMENT_TEMPLATE.id
        ? legacyTemplate.report.title
        : definition.terminology.weeklyReport,
      sections: schema.report.sections.map((section) => ({ id: section.id, title: section.title, enabled: section.enabled })),
    },
    schema,
  }
}