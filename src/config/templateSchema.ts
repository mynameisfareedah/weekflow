export type TemplateFieldState = 'required' | 'optional' | 'conditional' | 'hidden'

export interface PlanningCategorySchema {
  key: string
  label: string
  enabled: boolean
  required?: boolean
  order: number
}

export interface ActivityFieldSchema {
  key: string
  label: string
  state: TemplateFieldState
  order: number
  applicableActivityTypes?: readonly string[]
}

export interface FollowUpFieldSchema {
  key: string
  label: string
  state: TemplateFieldState
  order: number
}

export interface ReportSectionSchema {
  id: string
  title: string
  enabled: boolean
  order: number
  dataGroups: readonly string[]
  presentation?: ReportSectionPresentation
}

export type ReportSectionDisplayType = 'summary' | 'activity-table' | 'activity-list' | 'outcomes' | 'intelligence' | 'follow-ups' | 'unsupported'

export interface ReportSectionPresentation {
  displayType: ReportSectionDisplayType
  emptyState: string
  showWhenEmpty: boolean
  preferredLayout?: 'stack' | 'table' | 'cards' | 'columns'
  presentationVariant?: string
}

export interface TemplateSchema {
  templateId: string
  planning: {
    categories: readonly PlanningCategorySchema[]
  }
  activities: {
    types: readonly string[]
    fields: readonly ActivityFieldSchema[]
  }
  followUps: {
    fields: readonly FollowUpFieldSchema[]
  }
  intelligence: {
    outcomeCategories: Record<string, string>
    fallbackCategory: string
    scoreWeights: Record<string, number>
    textRules?: readonly { pattern: string; category: string }[]
  }
  report: {
    sections: readonly ReportSectionSchema[]
  }
}

const REPORT_PRESENTATION_BY_TEMPLATE: Record<string, Record<string, ReportSectionPresentation>> = {
  'field-sales': {
    'activities-summary': { displayType: 'summary', emptyState: 'No activities recorded for this reporting week.', showWhenEmpty: true, preferredLayout: 'cards', presentationVariant: 'field-sales-summary' },
    'daily-activity-breakdown': { displayType: 'activity-table', emptyState: 'No activities recorded for this reporting week.', showWhenEmpty: true, preferredLayout: 'table', presentationVariant: 'field-sales-activity-table' },
    'virtual-engagements': { displayType: 'activity-list', emptyState: 'No virtual engagements recorded.', showWhenEmpty: true, preferredLayout: 'cards', presentationVariant: 'field-sales-virtual-engagements' },
    'commercial-patient-journey-outcomes': { displayType: 'outcomes', emptyState: 'No commercial or patient-journey outcomes recorded.', showWhenEmpty: true, preferredLayout: 'cards', presentationVariant: 'field-sales-outcomes' },
    'strategic-account-intelligence': { displayType: 'unsupported', emptyState: 'This section requires strategic-account data that is not currently available in the shared report data.', showWhenEmpty: true, preferredLayout: 'stack', presentationVariant: 'field-sales-intelligence' },
    'priorities-coming-week': { displayType: 'follow-ups', emptyState: 'No open priorities or follow-ups recorded.', showWhenEmpty: true, preferredLayout: 'columns', presentationVariant: 'field-sales-follow-ups' },
    'completed-follow-ups': { displayType: 'follow-ups', emptyState: 'No completed follow-ups recorded.', showWhenEmpty: true, preferredLayout: 'stack', presentationVariant: 'field-sales-completed-follow-ups' },
  },
  'project-management': {
    'weekly-summary': { displayType: 'summary', emptyState: 'No project activity recorded for this reporting week.', showWhenEmpty: true, preferredLayout: 'cards', presentationVariant: 'project-summary' },
    'daily-activity-breakdown': { displayType: 'activity-table', emptyState: 'No project activities recorded for this reporting week.', showWhenEmpty: true, preferredLayout: 'table', presentationVariant: 'project-activity-table' },
    'project-workstream-progress': { displayType: 'unsupported', emptyState: 'This section requires project-progress data that is not currently available in the shared report data.', showWhenEmpty: true, preferredLayout: 'stack', presentationVariant: 'project-progress' },
    'key-deliverables': { displayType: 'unsupported', emptyState: 'This section requires deliverables data that is not currently available in the shared report data.', showWhenEmpty: true, preferredLayout: 'stack', presentationVariant: 'project-deliverables' },
    'risks-blockers-decisions': { displayType: 'unsupported', emptyState: 'This section requires risk, blocker, and decision data that is not currently available in the shared report data.', showWhenEmpty: true, preferredLayout: 'stack', presentationVariant: 'project-risks' },
    'stakeholder-client-updates': { displayType: 'unsupported', emptyState: 'This section requires stakeholder-update data that is not currently available in the shared report data.', showWhenEmpty: true, preferredLayout: 'stack', presentationVariant: 'project-stakeholders' },
    'priorities-coming-week': { displayType: 'follow-ups', emptyState: 'No open priorities or follow-ups recorded.', showWhenEmpty: true, preferredLayout: 'columns', presentationVariant: 'project-follow-ups' },
    'completed-follow-ups': { displayType: 'follow-ups', emptyState: 'No completed follow-ups recorded.', showWhenEmpty: true, preferredLayout: 'stack', presentationVariant: 'project-completed-follow-ups' },
  },
  'small-business': {
    'business-summary': { displayType: 'summary', emptyState: 'No business activity recorded for this reporting week.', showWhenEmpty: true, preferredLayout: 'cards', presentationVariant: 'small-business-summary' },
    'daily-business-activity': { displayType: 'activity-table', emptyState: 'No daily business activity recorded.', showWhenEmpty: true, preferredLayout: 'table', presentationVariant: 'small-business-activity-table' },
    'sales-opportunity-progress': { displayType: 'activity-list', emptyState: 'No sales or opportunity progress recorded.', showWhenEmpty: true, preferredLayout: 'cards', presentationVariant: 'small-business-sales' },
    'customer-client-outcomes': { displayType: 'outcomes', emptyState: 'No customer or client outcomes recorded.', showWhenEmpty: true, preferredLayout: 'cards', presentationVariant: 'small-business-customer-outcomes' },
    'orders-payments': { displayType: 'outcomes', emptyState: 'No order or payment outcomes recorded.', showWhenEmpty: true, preferredLayout: 'cards', presentationVariant: 'small-business-orders-payments' },
    'supplier-operational-intelligence': { displayType: 'intelligence', emptyState: 'No supplier or operational intelligence recorded.', showWhenEmpty: true, preferredLayout: 'stack', presentationVariant: 'small-business-supplier-operations' },
    'priorities-coming-week': { displayType: 'follow-ups', emptyState: 'No priorities or open follow-ups recorded.', showWhenEmpty: true, preferredLayout: 'columns', presentationVariant: 'small-business-priorities' },
    'completed-follow-ups': { displayType: 'follow-ups', emptyState: 'No completed follow-ups recorded.', showWhenEmpty: true, preferredLayout: 'stack', presentationVariant: 'small-business-completed-follow-ups' },
  },
}

function foundationPresentation(templateId: string, sectionId: string): ReportSectionPresentation {
  const variant = `${templateId}-${sectionId}`
  if (sectionId === 'weekly-summary') return { displayType: 'summary', emptyState: 'No work recorded for this reporting week.', showWhenEmpty: true, preferredLayout: 'cards', presentationVariant: variant }
  if (sectionId === 'daily-activity-breakdown') return { displayType: 'activity-table', emptyState: 'No activities recorded for this reporting week.', showWhenEmpty: true, preferredLayout: 'table', presentationVariant: variant }
  if (sectionId === 'priorities-coming-week') return { displayType: 'follow-ups', emptyState: 'No open priorities or follow-ups recorded.', showWhenEmpty: true, preferredLayout: 'columns', presentationVariant: variant }
  return { displayType: 'unsupported', emptyState: 'This section is not currently available from the shared report data.', showWhenEmpty: true, preferredLayout: 'stack', presentationVariant: variant }
}

export function getReportSectionPresentation(templateId: string, sectionId: string): ReportSectionPresentation {
  return REPORT_PRESENTATION_BY_TEMPLATE[templateId]?.[sectionId] ?? foundationPresentation(templateId, sectionId)
}

export const FIELD_SALES_TEMPLATE_SCHEMA: TemplateSchema = {
  templateId: 'field-sales',
  planning: {
    categories: [
      { key: 'facilities', label: 'Facilities / Accounts', enabled: true, required: false, order: 1 },
      { key: 'hcps', label: 'HCPs / Stakeholders', enabled: true, required: false, order: 2 },
      { key: 'primaryObjectives', label: 'Primary Objectives', enabled: true, required: false, order: 3 },
      { key: 'virtualEngagements', label: 'Virtual Engagements', enabled: true, required: false, order: 4 },
      { key: 'accountObjectives', label: 'Account-Specific Objectives', enabled: true, required: false, order: 5 },
      { key: 'commercialPriorities', label: 'Commercial Priorities', enabled: true, required: false, order: 6 },
      { key: 'successMeasures', label: 'Success Measures', enabled: true, required: false, order: 7 },
    ],
  },
  activities: {
    types: ['Physical Visit', 'Virtual Engagement', 'Pharmacy Call', 'Phone Call', 'Other'],
    fields: [
      { key: 'account', label: 'Account / Facility', state: 'required', order: 1, applicableActivityTypes: ['Physical Visit', 'Virtual Engagement', 'Pharmacy Call', 'Phone Call', 'Other'] },
      { key: 'hcpNames', label: 'Doctors / HCPs Engaged', state: 'optional', order: 2 },
      { key: 'outcome', label: 'Outcome', state: 'optional', order: 3 },
      { key: 'intelligence', label: 'Key Intelligence', state: 'optional', order: 4 },
      { key: 'nextAction', label: 'Next Action', state: 'optional', order: 5 },
      { key: 'structuredOutcomes', label: 'Important Outcomes', state: 'optional', order: 6 },
      { key: 'product', label: 'Select product', state: 'conditional', order: 7 },
      { key: 'stockStatus', label: 'Stock status', state: 'conditional', order: 8 },
    ],
  },
  followUps: {
    fields: [
      { key: 'task', label: 'Follow-up / Next Action', state: 'required', order: 1 },
      { key: 'facility', label: 'Facility / Account', state: 'optional', order: 2 },
      { key: 'hcpName', label: 'HCP', state: 'optional', order: 3 },
      { key: 'dueDate', label: 'Due Date', state: 'optional', order: 4 },
      { key: 'priority', label: 'Priority', state: 'required', order: 5 },
      { key: 'notes', label: 'Notes', state: 'optional', order: 6 },
      { key: 'sourceActivityId', label: 'Source Activity', state: 'optional', order: 7 },
      { key: 'status', label: 'Status', state: 'optional', order: 8 },
    ],
  },
  intelligence: {
    fallbackCategory: 'strategic-accounts',
    outcomeCategories: {
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
    scoreWeights: {
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
  report: {
    sections: [
      { id: 'activities-summary', title: 'Activities Summary', enabled: true, order: 1, dataGroups: ['dailyActivities', 'outcomes'] },
      { id: 'daily-activity-breakdown', title: 'Daily Activity Breakdown', enabled: true, order: 2, dataGroups: ['dailyActivities', 'intelligence'] },
      { id: 'virtual-engagements', title: 'Virtual Engagements', enabled: true, order: 3, dataGroups: ['virtualEngagements'] },
      { id: 'commercial-patient-journey-outcomes', title: 'Key Commercial / Patient-Journey Outcomes', enabled: true, order: 4, dataGroups: ['commercialOutcomes', 'patientJourney'] },
      { id: 'strategic-account-intelligence', title: 'Strategic Account Intelligence', enabled: true, order: 5, dataGroups: ['strategicAccounts', 'intelligence'] },
      { id: 'priorities-coming-week', title: 'Priorities for Coming Week', enabled: true, order: 6, dataGroups: ['priorities', 'followUps'] },
      { id: 'completed-follow-ups', title: 'Completed Follow-ups', enabled: true, order: 7, dataGroups: ['followUps'] },
    ],
  },
}

export const PROJECT_MANAGEMENT_TEMPLATE_SCHEMA: TemplateSchema = {
  templateId: 'project-management',
  planning: {
    categories: [
      { key: 'primaryObjectives', label: 'Weekly Objectives', enabled: true, required: false, order: 1 },
      { key: 'facilities', label: 'Projects / Workstreams', enabled: true, required: false, order: 2 },
      { key: 'accountObjectives', label: 'Deliverables', enabled: true, required: false, order: 3 },
      { key: 'virtualEngagements', label: 'Key Activities', enabled: true, required: false, order: 4 },
      { key: 'hcps', label: 'Stakeholders', enabled: true, required: false, order: 5 },
      { key: 'commercialPriorities', label: 'Priorities', enabled: true, required: false, order: 6 },
      { key: 'successMeasures', label: 'Success Measures', enabled: true, required: false, order: 7 },
    ],
  },
  activities: {
    types: ['Project Work', 'Team Meeting', 'Client / Stakeholder Meeting', 'Review / Approval', 'Planning', 'Problem Solving', 'Other'],
    fields: [
      { key: 'account', label: 'Project / Workstream', state: 'required', order: 1 },
      { key: 'hcpNames', label: 'Stakeholders Involved', state: 'optional', order: 2 },
      { key: 'outcome', label: 'Outcome', state: 'optional', order: 3 },
      { key: 'intelligence', label: 'Key Intelligence / Notes', state: 'optional', order: 4 },
      { key: 'nextAction', label: 'Next Action', state: 'optional', order: 5 },
      { key: 'structuredOutcomes', label: 'Important Outcomes', state: 'optional', order: 6 },
      { key: 'progressStatus', label: 'Progress / Status', state: 'optional', order: 7 },
      { key: 'blockerRisk', label: 'Blocker / Risk', state: 'optional', order: 8 },
      { key: 'decision', label: 'Decision', state: 'optional', order: 9 },
      { key: 'product', label: 'Select product', state: 'hidden', order: 10 },
      { key: 'stockStatus', label: 'Stock status', state: 'hidden', order: 11 },
    ],
  },
  followUps: {
    fields: [
      { key: 'task', label: 'Next Action', state: 'required', order: 1 },
      { key: 'facility', label: 'Project / Workstream', state: 'optional', order: 2 },
      { key: 'hcpName', label: 'Stakeholder', state: 'optional', order: 3 },
      { key: 'dueDate', label: 'Due Date', state: 'optional', order: 4 },
      { key: 'priority', label: 'Priority', state: 'required', order: 5 },
      { key: 'notes', label: 'Notes', state: 'optional', order: 6 },
      { key: 'sourceActivityId', label: 'Source Activity', state: 'optional', order: 7 },
      { key: 'status', label: 'Status', state: 'optional', order: 8 },
    ],
  },
  intelligence: {
    fallbackCategory: 'progress',
    outcomeCategories: {
      'Progress Made': 'progress',
      'Blocker Identified': 'risks',
      'Risk Identified': 'risks',
      'Decision Made': 'progress',
      'Deliverable Completed': 'deliverables',
      'Stakeholder Alignment': 'stakeholders',
      'Approval Received': 'deliverables',
      'Follow-up Required': 'stakeholders',
    },
    scoreWeights: {},
    textRules: [
      { pattern: 'blocker|blocked|blocked by|issue', category: 'risks' },
      { pattern: 'risk|dependency|delayed|delay', category: 'risks' },
      { pattern: 'decision|decided|approval', category: 'progress' },
      { pattern: 'deliverable|completed|complete|milestone', category: 'deliverables' },
      { pattern: 'stakeholder|client|alignment|meeting', category: 'stakeholders' },
      { pattern: 'progress|advanced|started|working', category: 'progress' },
    ],
  },
  report: {
    sections: [
      { id: 'weekly-summary', title: 'Weekly Summary', enabled: true, order: 1, dataGroups: ['weeklyPlan', 'dailyActivities'] },
      { id: 'daily-activity-breakdown', title: 'Daily Activity Breakdown', enabled: true, order: 2, dataGroups: ['dailyActivities', 'intelligence'] },
      { id: 'project-workstream-progress', title: 'Project / Workstream Progress', enabled: true, order: 3, dataGroups: ['projectProgress'] },
      { id: 'key-deliverables', title: 'Key Deliverables', enabled: true, order: 4, dataGroups: ['deliverables'] },
      { id: 'risks-blockers-decisions', title: 'Risks, Blockers & Decisions', enabled: true, order: 5, dataGroups: ['risks', 'blockers', 'decisions'] },
      { id: 'stakeholder-client-updates', title: 'Stakeholder / Client Updates', enabled: true, order: 6, dataGroups: ['stakeholders'] },
      { id: 'priorities-coming-week', title: 'Priorities for Coming Week', enabled: true, order: 7, dataGroups: ['priorities', 'followUps'] },
      { id: 'completed-follow-ups', title: 'Completed Follow-ups', enabled: true, order: 8, dataGroups: ['followUps'] },
    ],
  },
}

export const FOUNDATION_TEMPLATE_SCHEMAS: Record<string, TemplateSchema> = {
  'field-service': {
    templateId: 'field-service',
    planning: { categories: [
      { key: 'facilities', label: 'Sites / Service Locations', enabled: true, required: true, order: 1 },
      { key: 'accountObjectives', label: 'Work Orders / Jobs', enabled: true, required: true, order: 2 },
      { key: 'hcps', label: 'Customer Contact', enabled: true, required: false, order: 3 },
      { key: 'primaryObjectives', label: 'Service Objectives', enabled: true, required: false, order: 4 },
      { key: 'commercialPriorities', label: 'Priority Issues', enabled: true, required: false, order: 5 },
      { key: 'successMeasures', label: 'Service Targets', enabled: true, required: false, order: 6 },
      { key: 'virtualEngagements', label: 'Preventive Maintenance', enabled: true, required: false, order: 7 },
    ] },
    activities: {
      types: ['Service Visit', 'Installation', 'Preventive Maintenance', 'Repair / Troubleshooting', 'Inspection', 'Remote Support', 'Dispatch / Team Coordination', 'Customer Support', 'Other'],
      fields: [
        { key: 'account', label: 'Site / Location', state: 'required', order: 1, applicableActivityTypes: ['Service Visit', 'Installation', 'Preventive Maintenance', 'Repair / Troubleshooting', 'Inspection', 'Remote Support', 'Dispatch / Team Coordination', 'Customer Support', 'Other'] },
        { key: 'hcpNames', label: 'Customer / Contact', state: 'optional', order: 2, applicableActivityTypes: ['Service Visit', 'Installation', 'Preventive Maintenance', 'Repair / Troubleshooting', 'Inspection', 'Remote Support', 'Dispatch / Team Coordination', 'Customer Support', 'Other'] },
        { key: 'workOrderJob', label: 'Work Order / Job', state: 'conditional', order: 3, applicableActivityTypes: ['Service Visit', 'Installation', 'Preventive Maintenance', 'Repair / Troubleshooting', 'Inspection', 'Remote Support', 'Dispatch / Team Coordination', 'Customer Support', 'Other'] },
        { key: 'equipmentAsset', label: 'Equipment / Asset', state: 'conditional', order: 4, applicableActivityTypes: ['Service Visit', 'Installation', 'Preventive Maintenance', 'Repair / Troubleshooting', 'Inspection', 'Remote Support'] },
        { key: 'issueProblem', label: 'Issue / Problem', state: 'conditional', order: 5, applicableActivityTypes: ['Repair / Troubleshooting', 'Inspection', 'Remote Support', 'Customer Support'] },
        { key: 'outcome', label: 'Outcome', state: 'optional', order: 6, applicableActivityTypes: ['Service Visit', 'Installation', 'Preventive Maintenance', 'Repair / Troubleshooting', 'Inspection', 'Remote Support', 'Dispatch / Team Coordination', 'Customer Support', 'Other'] },
        { key: 'resolution', label: 'Resolution', state: 'conditional', order: 7, applicableActivityTypes: ['Installation', 'Repair / Troubleshooting', 'Inspection', 'Remote Support', 'Customer Support'] },
        { key: 'serviceStatus', label: 'Service Status', state: 'conditional', order: 8, applicableActivityTypes: ['Service Visit', 'Installation', 'Preventive Maintenance', 'Repair / Troubleshooting', 'Inspection', 'Remote Support', 'Customer Support'] },
        { key: 'partsMaterialsUsed', label: 'Parts / Materials Used', state: 'conditional', order: 9, applicableActivityTypes: ['Installation', 'Preventive Maintenance', 'Repair / Troubleshooting', 'Inspection', 'Remote Support', 'Customer Support'] },
        { key: 'escalation', label: 'Escalation', state: 'conditional', order: 10, applicableActivityTypes: ['Repair / Troubleshooting', 'Remote Support', 'Dispatch / Team Coordination', 'Customer Support'] },
        { key: 'slaPriority', label: 'SLA / Priority', state: 'conditional', order: 11, applicableActivityTypes: ['Repair / Troubleshooting', 'Remote Support', 'Dispatch / Team Coordination'] },
        { key: 'downtime', label: 'Downtime', state: 'conditional', order: 12, applicableActivityTypes: ['Repair / Troubleshooting'] },
        { key: 'customerSignOff', label: 'Customer Sign-off', state: 'conditional', order: 13, applicableActivityTypes: ['Service Visit', 'Installation', 'Repair / Troubleshooting'] },
        { key: 'intelligence', label: 'Service Notes', state: 'optional', order: 14, applicableActivityTypes: ['Service Visit', 'Installation', 'Preventive Maintenance', 'Repair / Troubleshooting', 'Inspection', 'Remote Support', 'Dispatch / Team Coordination', 'Customer Support', 'Other'] },
        { key: 'nextAction', label: 'Next Action', state: 'optional', order: 15, applicableActivityTypes: ['Service Visit', 'Installation', 'Preventive Maintenance', 'Repair / Troubleshooting', 'Inspection', 'Remote Support', 'Dispatch / Team Coordination', 'Customer Support', 'Other'] },
        { key: 'structuredOutcomes', label: 'Service Outcomes', state: 'optional', order: 16, applicableActivityTypes: ['Service Visit', 'Installation', 'Preventive Maintenance', 'Repair / Troubleshooting', 'Inspection', 'Remote Support', 'Dispatch / Team Coordination', 'Customer Support', 'Other'] },
      ],
    },
    followUps: {
      fields: [
        { key: 'task', label: 'Service Follow-up', state: 'required', order: 1 },
        { key: 'facility', label: 'Site / Location', state: 'optional', order: 2 },
        { key: 'hcpName', label: 'Customer / Contact', state: 'optional', order: 3 },
        { key: 'dueDate', label: 'Due Date', state: 'optional', order: 4 },
        { key: 'priority', label: 'SLA / Priority', state: 'required', order: 5 },
        { key: 'notes', label: 'Service Notes', state: 'optional', order: 6 },
        { key: 'status', label: 'Status', state: 'optional', order: 7 },
      ],
    },
    intelligence: {
      fallbackCategory: 'progress',
      outcomeCategories: {
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
      scoreWeights: {
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
    report: { sections: [
      { id: 'weekly-summary', title: 'Service Summary', enabled: true, order: 1, dataGroups: ['weeklyPlan', 'dailyActivities'] },
      { id: 'daily-activity-breakdown', title: 'Daily Service Activity', enabled: true, order: 2, dataGroups: ['dailyActivities'] },
      { id: 'priorities-coming-week', title: 'Priorities for Coming Week', enabled: true, order: 3, dataGroups: ['priorities', 'followUps'] },
    ] },
  },
  'small-business': {
    templateId: 'small-business',
    planning: { categories: [
      { key: 'facilities', label: 'Business Area', enabled: true, required: false, order: 1 },
      { key: 'hcps', label: 'Customers / Clients', enabled: true, required: false, order: 2 },
      { key: 'primaryObjectives', label: 'Weekly Business Objectives', enabled: true, required: false, order: 3 },
      { key: 'virtualEngagements', label: 'Leads / Opportunities', enabled: true, required: false, order: 4 },
      { key: 'accountObjectives', label: 'Orders / Sales', enabled: true, required: false, order: 5 },
      { key: 'commercialPriorities', label: 'Business Priorities', enabled: true, required: false, order: 6 },
      { key: 'successMeasures', label: 'Success Measures', enabled: true, required: false, order: 7 },
    ] },
    activities: {
      types: ['Customer Meeting', 'Sales Activity', 'Order Processing', 'Supplier Activity', 'Business Task', 'Follow-up', 'Other'],
      fields: [
        { key: 'account', label: 'Customer / Business Area', state: 'required', order: 1, applicableActivityTypes: ['Customer Meeting', 'Sales Activity', 'Order Processing', 'Supplier Activity', 'Business Task', 'Follow-up', 'Other'] },
        { key: 'hcpNames', label: 'Customer / Contact', state: 'optional', order: 2, applicableActivityTypes: ['Customer Meeting', 'Sales Activity', 'Order Processing', 'Follow-up'] },
        { key: 'outcome', label: 'Business Outcome', state: 'optional', order: 3, applicableActivityTypes: ['Customer Meeting', 'Sales Activity', 'Order Processing', 'Supplier Activity', 'Business Task', 'Follow-up', 'Other'] },
        { key: 'intelligence', label: 'Business Notes', state: 'optional', order: 4, applicableActivityTypes: ['Customer Meeting', 'Sales Activity', 'Order Processing', 'Supplier Activity', 'Business Task', 'Follow-up', 'Other'] },
        { key: 'nextAction', label: 'Next Action', state: 'optional', order: 5, applicableActivityTypes: ['Customer Meeting', 'Sales Activity', 'Order Processing', 'Supplier Activity', 'Business Task', 'Follow-up', 'Other'] },
        { key: 'structuredOutcomes', label: 'Business Outcomes', state: 'optional', order: 6, applicableActivityTypes: ['Customer Meeting', 'Sales Activity', 'Order Processing', 'Supplier Activity', 'Business Task', 'Follow-up', 'Other'] },
      ],
    },
    followUps: { fields: [
      { key: 'task', label: 'Follow-up', state: 'required', order: 1 },
      { key: 'facility', label: 'Customer / Business Area', state: 'optional', order: 2 },
      { key: 'hcpName', label: 'Customer / Contact', state: 'optional', order: 3 },
      { key: 'dueDate', label: 'Due Date', state: 'optional', order: 4 },
      { key: 'priority', label: 'Business Priority', state: 'required', order: 5 },
      { key: 'notes', label: 'Notes', state: 'optional', order: 6 },
      { key: 'status', label: 'Status', state: 'optional', order: 7 },
    ] },
    intelligence: {
      fallbackCategory: 'progress',
      outcomeCategories: {
        'Sale / Order Won': 'commercial',
        'Lead Qualified': 'commercial',
        'Customer Retained': 'stakeholders',
        'Payment Received': 'commercial',
        'Supplier Issue Identified': 'risks',
        'Operational Improvement': 'progress',
        'Follow-up Required': 'stakeholders',
      },
      scoreWeights: {
        'sale / order won': 40,
        'lead qualified': 35,
        'sales opportunity': 30,
        'customer retained': 25,
        'payment received': 25,
        'supplier issue identified': 20,
        'supplier issue': 20,
        'operational improvement': 20,
        'follow-up required': 15,
        'payment pending': 15,
      },
    },
    report: { sections: [
      { id: 'business-summary', title: 'Business Summary', enabled: true, order: 1, dataGroups: ['weeklyPlan', 'dailyActivities', 'outcomes'] },
      { id: 'daily-business-activity', title: 'Daily Business Activity', enabled: true, order: 2, dataGroups: ['dailyActivities'] },
      { id: 'sales-opportunity-progress', title: 'Sales & Opportunity Progress', enabled: true, order: 3, dataGroups: ['dailyActivities', 'outcomes', 'priorities'] },
      { id: 'customer-client-outcomes', title: 'Customer / Client Outcomes', enabled: true, order: 4, dataGroups: ['dailyActivities', 'outcomes'] },
      { id: 'orders-payments', title: 'Orders & Payments', enabled: true, order: 5, dataGroups: ['dailyActivities', 'outcomes'] },
      { id: 'supplier-operational-intelligence', title: 'Supplier & Operational Intelligence', enabled: true, order: 6, dataGroups: ['dailyActivities', 'outcomes'] },
      { id: 'priorities-coming-week', title: 'Priorities for Coming Week', enabled: true, order: 7, dataGroups: ['priorities', 'weeklyPlan', 'followUps'] },
      { id: 'completed-follow-ups', title: 'Completed Follow-ups', enabled: true, order: 8, dataGroups: ['followUps'] },
    ] },
  },
  'ngo-community': {
    templateId: 'ngo-community',
    planning: { categories: [
      { key: 'facilities', label: 'Community / Programme', enabled: true, required: false, order: 1 },
      { key: 'hcps', label: 'Partners / Volunteers', enabled: true, required: false, order: 2 },
      { key: 'primaryObjectives', label: 'Programme Objectives', enabled: true, required: false, order: 3 },
      { key: 'commercialPriorities', label: 'Programme Priorities', enabled: true, required: false, order: 4 },
      { key: 'successMeasures', label: 'Programme Measures', enabled: true, required: false, order: 5 },
    ] },
    activities: {
      types: ['Community Visit', 'Beneficiary Engagement', 'Partner Meeting', 'Volunteer Activity', 'Programme Activity', 'Monitoring / Evaluation', 'Other'],
      fields: [
        { key: 'account', label: 'Community / Programme', state: 'required', order: 1 },
        { key: 'hcpNames', label: 'Partner / Volunteer', state: 'optional', order: 2 },
        { key: 'outcome', label: 'Impact', state: 'optional', order: 3 },
        { key: 'intelligence', label: 'Programme Notes', state: 'optional', order: 4 },
        { key: 'nextAction', label: 'Next Action', state: 'optional', order: 5 },
        { key: 'structuredOutcomes', label: 'Interventions / Impact', state: 'optional', order: 6 },
      ],
    },
    followUps: { fields: [
      { key: 'task', label: 'Next Action', state: 'required', order: 1 },
      { key: 'facility', label: 'Community / Programme', state: 'optional', order: 2 },
      { key: 'hcpName', label: 'Partner / Volunteer', state: 'optional', order: 3 },
      { key: 'dueDate', label: 'Due Date', state: 'optional', order: 4 },
      { key: 'priority', label: 'Programme Priority', state: 'required', order: 5 },
      { key: 'notes', label: 'Programme Notes', state: 'optional', order: 6 },
      { key: 'status', label: 'Status', state: 'optional', order: 7 },
    ] },
    intelligence: { fallbackCategory: 'progress', outcomeCategories: {}, scoreWeights: {} },
    report: { sections: [
      { id: 'weekly-summary', title: 'Programme Summary', enabled: true, order: 1, dataGroups: ['weeklyPlan', 'dailyActivities'] },
      { id: 'daily-activity-breakdown', title: 'Daily Community Activity', enabled: true, order: 2, dataGroups: ['dailyActivities'] },
      { id: 'priorities-coming-week', title: 'Priorities for Coming Week', enabled: true, order: 3, dataGroups: ['priorities', 'followUps'] },
    ] },
  },
  education: {
    templateId: 'education',
    planning: { categories: [
      { key: 'facilities', label: 'Classes / Subjects', enabled: true, required: false, order: 1 },
      { key: 'hcps', label: 'Students / Teachers', enabled: true, required: false, order: 2 },
      { key: 'primaryObjectives', label: 'Learning Objectives', enabled: true, required: false, order: 3 },
      { key: 'commercialPriorities', label: 'Learning Priorities', enabled: true, required: false, order: 4 },
      { key: 'successMeasures', label: 'Learning Measures', enabled: true, required: false, order: 5 },
    ] },
    activities: {
      types: ['Lesson', 'Student Support', 'Assessment', 'Parent / Guardian Meeting', 'Teacher Meeting', 'Planning', 'Other'],
      fields: [
        { key: 'account', label: 'Class / Subject', state: 'required', order: 1 },
        { key: 'hcpNames', label: 'Student / Teacher', state: 'optional', order: 2 },
        { key: 'outcome', label: 'Learning Outcome', state: 'optional', order: 3 },
        { key: 'intelligence', label: 'Teaching Notes', state: 'optional', order: 4 },
        { key: 'nextAction', label: 'Next Action', state: 'optional', order: 5 },
        { key: 'structuredOutcomes', label: 'Learning Outcomes', state: 'optional', order: 6 },
      ],
    },
    followUps: { fields: [
      { key: 'task', label: 'Next Action', state: 'required', order: 1 },
      { key: 'facility', label: 'Class / Subject', state: 'optional', order: 2 },
      { key: 'hcpName', label: 'Student / Teacher', state: 'optional', order: 3 },
      { key: 'dueDate', label: 'Due Date', state: 'optional', order: 4 },
      { key: 'priority', label: 'Learning Priority', state: 'required', order: 5 },
      { key: 'notes', label: 'Teaching Notes', state: 'optional', order: 6 },
      { key: 'status', label: 'Status', state: 'optional', order: 7 },
    ] },
    intelligence: { fallbackCategory: 'progress', outcomeCategories: {}, scoreWeights: {} },
    report: { sections: [
      { id: 'weekly-summary', title: 'Learning Summary', enabled: true, order: 1, dataGroups: ['weeklyPlan', 'dailyActivities'] },
      { id: 'daily-activity-breakdown', title: 'Daily Learning Activity', enabled: true, order: 2, dataGroups: ['dailyActivities'] },
      { id: 'priorities-coming-week', title: 'Priorities for Coming Week', enabled: true, order: 3, dataGroups: ['priorities', 'followUps'] },
    ] },
  },
  personal: {
    templateId: 'personal',
    planning: { categories: [
      { key: 'facilities', label: 'Area / Commitment', enabled: true, required: false, order: 1 },
      { key: 'primaryObjectives', label: 'Goals', enabled: true, required: false, order: 2 },
      { key: 'commercialPriorities', label: 'Priorities', enabled: true, required: false, order: 3 },
      { key: 'successMeasures', label: 'Goal Measures', enabled: true, required: false, order: 4 },
    ] },
    activities: {
      types: ['Task', 'Appointment', 'Errand', 'Personal Project', 'Exercise / Routine', 'Other'],
      fields: [
        { key: 'account', label: 'Area / Commitment', state: 'required', order: 1 },
        { key: 'outcome', label: 'Outcome', state: 'optional', order: 2 },
        { key: 'intelligence', label: 'Note', state: 'optional', order: 3 },
        { key: 'nextAction', label: 'Next Step', state: 'optional', order: 4 },
        { key: 'structuredOutcomes', label: 'Notes / Outcomes', state: 'optional', order: 5 },
      ],
    },
    followUps: { fields: [
      { key: 'task', label: 'Next Step', state: 'required', order: 1 },
      { key: 'facility', label: 'Area / Commitment', state: 'optional', order: 2 },
      { key: 'dueDate', label: 'Due Date', state: 'optional', order: 3 },
      { key: 'priority', label: 'Priority', state: 'required', order: 4 },
      { key: 'notes', label: 'Note', state: 'optional', order: 5 },
      { key: 'status', label: 'Status', state: 'optional', order: 6 },
    ] },
    intelligence: { fallbackCategory: 'progress', outcomeCategories: {}, scoreWeights: {} },
    report: { sections: [
      { id: 'weekly-summary', title: 'Weekly Summary', enabled: true, order: 1, dataGroups: ['weeklyPlan', 'dailyActivities'] },
      { id: 'daily-activity-breakdown', title: 'Daily Activity Breakdown', enabled: true, order: 2, dataGroups: ['dailyActivities'] },
      { id: 'priorities-coming-week', title: 'Priorities for Coming Week', enabled: true, order: 3, dataGroups: ['priorities', 'followUps'] },
    ] },
  },
  custom: {
    templateId: 'custom',
    planning: { categories: [
      { key: 'facilities', label: 'Work Area', enabled: true, required: false, order: 1 },
      { key: 'primaryObjectives', label: 'Objectives', enabled: true, required: false, order: 2 },
      { key: 'commercialPriorities', label: 'Priorities', enabled: true, required: false, order: 3 },
      { key: 'successMeasures', label: 'Measures', enabled: true, required: false, order: 4 },
    ] },
    activities: {
      types: ['Activity'],
      fields: [
        { key: 'account', label: 'Work Area', state: 'required', order: 1 },
        { key: 'outcome', label: 'Outcome', state: 'optional', order: 2 },
        { key: 'intelligence', label: 'Notes', state: 'optional', order: 3 },
        { key: 'nextAction', label: 'Next Action', state: 'optional', order: 4 },
        { key: 'structuredOutcomes', label: 'Outcomes', state: 'optional', order: 5 },
      ],
    },
    followUps: { fields: [
      { key: 'task', label: 'Next Action', state: 'required', order: 1 },
      { key: 'facility', label: 'Work Area', state: 'optional', order: 2 },
      { key: 'dueDate', label: 'Due Date', state: 'optional', order: 3 },
      { key: 'priority', label: 'Priority', state: 'required', order: 4 },
      { key: 'notes', label: 'Notes', state: 'optional', order: 5 },
      { key: 'status', label: 'Status', state: 'optional', order: 6 },
    ] },
    intelligence: { fallbackCategory: 'progress', outcomeCategories: {}, scoreWeights: {} },
    report: { sections: [
      { id: 'weekly-summary', title: 'Weekly Summary', enabled: true, order: 1, dataGroups: ['weeklyPlan', 'dailyActivities'] },
      { id: 'daily-activity-breakdown', title: 'Daily Activity Breakdown', enabled: true, order: 2, dataGroups: ['dailyActivities'] },
      { id: 'priorities-coming-week', title: 'Priorities for Coming Week', enabled: true, order: 3, dataGroups: ['priorities', 'followUps'] },
    ] },
  },
}

export function getTemplateSchemaById(templateId: string | null | undefined): TemplateSchema | undefined {
  if (!templateId) return FIELD_SALES_TEMPLATE_SCHEMA
  return FOUNDATION_TEMPLATE_SCHEMAS[templateId] ?? (templateId === 'project-management' ? PROJECT_MANAGEMENT_TEMPLATE_SCHEMA : templateId === 'field-sales' ? FIELD_SALES_TEMPLATE_SCHEMA : undefined)
}

export function getWorkflowTemplateSchemaById(templateId: string | null | undefined): TemplateSchema {
  return getTemplateSchemaById(templateId) ?? FIELD_SALES_TEMPLATE_SCHEMA
}
